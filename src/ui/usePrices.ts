import { useEffect, useState } from 'react'
import { inReais, type Markets } from '../data/markets'
import { marketOpen, type PriceProvider, type Quote } from '../data/prices'
import { loadQuotes, saveQuotes } from '../data/storage'
import { priceKeys, type Position } from '../domain/portfolio'

// De 15 em 15 min, com a aba visível. A brapi só é chamada de novo com o pregão aberto: a cota grátis é de 15 mil chamadas por mês.
const REFRESH_MS = 15 * 60_000

export type PriceDeps = {
  makePrices: (token: string | undefined) => PriceProvider
  token: string | undefined
  markets: Markets
  store: Storage
  now?: () => Date
}

type Group = { keys: string[]; run: () => Promise<Quote[]> }

// Uma busca por mercado: a brapi um ativo por chamada, a CoinGecko e a AwesomeAPI todas juntas, os EUA pelo Yahoo, em reais.
function groups(keys: string[], b3: PriceProvider, m: Markets, withB3: boolean): Group[] {
  const symbolsOf = (market: string) => keys.filter((k) => k.startsWith(`${market}:`)).map((k) => k.slice(market.length + 1))
  const [stocks, us, crypto, fx] = [symbolsOf('b3'), symbolsOf('us'), symbolsOf('crypto'), symbolsOf('fx')]
  // O dólar entra para converter os ativos dos EUA, mesmo sem ser uma posição.
  const codes = [...new Set([...fx, ...(us.length > 0 ? ['USD'] : [])])]
  const rates = codes.length > 0 ? m.fx(codes) : Promise.resolve([])
  const list: Group[] = []
  if (stocks.length > 0 && withB3) {
    list.push({ keys: stocks.map((s) => `b3:${s}`), run: async () => (await b3.getQuotes(stocks)).map((q) => ({ ...q, symbol: `b3:${q.symbol}` })) })
  }
  if (crypto.length > 0) list.push({ keys: crypto.map((s) => `crypto:${s}`), run: () => m.crypto(crypto) })
  if (fx.length > 0) list.push({ keys: fx.map((c) => `fx:${c}`), run: async () => (await rates).filter((q) => fx.includes(q.symbol.slice(3))) })
  if (us.length > 0) {
    list.push({
      keys: us.map((s) => `us:${s}`),
      run: async () => {
        const usd = (await rates).find((q) => q.symbol === 'fx:USD')
        if (!usd) throw new Error('sem a cotação do dólar')
        const charts = await Promise.all(us.map((s) => m.chart(s, '5d')))
        return charts.flatMap((c, i) => (c ? [inReais(us[i], c, usd)] : []))
      },
    })
  }
  return list
}

// Preço de cada ativo da carteira, em reais. Se uma fonte falhar, fica o último preço dela, marcado como velho.
export function usePrices(positions: Position[], { makePrices, token, markets, store, now = () => new Date() }: PriceDeps) {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [error, setError] = useState<string | null>(null)
  const keyList = priceKeys(positions).join(',')

  // `now` fica fora das dependências: é só o relógio, e a função padrão muda a cada render.
  useEffect(() => {
    const keys = keyList ? keyList.split(',') : []
    setError(null)
    if (keys.length === 0) {
      setQuotes([])
      return
    }
    let alive = true
    const latest = new Map<string, Quote>()
    const load = async (first: boolean) => {
      const list = groups(keys, makePrices(token), markets, first || marketOpen(now()))
      const results = await Promise.allSettled(list.map((g) => g.run()))
      if (!alive) return
      const saved = new Map(loadQuotes(store).map((q) => [q.symbol, q]))
      let problem: string | null = null
      for (const [i, r] of results.entries()) {
        if (r.status === 'fulfilled') {
          for (const q of r.value) latest.set(q.symbol, q)
          continue
        }
        problem ??= r.reason instanceof Error ? r.reason.message : 'erro ao buscar preços'
        for (const k of list[i].keys) {
          const old = latest.get(k) ?? saved.get(k)
          if (old) latest.set(k, { ...old, stale: true })
        }
      }
      const next = keys.flatMap((k) => latest.get(k) ?? [])
      setQuotes(next)
      setError(problem)
      saveQuotes(next, store)
    }
    void load(true)
    const id = setInterval(() => {
      if (!document.hidden) void load(false)
    }, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [keyList, makePrices, token, markets, store]) // eslint-disable-line react-hooks/exhaustive-deps

  return { quotes, error }
}
