import { renderHook, waitFor } from '@testing-library/react'
import type { Point, PriceProvider } from '../data/prices'
import { loadHistory, saveHistory } from '../data/storage'
import { useHistory } from './useHistory'

const TODAY = '2026-10-29'
const points: Point[] = [
  { t: '2026-10-27T03:00:00.000Z', p: 10 },
  { t: '2026-10-28T03:00:00.000Z', p: 11 },
]

const counting =
  (calls: string[]) =>
  (): PriceProvider => ({
    getQuotes: async () => [],
    getHistory: async (symbol) => {
      calls.push(symbol)
      return points
    },
  })

beforeEach(() => localStorage.clear())

test('usa o histórico guardado de hoje sem buscar de novo', () => {
  saveHistory({ day: TODAY, series: { BBAS3: points, B3SA3: points } })
  const calls: string[] = []
  const makePrices = counting(calls)
  const { result } = renderHook(() => useHistory(makePrices, 'tok', localStorage, TODAY))
  expect(result.current).toEqual({ series: { BBAS3: points, B3SA3: points }, error: null, loading: false })
  expect(calls).toEqual([])
})

test('histórico guardado de outro dia é buscado de novo, uma vez por ativo, e guardado', async () => {
  saveHistory({ day: '2026-10-28', series: { BBAS3: points, B3SA3: points } })
  const calls: string[] = []
  const makePrices = counting(calls)
  const { result } = renderHook(() => useHistory(makePrices, 'tok', localStorage, TODAY))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(loadHistory()?.day).toBe(TODAY)
  expect([...calls].sort()).toEqual(['B3SA3', 'BBAS3'])
})

test('busca que falha fica com o histórico guardado e diz o motivo', async () => {
  saveHistory({ day: '2026-10-28', series: { BBAS3: points, B3SA3: points } })
  const failing = (): PriceProvider => ({
    getQuotes: async () => [],
    getHistory: async () => {
      throw new Error('erro ao buscar histórico (500)')
    },
  })
  const { result } = renderHook(() => useHistory(failing, 'tok', localStorage, TODAY))
  await waitFor(() => expect(result.current.error).toBe('Não deu para buscar o histórico: erro ao buscar histórico (500).'))
  expect(result.current.series.BBAS3).toEqual(points)
})

test('sem getHistory avisa que o histórico está indisponível', async () => {
  const none = (): PriceProvider => ({ getQuotes: async () => [] })
  const { result } = renderHook(() => useHistory(none, 'tok', localStorage, TODAY))
  await waitFor(() => expect(result.current.error).toBe('Histórico indisponível.'))
})
