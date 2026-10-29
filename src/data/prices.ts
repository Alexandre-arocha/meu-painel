// brapi.dev v2. Docs: https://brapi.dev/docs/acoes/cotacao.md e https://brapi.dev/docs/acoes/historico.md
// Token no header Authorization: Bearer. Erros: 400 limite do plano (ativos por chamada, intervalo), 401 token
// ausente/inválido, 403 plano, 429 limite.
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

// Motivo que a brapi (message) ou o servidor do painel (error) mandam no corpo do erro.
async function reason(res: Response): Promise<string> {
  let body: { message?: unknown; error?: unknown } | null
  try {
    body = await res.json()
  } catch {
    return '' // corpo que não é JSON
  }
  if (typeof body?.message === 'string' && body.message) return `: ${body.message}`
  if (typeof body?.error === 'string' && body.error) return `: ${body.error}`
  return ''
}

export const createProxyPriceProvider = (fetchFn: typeof fetch = fetch, now?: () => Date): PriceProvider =>
  createBrapiProvider(undefined, fetchFn, now, '/api/brapi')

export function createBrapiProvider(
  token: string | undefined,
  fetchFn: typeof fetch = fetch,
  now: () => Date = () => new Date(),
  base: string = BASE,
): PriceProvider {
  // Pelo servidor (/api/brapi) o token fica na Vercel: o navegador não manda Authorization.
  const viaServer = base !== BASE
  const get = (url: string) => fetchFn(url, viaServer ? {} : { headers: { Authorization: `Bearer ${token}` } })

  async function intraday(symbol: string): Promise<Quote['intraday']> {
    try {
      const res = await get(`${base}/historical?symbols=${symbol}&range=1d&interval=15m`)
      if (!res.ok) return []
      const body = (await res.json()) as {
        results?: { data?: { historicalDataPrice?: { date: number; close: number | null }[] } }[]
      }
      const rows = body.results?.[0]?.data?.historicalDataPrice ?? []
      return rows
        .filter((r) => typeof r.close === 'number')
        .map((r) => ({ t: new Date(r.date * 1000).toISOString(), p: r.close as number }))
    } catch {
      return []
    }
  }

  async function quote(symbol: string): Promise<{ symbol: string; data: Raw }[]> {
    const res = await get(`${base}/quote?symbols=${symbol}`)
    if (res.status === 401) throw new Error(viaServer ? 'sessão expirada; entre de novo' : 'token inválido')
    if (viaServer && res.status === 503) throw new Error('token da brapi não cadastrado na Vercel')
    if (!res.ok) throw new Error(`erro ao buscar preços (${res.status})${await reason(res)}`)
    const body = (await res.json()) as { results?: { symbol: string; data: Raw }[] }
    return body.results ?? []
  }

  return {
    async getQuotes(symbols) {
      if (!viaServer && !token) throw new Error('token ausente')
      // Um ativo por chamada: o plano grátis da brapi recusa mais de 1 (QUOTES_PER_REQUEST_EXCEEDED).
      const results = (await Promise.all(symbols.map((s) => quote(s)))).flat()
      return Promise.all(
        results
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
