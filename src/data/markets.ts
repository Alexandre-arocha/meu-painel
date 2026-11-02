import { marketOf, type PricedKind } from '../domain/portfolio'
import type { Point, PriceProvider, Quote } from './prices'

// Fontes grátis além da brapi: o Yahoo pelo servidor (/api/history), e a CoinGecko e a AwesomeAPI direto do navegador.
export type Range = '5d' | '3mo' | '1y' | '5y' | '10y'
export type Chart = {
  currency: string | null
  price: number
  changePct: number | null
  updatedAt: string | null
  name: string | null
  points: Point[]
}

export type Markets = {
  chart(symbol: string, range: Range): Promise<Chart | null> // null: o Yahoo não conhece o símbolo
  crypto(ids: string[]): Promise<Quote[]>
  cryptoHistory(id: string): Promise<Point[]>
  findCrypto(query: string): Promise<{ id: string; name: string } | null>
  fx(codes: string[]): Promise<Quote[]>
  fxHistory(code: string): Promise<Point[]>
  cdi(today: string): Promise<Point[]> // % ao dia, 6 anos até hoje (AAAA-MM-DD)
}

const COINGECKO = 'https://api.coingecko.com/api/v3'
const AWESOME = 'https://economia.awesomeapi.com.br/json'
const SGS_CDI = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados' // Banco Central: CDI ao dia
const BC_TIMEOUT_MS = 15_000

const fromSeconds = (s: unknown) => {
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : new Date().toISOString()
}
const byTime = (a: Point, b: Point) => a.t.localeCompare(b.t)

export function createMarkets(fetchFn: typeof fetch = fetch, historyBase = '/api/history'): Markets {
  // 404 passa adiante: cada fonte decide o que ele quer dizer.
  async function get(url: string, what: string, init?: RequestInit): Promise<Response> {
    const res = await fetchFn(url, init)
    if (res.status === 401) throw new Error('sessão expirada; entre de novo')
    if (!res.ok && res.status !== 404) throw new Error(`erro ao buscar ${what} (${res.status})`)
    return res
  }

  return {
    async chart(symbol, range) {
      const res = await get(`${historyBase}?symbol=${encodeURIComponent(symbol)}&range=${range}`, 'o histórico')
      if (res.status === 404) return null
      const { t, c, ...rest } = (await res.json()) as Omit<Chart, 'points'> & { t: string[]; c: number[] }
      return { ...rest, points: t.map((time, i) => ({ t: time, p: c[i] })) }
    },

    async crypto(ids) {
      const url = `${COINGECKO}/simple/price?ids=${ids.join(',')}&vs_currencies=brl&include_24hr_change=true&include_last_updated_at=true`
      const res = await get(url, 'as criptos')
      if (res.status === 404) return []
      const body = (await res.json()) as Record<string, { brl?: number; brl_24h_change?: number; last_updated_at?: number } | undefined>
      return ids.flatMap((id) => {
        const r = body[id]
        if (!r || typeof r.brl !== 'number' || !Number.isFinite(r.brl)) return []
        return [{ symbol: `crypto:${id}`, price: r.brl, changePct: r.brl_24h_change ?? 0, updatedAt: fromSeconds(r.last_updated_at), stale: false }]
      })
    },

    async cryptoHistory(id) {
      const res = await get(`${COINGECKO}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=brl&days=365&interval=daily`, 'o histórico da cripto')
      if (res.status === 404) throw new Error('cripto não encontrada')
      const body = (await res.json()) as { prices?: [number, number][] }
      return (body.prices ?? []).filter(([, p]) => Number.isFinite(p)).map(([ms, p]) => ({ t: new Date(ms).toISOString(), p }))
    },

    async findCrypto(query) {
      const res = await get(`${COINGECKO}/search?query=${encodeURIComponent(query)}`, 'a cripto')
      if (res.status === 404) return null
      const coins = ((await res.json()) as { coins?: { id: string; symbol: string; name: string }[] }).coins ?? []
      const q = query.toLowerCase()
      // A busca vem pela ordem de tamanho de mercado: "btc" acha o Bitcoin antes das cópias.
      const hit = coins.find((c) => c.id === q || c.symbol.toLowerCase() === q)
      return hit ? { id: hit.id, name: hit.name } : null
    },

    async fx(codes) {
      const res = await get(`${AWESOME}/last/${codes.map((c) => `${c}-BRL`).join(',')}`, 'o câmbio')
      if (res.status === 404) return []
      const body = (await res.json()) as Record<string, { bid?: string; pctChange?: string; timestamp?: string } | undefined>
      return codes.flatMap((code) => {
        const r = body[`${code}BRL`]
        const price = Number(r?.bid)
        if (!r || !(price > 0)) return []
        return [{ symbol: `fx:${code}`, price, changePct: Number(r.pctChange) || 0, updatedAt: fromSeconds(r.timestamp), stale: false }]
      })
    },

    async fxHistory(code) {
      const res = await get(`${AWESOME}/daily/${code}-BRL/90`, 'o histórico do câmbio')
      if (res.status === 404) throw new Error('moeda não encontrada')
      const rows = (await res.json()) as { bid?: string; timestamp?: string }[]
      return rows
        .map((r) => ({ t: fromSeconds(r.timestamp), p: Number(r.bid) }))
        .filter((x) => x.p > 0)
        .sort(byTime)
    },

    async cdi(today) {
      const br = (d: string) => d.split('-').reverse().join('/')
      // Um ano a mais que os 5 do Yahoo, para o CDI sempre cobrir o primeiro dia da série do ativo.
      const from = `${Number(today.slice(0, 4)) - 6}${today.slice(4)}`
      const url = `${SGS_CDI}?formato=json&dataInicial=${br(from)}&dataFinal=${br(today)}`
      const res = await get(url, 'o CDI', { signal: AbortSignal.timeout(BC_TIMEOUT_MS) })
      if (res.status === 404) return []
      const rows = (await res.json()) as { data?: string; valor?: string }[]
      // Marcado ao meio-dia UTC: em Brasília ainda é o mesmo dia.
      return rows
        .map((r) => ({ t: `${(r.data ?? '').split('/').reverse().join('-')}T12:00:00.000Z`, p: Number(r.valor) }))
        .filter((x) => !Number.isNaN(Date.parse(x.t)) && Number.isFinite(x.p))
        .sort(byTime)
    },
  }
}

// Ativo dos EUA em reais: o preço vezes o dólar. A variação do dia junta a do ativo e a do dólar.
export function inReais(symbol: string, chart: Chart, usd: Quote): Quote {
  const changePct = ((1 + (chart.changePct ?? 0) / 100) * (1 + usd.changePct / 100) - 1) * 100
  return { symbol: `us:${symbol}`, price: chart.price * usd.price, changePct, updatedAt: chart.updatedAt ?? usd.updatedAt, stale: false }
}

// "Banco do Brasil S.A." vira "Banco do Brasil"; "B3 S.A. - Brasil, Bolsa, Balcão" vira "B3".
export function cleanName(name: string | null | undefined): string | undefined {
  const first = name?.split(' - ')[0].replace(/\s+/g, ' ').trim()
  return first?.replace(/,?\s+(S\.?\/?A\.?|Inc\.?|Corp\.?|Corporation|Ltd\.?|plc|N\.?V\.?)$/i, '').trim() || undefined
}

export type Lookup = { ok: true; symbol: string; name?: string } | { ok: false; error: string }

// Confere se o ativo existe antes de salvar. Na B3, se o Yahoo falhar, confere pela brapi.
export async function lookupAsset(kind: PricedKind, symbol: string, m: Markets, b3?: PriceProvider): Promise<Lookup> {
  const market = marketOf(kind)
  try {
    if (market === 'crypto') {
      const coin = await m.findCrypto(symbol)
      return coin ? { ok: true, symbol: coin.id, name: coin.name } : { ok: false, error: 'cripto não encontrada' }
    }
    if (market === 'fx') {
      const [quote] = await m.fx([symbol])
      return quote ? { ok: true, symbol } : { ok: false, error: 'moeda não encontrada' }
    }
    let chart: Chart | null
    try {
      chart = await m.chart(market === 'b3' ? `${symbol}.SA` : symbol, '5d')
    } catch (e) {
      if (market !== 'b3' || !b3) throw e
      const quotes = await b3.getQuotes([symbol]).catch(() => [])
      return quotes.length > 0 ? { ok: true, symbol } : { ok: false, error: 'código não encontrado na B3' }
    }
    if (!chart) return { ok: false, error: market === 'b3' ? 'código não encontrado na B3' : 'código não encontrado nos EUA' }
    if (market === 'us' && chart.currency !== 'USD') return { ok: false, error: 'só ativos dos EUA, cotados em dólar' }
    const name = cleanName(chart.name)
    return { ok: true, symbol, ...(name && { name }) }
  } catch (e) {
    return { ok: false, error: `não deu para conferir agora (${e instanceof Error ? e.message : 'erro desconhecido'}); tente de novo` }
  }
}
