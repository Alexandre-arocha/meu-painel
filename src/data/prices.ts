// brapi.dev v2. Docs: https://brapi.dev/docs/acoes/cotacao.md e https://brapi.dev/docs/acoes/historico.md
// Token no header Authorization: Bearer. Erros: 400 limite do plano (ativos por chamada, intervalo), 401 token
// ausente/inválido, 403 plano, 429 limite.
export type Point = { t: string; p: number }

export type Quote = {
  symbol: string
  price: number
  changePct: number
  updatedAt: string
  stale: boolean
}

export interface PriceProvider {
  getQuotes(symbols: string[]): Promise<Quote[]>
  // Fechamentos diários dos últimos 3 meses. Opcional: provedores de teste podem não ter.
  getHistory?(symbol: string): Promise<Point[]>
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

  async function failure(res: Response, what: string): Promise<Error> {
    if (res.status === 401) return new Error(viaServer ? 'sessão expirada; entre de novo' : 'token inválido')
    if (viaServer && res.status === 503) return new Error('token da brapi não cadastrado na Vercel')
    return new Error(`erro ao buscar ${what} (${res.status})${await reason(res)}`)
  }

  // Fechamentos diários dos últimos 3 meses, o máximo do plano grátis. O plano recusa o intervalo de 15 minutos do gráfico do dia.
  async function history(symbol: string): Promise<Point[]> {
    const res = await get(`${base}/historical?symbols=${symbol}&range=3mo&interval=1d`)
    if (!res.ok) throw await failure(res, 'histórico')
    const body = (await res.json()) as {
      results?: { data?: { historicalDataPrice?: { date: number; close: number | null; adjustedClose?: number | null }[] } }[]
    }
    return (body.results?.[0]?.data?.historicalDataPrice ?? [])
      // Fechamento ajustado por proventos quando vier: assim o retorno conta dividendos e JCP.
      .map((r) => ({ t: new Date(r.date * 1000).toISOString(), p: r.adjustedClose ?? r.close }))
      .filter((x): x is Point => typeof x.p === 'number' && Number.isFinite(x.p))
      .sort((a, b) => a.t.localeCompare(b.t))
  }

  async function quote(symbol: string): Promise<{ symbol: string; data: Raw }[]> {
    const res = await get(`${base}/quote?symbols=${symbol}`)
    if (!res.ok) throw await failure(res, 'preços')
    const body = (await res.json()) as { results?: { symbol: string; data: Raw }[] }
    return body.results ?? []
  }

  return {
    async getHistory(symbol) {
      if (!viaServer && !token) throw new Error('token ausente')
      return history(symbol)
    },

    async getQuotes(symbols) {
      if (!viaServer && !token) throw new Error('token ausente')
      // Um ativo por chamada: o plano grátis da brapi recusa mais de 1 (QUOTES_PER_REQUEST_EXCEEDED).
      const results = (await Promise.all(symbols.map((s) => quote(s)))).flat()
      return results
        .filter((r) => typeof r.data?.regularMarketPrice === 'number' && Number.isFinite(r.data.regularMarketPrice))
        .map((r) => {
          const updatedAt = String(r.data.regularMarketTime)
          return {
            symbol: r.symbol,
            price: Number(r.data.regularMarketPrice),
            changePct: Number(r.data.regularMarketChangePercent),
            updatedAt,
            stale: isStale(updatedAt, now()),
          }
        })
    },
  }
}
