import { useEffect, useState } from 'react'
import type { Markets } from '../data/markets'
import type { Point } from '../data/prices'
import { loadBenchmarks, saveBenchmarks, type PricesCache } from '../data/storage'
import { mergeSeries } from '../domain/quant'

export type Benchmarks = { ibov: Point[]; cdi: Point[] }

const NAMES = ['ibov', 'cdi'] as const

const view = ({ series }: PricesCache): Benchmarks => ({ ibov: series.ibov ?? [], cdi: series.cdi ?? [] })

// Ibovespa e CDI, as réguas do motor: uma busca por dia. Se uma falhar, fica o guardado e a tela segue sem ela.
export function useBenchmarks({ markets, store, today }: { markets: Markets; store: Storage; today: string }): Benchmarks {
  const [state, setState] = useState<Benchmarks>(() => view(loadBenchmarks(store)))

  useEffect(() => {
    const todo = NAMES.filter((name) => loadBenchmarks(store).fetched[name] !== today)
    if (todo.length === 0) return
    let alive = true
    const load = async (name: (typeof NAMES)[number]) =>
      name === 'cdi' ? markets.cdi(today) : ((await markets.chart('^BVSP', '5y'))?.points ?? [])
    void Promise.allSettled(todo.map(load)).then((results) => {
      if (!alive) return
      const next = loadBenchmarks(store)
      for (const [i, r] of results.entries()) {
        if (r.status !== 'fulfilled' || r.value.length === 0) continue
        next.series[todo[i]] = mergeSeries(next.series[todo[i]] ?? [], r.value)
        next.fetched[todo[i]] = today
      }
      saveBenchmarks(next, store)
      setState(view(next))
    })
    return () => {
      alive = false
    }
  }, [markets, store, today])

  return state
}
