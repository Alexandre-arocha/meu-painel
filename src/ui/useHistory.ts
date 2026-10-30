import { useEffect, useState } from 'react'
import type { Point, PriceProvider } from '../data/prices'
import { loadHistory, saveHistory } from '../data/storage'
import { SYMBOLS } from './useQuotes'

export type HistoryState = { series: Record<string, Point[]>; error: string | null; loading: boolean }

// Histórico diário dos ativos: usa o guardado de hoje ou busca 1 vez por ativo e guarda. Se falhar, fica com o guardado antigo.
export function useHistory(
  makePrices: (token: string | undefined) => PriceProvider,
  token: string | undefined,
  store: Storage,
  today: string,
): HistoryState {
  const [state, setState] = useState<HistoryState>(() => {
    const cached = loadHistory(store)
    return { series: cached?.series ?? {}, error: null, loading: cached?.day !== today }
  })

  useEffect(() => {
    const cached = loadHistory(store)
    if (cached && cached.day === today && SYMBOLS.every((s) => cached.series[s]?.length)) {
      setState({ series: cached.series, error: null, loading: false })
      return
    }
    const getHistory = makePrices(token).getHistory
    if (!getHistory) {
      setState((s) => ({ ...s, error: 'Histórico indisponível.', loading: false }))
      return
    }
    let alive = true
    Promise.all(SYMBOLS.map(async (s) => [s, await getHistory(s)] as const))
      .then((pairs) => {
        if (!alive) return
        const series = Object.fromEntries(pairs)
        saveHistory({ day: today, series }, store)
        setState({ series, error: null, loading: false })
      })
      .catch((e: unknown) => {
        if (!alive) return
        const reason = e instanceof Error ? e.message : 'erro desconhecido'
        setState((s) => ({ ...s, error: `Não deu para buscar o histórico: ${reason}.`, loading: false }))
      })
    return () => {
      alive = false
    }
  }, [makePrices, token, store, today])

  return state
}
