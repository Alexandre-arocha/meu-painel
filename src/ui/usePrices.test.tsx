import { act, renderHook, waitFor } from '@testing-library/react'
import type { Chart, Markets } from '../data/markets'
import type { PriceProvider, Quote } from '../data/prices'
import { loadQuotes, saveQuotes } from '../data/storage'
import type { Position } from '../domain/portfolio'
import { usePrices } from './usePrices'

const quote = (symbol: string, price: number, changePct = 0): Quote => ({ symbol, price, changePct, updatedAt: '2026-10-28T14:00:00.000Z', stale: false })
const chart = (price: number, changePct: number): Chart => ({ currency: 'USD', price, changePct, updatedAt: '2026-10-28T14:00:00.000Z', name: null, points: [] })

const carteira: Position[] = [
  { id: '1', kind: 'acao', symbol: 'PETR4', quantity: 10 },
  { id: '2', kind: 'exterior', symbol: 'AAPL', quantity: 1 },
  { id: '3', kind: 'cripto', symbol: 'bitcoin', quantity: 0.1, name: 'Bitcoin' },
  { id: '4', kind: 'moeda', symbol: 'EUR', quantity: 100 },
  { id: '5', kind: 'renda-fixa', name: 'CDB', amount: 1000, subtype: 'cdb' },
]

function sources(over: Partial<Markets> = {}) {
  const calls = { b3: [] as string[][], fx: [] as string[][], crypto: [] as string[][], chart: [] as string[] }
  const brapi: PriceProvider = {
    getQuotes: async (symbols) => {
      calls.b3.push(symbols)
      return symbols.map((s) => quote(s, 30, 1))
    },
  }
  const markets: Markets = {
    chart: async (symbol) => {
      calls.chart.push(symbol)
      return chart(360, 1)
    },
    crypto: async (ids) => {
      calls.crypto.push(ids)
      return ids.map((id) => quote(`crypto:${id}`, 400000, 2))
    },
    cryptoHistory: async () => [],
    findCrypto: async () => null,
    fx: async (codes) => {
      calls.fx.push(codes)
      return codes.map((c) => quote(`fx:${c}`, c === 'USD' ? 5 : 6, 2))
    },
    fxHistory: async () => [],
    cdi: async () => [],
    ...over,
  }
  return { calls, deps: { makePrices: () => brapi, token: 'tok', markets, store: localStorage, now: () => new Date('2026-10-28T14:00:00Z') } }
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.useRealTimers())

test('busca cada mercado de uma vez e põe o ativo dos EUA em reais pelo dólar', async () => {
  const { calls, deps } = sources()
  const { result } = renderHook(() => usePrices(carteira, deps))
  await waitFor(() => expect(result.current.quotes).toHaveLength(4))
  const by = Object.fromEntries(result.current.quotes.map((q) => [q.symbol, q]))
  expect(by['b3:PETR4'].price).toBe(30)
  expect(by['us:AAPL'].price).toBe(1800)
  expect(by['us:AAPL'].changePct).toBeCloseTo(3.02)
  expect(by['crypto:bitcoin'].price).toBe(400000)
  expect(by['fx:EUR'].price).toBe(6)
  // O dólar entra só para converter: não é uma posição.
  expect(by['fx:USD']).toBeUndefined()
  expect(calls).toEqual({ b3: [['PETR4']], fx: [['EUR', 'USD']], crypto: [['bitcoin']], chart: ['AAPL'] })
  expect(result.current.error).toBeNull()
  expect(loadQuotes().map((q) => q.symbol)).toEqual(['b3:PETR4', 'crypto:bitcoin', 'fx:EUR', 'us:AAPL'])
})

test('fonte que falha fica com o último preço guardado, marcado como velho, e diz o motivo', async () => {
  saveQuotes([quote('crypto:bitcoin', 390000)])
  const { deps } = sources({
    crypto: async () => {
      throw new Error('erro ao buscar as criptos (429)')
    },
  })
  const { result } = renderHook(() => usePrices(carteira, deps))
  await waitFor(() => expect(result.current.error).toBe('erro ao buscar as criptos (429)'))
  const by = Object.fromEntries(result.current.quotes.map((q) => [q.symbol, q]))
  expect(by['crypto:bitcoin']).toMatchObject({ price: 390000, stale: true })
  expect(by['b3:PETR4']).toMatchObject({ price: 30, stale: false })
})

test('sem o dólar, o ativo dos EUA fica sem preço e o motivo aparece', async () => {
  const { deps } = sources({ fx: async () => [] })
  const { result } = renderHook(() => usePrices([carteira[1]], deps))
  await waitFor(() => expect(result.current.error).toBe('sem a cotação do dólar'))
  expect(result.current.quotes).toEqual([])
})

test('atualiza de 15 em 15 minutos com a aba visível; com o pregão fechado, a brapi não é chamada de novo', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const { calls, deps } = sources()
  const saturday = { ...deps, now: () => new Date('2026-10-31T15:00:00Z') }
  renderHook(() => usePrices(carteira, saturday))
  await waitFor(() => expect(calls.crypto).toHaveLength(1))
  await act(() => vi.advanceTimersByTimeAsync(15 * 60_000))
  expect(calls.crypto).toHaveLength(2)
  expect(calls.b3).toHaveLength(1)
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  await act(() => vi.advanceTimersByTimeAsync(15 * 60_000))
  expect(calls.crypto).toHaveLength(2)
  hidden.mockRestore()
})

test('carteira só com valor digitado não busca preço nenhum', async () => {
  const { calls, deps } = sources()
  const { result } = renderHook(() => usePrices([carteira[4]], deps))
  await waitFor(() => expect(result.current.quotes).toEqual([]))
  expect(calls).toEqual({ b3: [], fx: [], crypto: [], chart: [] })
})
