import { useEffect, useState } from 'react'
import type { Markets } from '../data/markets'
import type { Point, PriceProvider } from '../data/prices'
import { loadPrices, savePrices, type PricesCache } from '../data/storage'
import { priceKeys, type Position } from '../domain/portfolio'
import { inBrl, mergeSeries } from '../domain/quant'

export type HistoryState = { series: Record<string, Point[]>; error: string | null; loading: boolean }

export type HistoryDeps = {
  makePrices: (token: string | undefined) => PriceProvider
  token: string | undefined
  markets: Markets
  store: Storage
  today: string
}

// O dólar entra para converter os ativos dos EUA, mesmo sem ser uma posição.
const withUsd = (keys: string[]) => (keys.some((k) => k.startsWith('us:')) && !keys.includes('fx:USD') ? [...keys, 'fx:USD'] : keys)

// O câmbio do Yahoo vem marcado às 00:00 UTC, que em Brasília ainda é o dia anterior; ao meio-dia UTC, cai no dia certo.
const noonUtc = (points: Point[]) => points.map((x) => ({ t: new Date(Date.parse(x.t) + 12 * 3600_000).toISOString(), p: x.p }))

const pick = <T,>(o: Record<string, T>, keys: string[]) => Object.fromEntries(keys.flatMap((k) => (k in o ? [[k, o[k]]] : [])))

// 5 anos pelo Yahoo; se falhar, a brapi (3 meses) na B3 e a AwesomeAPI (90 dias) no câmbio. Cripto vem da CoinGecko (1 ano).
async function fetchSeries(key: string, b3: PriceProvider, m: Markets): Promise<Point[]> {
  const cut = key.indexOf(':')
  const market = key.slice(0, cut)
  const symbol = key.slice(cut + 1)
  const yahoo = async (s: string) => {
    const chart = await m.chart(s, '5y')
    if (!chart || chart.points.length === 0) throw new Error(`histórico de ${symbol} não encontrado`)
    return chart.points
  }
  if (market === 'crypto') return m.cryptoHistory(symbol)
  if (market === 'us') return yahoo(symbol)
  if (market === 'fx') return yahoo(`${symbol}BRL=X`).then(noonUtc, () => m.fxHistory(symbol))
  return yahoo(`${symbol}.SA`).catch((e) => {
    if (!b3.getHistory) throw e
    return b3.getHistory(symbol)
  })
}

// Séries em reais por chave de preço: as dos EUA passam pelo dólar de cada dia.
function view(keys: string[], cache: PricesCache): Record<string, Point[]> {
  const usd = cache.series['fx:USD'] ?? []
  return Object.fromEntries(
    keys.flatMap((k) => {
      const s = cache.series[k]
      const brl = s && k.startsWith('us:') ? inBrl(s, usd) : s
      return brl && brl.length > 0 ? [[k, brl]] : []
    }),
  )
}

// Histórico diário de cada ativo: busca uma vez por dia o que faltar, junta ao guardado e, se uma busca falhar, fica com o guardado.
export function useHistory(positions: Position[], { makePrices, token, markets, store, today }: HistoryDeps): HistoryState {
  const keyList = priceKeys(positions).join(',')
  const [state, setState] = useState<HistoryState>(() => {
    const keys = keyList ? keyList.split(',') : []
    const cache = loadPrices(store)
    return { series: view(keys, cache), error: null, loading: withUsd(keys).some((k) => cache.fetched[k] !== today) }
  })

  useEffect(() => {
    const keys = keyList ? keyList.split(',') : []
    const needed = withUsd(keys)
    const cache = loadPrices(store)
    const todo = needed.filter((k) => cache.fetched[k] !== today)
    setState({ series: view(keys, cache), error: null, loading: todo.length > 0 })
    if (todo.length === 0) return
    let alive = true
    const b3 = makePrices(token)
    void Promise.allSettled(todo.map((k) => fetchSeries(k, b3, markets))).then((results) => {
      if (!alive) return
      const next = loadPrices(store)
      let problem: string | null = null
      for (const [i, r] of results.entries()) {
        const k = todo[i]
        if (r.status === 'rejected') {
          problem ??= r.reason instanceof Error ? r.reason.message : 'erro desconhecido'
          continue
        }
        next.series[k] = mergeSeries(next.series[k] ?? [], r.value)
        next.fetched[k] = today
      }
      // Só fica o histórico dos ativos de agora: o que saiu da carteira não ocupa espaço no aparelho.
      const kept = { series: pick(next.series, needed), fetched: pick(next.fetched, needed) }
      savePrices(kept, store)
      setState({ series: view(keys, kept), error: problem ? `Não deu para buscar o histórico: ${problem}.` : null, loading: false })
    })
    return () => {
      alive = false
    }
  }, [keyList, makePrices, token, markets, store, today])

  return state
}
