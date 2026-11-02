import { renderHook, waitFor } from '@testing-library/react'
import type { Markets } from '../data/markets'
import type { Point } from '../data/prices'
import { loadBenchmarks, saveBenchmarks } from '../data/storage'
import { useBenchmarks } from './useBenchmarks'

const TODAY = '2026-11-02'
const day = (d: number, p: number): Point => ({ t: new Date(Date.UTC(2026, 9, d, 15)).toISOString(), p })

function markets(over: Partial<Markets> = {}) {
  const asked: string[] = []
  const m: Markets = {
    chart: async (symbol, range) => {
      asked.push(`${symbol} ${range}`)
      return { currency: 'BRL', price: 1, changePct: 0, updatedAt: null, name: null, points: [day(28, 130000)] }
    },
    crypto: async () => [],
    cryptoHistory: async () => [],
    findCrypto: async () => null,
    fx: async () => [],
    fxHistory: async () => [],
    cdi: async (today) => {
      asked.push(`cdi ${today}`)
      return [day(28, 0.05)]
    },
    ...over,
  }
  return { m, asked }
}

beforeEach(() => localStorage.clear())

test('busca o Ibovespa e o CDI uma vez por dia, junta ao guardado e guarda', async () => {
  saveBenchmarks({ series: { ibov: [day(27, 129000)] }, fetched: {} })
  const { m, asked } = markets()
  const { result } = renderHook(() => useBenchmarks({ markets: m, store: localStorage, today: TODAY }))
  await waitFor(() => expect(result.current.cdi).toEqual([day(28, 0.05)]))
  expect(result.current.ibov).toEqual([day(27, 129000), day(28, 130000)])
  expect([...asked].sort()).toEqual(['^BVSP 5y', `cdi ${TODAY}`])
  expect(loadBenchmarks().fetched).toEqual({ ibov: TODAY, cdi: TODAY })
})

test('com o guardado de hoje, não busca de novo', () => {
  const saved = { ibov: [day(28, 130000)], cdi: [day(28, 0.05)] }
  saveBenchmarks({ series: saved, fetched: { ibov: TODAY, cdi: TODAY } })
  const { m, asked } = markets()
  const { result } = renderHook(() => useBenchmarks({ markets: m, store: localStorage, today: TODAY }))
  expect(result.current).toEqual(saved)
  expect(asked).toEqual([])
})

test('se o CDI falhar, fica o guardado, o Ibovespa segue e amanhã tenta de novo', async () => {
  saveBenchmarks({ series: { cdi: [day(27, 0.05)] }, fetched: {} })
  const { m } = markets({
    cdi: async () => {
      throw new Error('erro ao buscar o CDI (500)')
    },
  })
  const { result } = renderHook(() => useBenchmarks({ markets: m, store: localStorage, today: TODAY }))
  await waitFor(() => expect(result.current.ibov).toEqual([day(28, 130000)]))
  expect(result.current.cdi).toEqual([day(27, 0.05)])
  expect(loadBenchmarks().fetched).toEqual({ ibov: TODAY })
})
