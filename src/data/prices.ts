// brapi.dev v2. Docs: https://brapi.dev/docs/acoes/cotacao.md e https://brapi.dev/docs/acoes/historico.md
// Token no header Authorization: Bearer. Erros: 401 token ausente/inválido, 403 plano, 429 limite.
export type Quote = {
  symbol: string
  price: number
  changePct: number
  updatedAt: string
  stale: boolean
  intraday: { t: string; p: number }[]
}

export interface PriceProvider {
  getQuotes(symbols: string[]): Promise<Quote[]>
}

const BASE = 'https://brapi.dev/api/v2/stocks'
const STALE_AFTER_MIN = 15

// shortcut: não conhece feriados de mercado, só fim de semana e horário; incluir calendário B3 se atrapalhar.
export function isStale(updatedAt: string, now: Date): boolean {
  const brt = new Date(now.getTime() - 3 * 3600_000) // Brasília é UTC-3 o ano todo
  const day = brt.getUTCDay()
  const minutes = brt.getUTCHours() * 60 + brt.getUTCMinutes()
  const marketOpen = day >= 1 && day <= 5 && minutes >= 10 * 60 && minutes <= 17 * 60 + 30
  if (!marketOpen) return false
  return now.getTime() - new Date(updatedAt).getTime() > STALE_AFTER_MIN * 60_000
}

type Raw = Record<string, unknown>

export function createBrapiProvider(
  token: string | undefined,
  fetchFn: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): PriceProvider {
  const get = (url: string) => fetchFn(url, { headers: { Authorization: `Bearer ${token}` } })

  async function intraday(symbol: string): Promise<Quote['intraday']> {
    try {
      const res = await get(`${BASE}/historical?symbols=${symbol}&range=1d&interval=15m`)
      if (!res.ok) return []
      const body = (await res.json()) as { results?: Raw[] }
      const rows = (body.results?.[0]?.data ?? []) as { date: number; close: number | null }[]
      return rows
        .filter((r) => typeof r.close === 'number')
        .map((r) => ({ t: new Date(r.date * 1000).toISOString(), p: r.close as number }))
    } catch {
      return []
    }
  }

  return {
    async getQuotes(symbols) {
      if (!token) throw new Error('token ausente')
      const res = await get(`${BASE}/quote?symbols=${symbols.join(',')}`)
      if (res.status === 401) throw new Error('token inválido')
      if (!res.ok) throw new Error(`erro ao buscar preços (${res.status})`)
      const body = (await res.json()) as { results?: { symbol: string; data: Raw }[] }
      return Promise.all(
        (body.results ?? [])
          .filter((r) => typeof r.data?.regularMarketPrice === 'number' && Number.isFinite(r.data.regularMarketPrice))
          .map(async (r) => {
          const updatedAt = String(r.data.regularMarketTime)
          return {
            symbol: r.symbol,
            price: Number(r.data.regularMarketPrice),
            changePct: Number(r.data.regularMarketChangePercent),
            updatedAt,
            stale: isStale(updatedAt, now()),
            intraday: await intraday(r.symbol),
          }
        }),
      )
    },
  }
}
