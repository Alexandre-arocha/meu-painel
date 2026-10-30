import { createBrapiProvider, createProxyPriceProvider, isStale } from './prices'

const NOW = new Date('2026-10-28T14:00:00Z') // quarta, 11:00 em Brasília

// Responde só cotações: o app não pede mais o gráfico do dia, que o plano grátis recusa.
function fakeFetch(opts: { quoteStatus?: number } = {}) {
  return (async (url: string) => {
    const status = opts.quoteStatus ?? 200
    const symbol = new URL(String(url), 'http://x').searchParams.get('symbols') ?? ''
    return {
      ok: status === 200,
      status,
      json: async () => ({
        results: [
          {
            requestedSymbol: symbol,
            symbol,
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
  }) as unknown as typeof fetch
}

test('getQuotes converte a resposta em Quote', async () => {
  const provider = createBrapiProvider('tok', fakeFetch(), () => NOW)
  const [q] = await provider.getQuotes(['BBAS3'])
  expect(q).toEqual({
    symbol: 'BBAS3',
    price: 30,
    changePct: 1.5,
    updatedAt: '2026-10-28T13:58:00Z',
    stale: false,
  })
})

test('getQuotes ignora cotação sem preço válido em vez de devolver NaN', async () => {
  const data: Record<string, unknown> = {
    BBAS3: { regularMarketPrice: null, regularMarketChangePercent: 1, regularMarketTime: '2026-10-28T13:58:00Z' },
    B3SA3: { regularMarketPrice: 12.3, regularMarketChangePercent: -0.4, regularMarketTime: '2026-10-28T13:58:00Z' },
  }
  const f = (async (url: string) => {
    const symbol = new URL(String(url), 'http://x').searchParams.get('symbols') ?? ''
    return { ok: true, status: 200, json: async () => ({ results: [{ symbol, data: data[symbol] }] }) }
  }) as unknown as typeof fetch
  const qs = await createBrapiProvider('tok', f, () => NOW).getQuotes(['BBAS3', 'B3SA3'])
  expect(qs.map((q) => q.symbol)).toEqual(['B3SA3'])
})

test('provedor do servidor chama /api/brapi sem Authorization', async () => {
  const calls: { url: string; auth: string | null }[] = []
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), auth: new Headers(init?.headers).get('authorization') })
    return fakeFetch()(url)
  }) as unknown as typeof fetch
  const [q] = await createProxyPriceProvider(f, () => NOW).getQuotes(['BBAS3'])
  expect(q.price).toBe(30)
  expect(calls[0]).toEqual({ url: '/api/brapi/quote?symbols=BBAS3', auth: null })
})

test('getQuotes pede só a cotação, um ativo por chamada: o plano grátis aceita 1 e recusa o gráfico do dia', async () => {
  const urls: string[] = []
  const f = (async (url: string) => {
    urls.push(String(url))
    return fakeFetch()(url)
  }) as unknown as typeof fetch
  const qs = await createProxyPriceProvider(f, () => NOW).getQuotes(['BBAS3', 'B3SA3'])
  expect(urls).toEqual(['/api/brapi/quote?symbols=BBAS3', '/api/brapi/quote?symbols=B3SA3'])
  expect(qs.map((q) => q.symbol)).toEqual(['BBAS3', 'B3SA3'])
})

test('erro da brapi mostra o motivo que ela devolve', async () => {
  const f = (async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: true, message: 'Seu plano permite no máximo 1 ativo(s) por requisição.' }),
  })) as unknown as typeof fetch
  await expect(createProxyPriceProvider(f, () => NOW).getQuotes(['BBAS3'])).rejects.toThrow(
    'erro ao buscar preços (400): Seu plano permite no máximo 1 ativo(s) por requisição.',
  )
})

test('getHistory pede 3 meses de fechamentos ajustados por proventos, do mais antigo ao mais novo', async () => {
  const urls: string[] = []
  const f = (async (url: string) => {
    urls.push(String(url))
    return {
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            symbol: 'BBAS3',
            data: {
              // A brapi manda do mais novo para o mais antigo.
              historicalDataPrice: [
                { date: 1793368800, close: 30 },
                { date: 1793282400, close: null, adjustedClose: null },
                { date: 1793196000, close: 29.5, adjustedClose: 29.1 },
              ],
            },
          },
        ],
      }),
    }
  }) as unknown as typeof fetch
  const points = await createProxyPriceProvider(f, () => NOW).getHistory!('BBAS3')
  expect(urls).toEqual(['/api/brapi/historical?symbols=BBAS3&range=3mo&interval=1d'])
  expect(points).toEqual([
    { t: new Date(1793196000 * 1000).toISOString(), p: 29.1 },
    { t: new Date(1793368800 * 1000).toISOString(), p: 30 },
  ])
})

test('getHistory com erro traz o motivo da brapi', async () => {
  const f = (async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: true, message: 'Intervalo não permitido.' }),
  })) as unknown as typeof fetch
  await expect(createProxyPriceProvider(f, () => NOW).getHistory!('BBAS3')).rejects.toThrow(
    'erro ao buscar histórico (400): Intervalo não permitido.',
  )
})

test('503 do servidor vira mensagem de token não cadastrado', async () => {
  const f = (async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch
  await expect(createProxyPriceProvider(f, () => NOW).getQuotes(['BBAS3'])).rejects.toThrow('token da brapi não cadastrado na Vercel')
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
