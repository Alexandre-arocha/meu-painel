import { useEffect, useState } from 'react'
import type { PriceProvider, Quote } from '../data/prices'
import { loadQuotes, saveQuotes } from '../data/storage'

export const SYMBOLS = ['BBAS3', 'B3SA3']
// 4 chamadas à brapi por atualização (cotação e histórico dos 2 ativos): de 15 em 15 min cabe na cota
// grátis de 15 mil chamadas por mês mesmo com a aba aberta o dia todo.
const REFRESH_MS = 15 * 60_000

// Busca os preços ao abrir e de 15 em 15 min. Se falhar, mostra os últimos salvos marcados como velhos.
export function useQuotes(
  makePrices: (token: string | undefined) => PriceProvider,
  token: string | undefined,
  store: Storage,
): { quotes: Quote[]; error: string | null } {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const q = await makePrices(token).getQuotes(SYMBOLS)
        if (!alive) return
        setQuotes(q)
        saveQuotes(q, store)
        setError(null)
      } catch (e) {
        if (!alive) return
        setQuotes(loadQuotes(store).map((q) => ({ ...q, stale: true })))
        setError(e instanceof Error ? e.message : 'erro ao buscar preços')
      }
    }
    void load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [makePrices, token, store])

  return { quotes, error }
}
