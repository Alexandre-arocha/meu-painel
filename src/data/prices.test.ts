import { createBrapiProvider, isStale } from './prices'

const NOW = new Date('2026-10-28T14:00:00Z') // quarta, 11:00 em Brasília

function fakeFetch(opts: { quoteStatus?: number; historicalOk?: boolean } = {}) {
  return (async (url: string) => {
    const u = String(url)
    if (u.includes('/quote')) {
      const status = opts.quoteStatus ?? 200
      return {
        ok: status === 200,
        status,
        json: async () => ({
          results: [
            {
              requestedSymbol: 'BBAS3',
              symbol: 'BBAS3',
              changed: false,
              data: {
                regularMarketPrice: 30,
                regularMarketChangePercent: 1.5,
                regularMarketTime: '2026-10-28T13:58:00Z',
              },
            },
          ],
        }),
      }
    }
    if (opts.historicalOk === false) return { ok: false, status: 403, json: async () => ({}) }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        results: [{ symbol: 'BBAS3', data: [{ date: 1793196000, close: 29.5 }] }],
      }),
    }
  }) as unknown as typeof fetch
}

test('getQuotes converte a resposta em Quote', async () => {
  const provider = createBrapiProvider('tok', fakeFetch(), () => NOW)
  const [q] = await provider.getQuotes(['BBAS3'])
  expect(q).toMatchObject({
    symbol: 'BBAS3',
    price: 30,
    changePct: 1.5,
    updatedAt: '2026-10-28T13:58:00Z',
    stale: false,
  })
  expect(q.intraday).toEqual([{ t: new Date(1793196000 * 1000).toISOString(), p: 29.5 }])
})

test('getQuotes devolve a cotação com intraday vazio se o histórico falhar', async () => {
  const provider = createBrapiProvider('tok', fakeFetch({ historicalOk: false }), () => NOW)
  const [q] = await provider.getQuotes(['BBAS3'])
  expect(q.price).toBe(30)
  expect(q.intraday).toEqual([])
})

test('sem token lança erro "token ausente"', async () => {
  const provider = createBrapiProvider(undefined, fakeFetch(), () => NOW)
  await expect(provider.getQuotes(['BBAS3'])).rejects.toThrow('token ausente')
})

test('resposta 401 lança erro "token inválido"', async () => {
  const provider = createBrapiProvider('ruim', fakeFetch({ quoteStatus: 401 }), () => NOW)
  await expect(provider.getQuotes(['BBAS3'])).rejects.toThrow('token inválido')
})

test('isStale é true com 20 min de atraso em dia útil às 11h', () => {
  expect(isStale('2026-10-28T13:40:00Z', NOW)).toBe(true)
})

test('isStale é false com 5 min de atraso em dia útil às 11h', () => {
  expect(isStale('2026-10-28T13:55:00Z', NOW)).toBe(false)
})

test('isStale é false com mercado fechado no sábado', () => {
  expect(isStale('2026-10-30T20:00:00Z', new Date('2026-10-31T15:00:00Z'))).toBe(false)
})
