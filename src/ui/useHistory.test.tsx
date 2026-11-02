import { renderHook, waitFor } from '@testing-library/react'
import type { Chart, Markets } from '../data/markets'
import type { Point, PriceProvider } from '../data/prices'
import { loadPrices, savePrices } from '../data/storage'
import type { Position } from '../domain/portfolio'
import { useHistory } from './useHistory'

const TODAY = '2026-10-29'
const day = (d: number, p: number, hour = 13): Point => ({ t: new Date(Date.UTC(2026, 9, d, hour)).toISOString(), p })
const chartOf = (points: Point[]): Chart => ({ currency: 'BRL', price: 1, changePct: 0, updatedAt: null, name: null, points })
const bbas3: Position = { id: '1', kind: 'acao', symbol: 'BBAS3', quantity: 10 }

function deps(over: Partial<Markets> = {}, brapi: Partial<PriceProvider> = {}) {
  const asked: string[] = []
  const markets: Markets = {
    chart: async (symbol, range) => {
      asked.push(`${symbol} ${range}`)
      return null
    },
    crypto: async () => [],
    cryptoHistory: async () => [],
    findCrypto: async () => null,
    fx: async () => [],
    fxHistory: async () => [],
    cdi: async () => [],
    sgsLast: async () => [],
    ...over,
  }
  const provider: PriceProvider = { getQuotes: async () => [], ...brapi }
  return { asked, deps: { makePrices: () => provider, token: 'tok', markets, store: localStorage, today: TODAY } }
}

beforeEach(() => localStorage.clear())

test('usa o histórico guardado de hoje sem buscar de novo', () => {
  savePrices({ series: { 'b3:BBAS3': [day(27, 10), day(28, 11)] }, fetched: { 'b3:BBAS3': TODAY } })
  const { asked, deps: d } = deps()
  const { result } = renderHook(() => useHistory([bbas3], d))
  expect(result.current).toEqual({ series: { 'b3:BBAS3': [day(27, 10), day(28, 11)] }, error: null, loading: false })
  expect(asked).toEqual([])
})

test('busca 5 anos no Yahoo uma vez por dia, junta ao que estava guardado e guarda', async () => {
  savePrices({ series: { 'b3:BBAS3': [day(26, 9), day(27, 10)] }, fetched: { 'b3:BBAS3': '2026-10-28' } })
  const { asked, deps: d } = deps({
    chart: async (symbol, range) => {
      asked.push(`${symbol} ${range}`)
      return chartOf([day(27, 10.5), day(28, 11)])
    },
  })
  const { result } = renderHook(() => useHistory([bbas3], d))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.series['b3:BBAS3']).toEqual([day(26, 9), day(27, 10.5), day(28, 11)])
  expect(asked).toEqual(['BBAS3.SA 5y'])
  expect(loadPrices().fetched).toEqual({ 'b3:BBAS3': TODAY })
})

test('com o Yahoo fora, usa a brapi na B3 e a AwesomeAPI no câmbio; o que não tem reserva fica guardado e o motivo aparece', async () => {
  savePrices({ series: { 'crypto:bitcoin': [day(27, 400000, 0)] }, fetched: {} })
  const { deps: d } = deps(
    {
      chart: async () => {
        throw new Error('erro ao buscar o histórico (502)')
      },
      cryptoHistory: async () => {
        throw new Error('erro ao buscar o histórico da cripto (429)')
      },
      fxHistory: async (code) => (code === 'EUR' ? [day(28, 6, 22)] : []),
    },
    { getHistory: async () => [day(28, 16)] },
  )
  const positions: Position[] = [
    bbas3,
    { id: '2', kind: 'moeda', symbol: 'EUR', quantity: 100 },
    { id: '3', kind: 'cripto', symbol: 'bitcoin', quantity: 1, name: 'Bitcoin' },
  ]
  const { result } = renderHook(() => useHistory(positions, d))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.series).toEqual({
    'b3:BBAS3': [day(28, 16)],
    'crypto:bitcoin': [day(27, 400000, 0)],
    'fx:EUR': [day(28, 6, 22)],
  })
  expect(result.current.error).toBe('Não deu para buscar o histórico: erro ao buscar o histórico da cripto (429).')
})

test('a série dos EUA sai em reais pelo dólar do dia; o câmbio do Yahoo, marcado às 00:00 UTC, cai no dia certo', async () => {
  const { asked, deps: d } = deps({
    chart: async (symbol, range) => {
      asked.push(`${symbol} ${range}`)
      if (symbol === 'AAPL') return chartOf([day(27, 100, 13), day(28, 110, 13)])
      if (symbol === 'USDBRL=X') return chartOf([day(27, 5, 0), day(28, 6, 0)])
      return null
    },
  })
  const { result } = renderHook(() => useHistory([{ id: '1', kind: 'exterior', symbol: 'AAPL', quantity: 1 }], d))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.series).toEqual({ 'us:AAPL': [day(27, 500), day(28, 660)] })
  expect([...asked].sort()).toEqual(['AAPL 5y', 'USDBRL=X 5y'])
})
