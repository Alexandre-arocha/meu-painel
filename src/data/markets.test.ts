import { cleanName, createMarkets, inReais, lookupAsset, type Chart, type Markets } from './markets'
import type { PriceProvider, Quote } from './prices'

// fetch falso: responde pela primeira rota cujo trecho aparece na URL; o resto é 404.
function fake(routes: Record<string, unknown>) {
  const calls: string[] = []
  const fetchFn = (async (url: string) => {
    calls.push(String(url))
    const hit = Object.entries(routes).find(([part]) => String(url).includes(part))
    if (!hit) return new Response('{}', { status: 404 })
    return typeof hit[1] === 'number' ? new Response('{}', { status: hit[1] }) : new Response(JSON.stringify(hit[1]), { status: 200 })
  }) as unknown as typeof fetch
  return { fetchFn, calls }
}

test('cdi pede 6 anos ao Banco Central com tempo limite e marca cada dia ao meio-dia UTC', async () => {
  let asked: { url: string; init?: RequestInit } | undefined
  const fetchFn = (async (url: string, init?: RequestInit) => {
    asked = { url, init }
    return new Response(JSON.stringify([{ data: '03/11/2021', valor: '0.029256' }, { data: 'x', valor: '1' }, { data: '04/11/2021', valor: 'abc' }]))
  }) as unknown as typeof fetch
  expect(await createMarkets(fetchFn).cdi('2026-11-02')).toEqual([{ t: '2021-11-03T12:00:00.000Z', p: 0.029256 }])
  expect(asked!.url).toContain('bcdata.sgs.12/dados?formato=json&dataInicial=02/11/2020&dataFinal=02/11/2026')
  expect(asked!.init?.signal).toBeInstanceOf(AbortSignal)
})

test('sgsLast pede os últimos valores da série ao Banco Central', async () => {
  const { fetchFn, calls } = fake({ 'bcdata.sgs.432': [{ data: '02/11/2026', valor: '13.25' }] })
  expect(await createMarkets(fetchFn).sgsLast(432, 1)).toEqual([{ t: '2026-11-02T12:00:00.000Z', p: 13.25 }])
  expect(calls[0]).toContain('bcdata.sgs.432/dados/ultimos/1?formato=json')
})

const historyBody = {
  currency: 'BRL',
  price: 16.5,
  changePct: 0.6,
  updatedAt: '2026-10-30T20:05:34.000Z',
  name: 'Banco do Brasil S.A.',
  t: ['2026-10-29T13:00:00.000Z', '2026-10-30T13:00:00.000Z'],
  c: [16.4, 16.5],
}

test('chart pede /api/history e transforma t e c em pontos; 404 vira null; 401 pede para entrar de novo', async () => {
  const { fetchFn, calls } = fake({ 'BBAS3.SA': historyBody, 'symbol=XX': 401 })
  const m = createMarkets(fetchFn)
  expect(await m.chart('BBAS3.SA', '5y')).toEqual({
    currency: 'BRL',
    price: 16.5,
    changePct: 0.6,
    updatedAt: '2026-10-30T20:05:34.000Z',
    name: 'Banco do Brasil S.A.',
    points: [
      { t: '2026-10-29T13:00:00.000Z', p: 16.4 },
      { t: '2026-10-30T13:00:00.000Z', p: 16.5 },
    ],
  })
  expect(calls[0]).toBe('/api/history?symbol=BBAS3.SA&range=5y')
  expect(await m.chart('ZZZZ.SA', '5d')).toBeNull()
  await expect(m.chart('XX', '5d')).rejects.toThrow('sessão expirada; entre de novo')
})

test('crypto busca todas numa chamada da CoinGecko, em reais; a desconhecida fica de fora', async () => {
  const { fetchFn, calls } = fake({
    'simple/price': { bitcoin: { brl: 422929, brl_24h_change: 0.75, last_updated_at: 1793509758 } },
  })
  expect(await createMarkets(fetchFn).crypto(['bitcoin', 'naoexiste'])).toEqual([
    { symbol: 'crypto:bitcoin', price: 422929, changePct: 0.75, updatedAt: new Date(1793509758000).toISOString(), stale: false },
  ])
  expect(calls).toEqual([
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,naoexiste&vs_currencies=brl&include_24hr_change=true&include_last_updated_at=true',
  ])
})

test('findCrypto acha pelo código ou pelo id e devolve o id e o nome', async () => {
  const coins = { coins: [{ id: 'ethereum', symbol: 'ETH', name: 'Ethereum' }, { id: 'tether', symbol: 'USDT', name: 'Tether' }] }
  const m = createMarkets(fake({ 'search?query=': coins }).fetchFn)
  expect(await m.findCrypto('eth')).toEqual({ id: 'ethereum', name: 'Ethereum' })
  expect(await m.findCrypto('tether')).toEqual({ id: 'tether', name: 'Tether' })
  expect(await m.findCrypto('xyz')).toBeNull()
})

test('fx busca as moedas numa chamada da AwesomeAPI; moeda desconhecida (404) vira lista vazia', async () => {
  const { fetchFn, calls } = fake({
    'last/USD-BRL,EUR-BRL': {
      USDBRL: { bid: '5.4397', pctChange: '1.017659', timestamp: '1793397608' },
      EURBRL: { bid: '6.0846', pctChange: '1.054624', timestamp: '1793397706' },
    },
  })
  const m = createMarkets(fetchFn)
  expect(await m.fx(['USD', 'EUR'])).toEqual([
    { symbol: 'fx:USD', price: 5.4397, changePct: 1.017659, updatedAt: new Date(1793397608000).toISOString(), stale: false },
    { symbol: 'fx:EUR', price: 6.0846, changePct: 1.054624, updatedAt: new Date(1793397706000).toISOString(), stale: false },
  ])
  expect(calls[0]).toBe('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL')
  expect(await m.fx(['XYZ'])).toEqual([])
})

test('históricos da CoinGecko (365 dias) e da AwesomeAPI (90 dias) chegam do mais antigo ao mais novo', async () => {
  const m = createMarkets(
    fake({
      'coins/bitcoin/market_chart?vs_currency=brl&days=365&interval=daily': { prices: [[1793318400000, 420000], [1793404800000, 422000]] },
      'daily/USD-BRL/90': [
        { bid: '5.4397', timestamp: '1793397608' },
        { bid: '5.3849', timestamp: '1793317363' },
      ],
    }).fetchFn,
  )
  expect(await m.cryptoHistory('bitcoin')).toEqual([
    { t: new Date(1793318400000).toISOString(), p: 420000 },
    { t: new Date(1793404800000).toISOString(), p: 422000 },
  ])
  expect(await m.fxHistory('USD')).toEqual([
    { t: new Date(1793317363000).toISOString(), p: 5.3849 },
    { t: new Date(1793397608000).toISOString(), p: 5.4397 },
  ])
})

test('inReais multiplica pelo dólar e soma a variação do ativo à do dólar', () => {
  const chart: Chart = { currency: 'USD', price: 360, changePct: 1, updatedAt: '2026-10-30T20:00:01.000Z', name: 'Apple Inc.', points: [] }
  const usd: Quote = { symbol: 'fx:USD', price: 5, changePct: 2, updatedAt: '2026-10-30T22:00:00.000Z', stale: false }
  const q = inReais('AAPL', chart, usd)
  expect(q).toMatchObject({ symbol: 'us:AAPL', price: 1800, updatedAt: '2026-10-30T20:00:01.000Z', stale: false })
  expect(q.changePct).toBeCloseTo(3.02)
})

const markets = (over: Partial<Markets> = {}): Markets => ({
  chart: async () => null,
  crypto: async () => [],
  cryptoHistory: async () => [],
  findCrypto: async () => null,
  fx: async () => [],
  fxHistory: async () => [],
  cdi: async () => [],
  sgsLast: async () => [],
  ...over,
})
const chartOf = (over: Partial<Chart> = {}): Chart => ({ currency: 'BRL', price: 1, changePct: 0, updatedAt: null, name: null, points: [], ...over })

test('lookupAsset confere na B3 e nos EUA pelo histórico e guarda o nome sem a razão social', async () => {
  const asked: string[] = []
  const m = markets({
    chart: async (symbol) => {
      asked.push(symbol)
      if (symbol === 'PETR4.SA') return chartOf({ name: 'Petróleo Brasileiro S.A. - Petrobras' })
      if (symbol === 'AAPL') return chartOf({ currency: 'USD', name: 'Apple Inc.' })
      if (symbol === 'VOD') return chartOf({ currency: 'GBp' })
      return null
    },
  })
  expect(await lookupAsset('acao', 'PETR4', m)).toEqual({ ok: true, symbol: 'PETR4', name: 'Petróleo Brasileiro' })
  expect(await lookupAsset('exterior', 'AAPL', m)).toEqual({ ok: true, symbol: 'AAPL', name: 'Apple' })
  expect(await lookupAsset('exterior', 'VOD', m)).toEqual({ ok: false, error: 'só ativos dos EUA, cotados em dólar' })
  expect(await lookupAsset('fii', 'ZZZZ11', m)).toEqual({ ok: false, error: 'código não encontrado na B3' })
  expect(asked).toEqual(['PETR4.SA', 'AAPL', 'VOD', 'ZZZZ11.SA'])
})

test('lookupAsset resolve a cripto pelo id, confere a moeda e explica quando a consulta falha', async () => {
  const m = markets({
    findCrypto: async (q) => (q === 'btc' ? { id: 'bitcoin', name: 'Bitcoin' } : null),
    fx: async (codes) => (codes[0] === 'USD' ? [{ symbol: 'fx:USD', price: 5, changePct: 0, updatedAt: '', stale: false }] : []),
  })
  expect(await lookupAsset('cripto', 'btc', m)).toEqual({ ok: true, symbol: 'bitcoin', name: 'Bitcoin' })
  expect(await lookupAsset('cripto', 'xyz', m)).toEqual({ ok: false, error: 'cripto não encontrada' })
  expect(await lookupAsset('moeda', 'USD', m)).toEqual({ ok: true, symbol: 'USD' })
  expect(await lookupAsset('moeda', 'XYZ', m)).toEqual({ ok: false, error: 'moeda não encontrada' })
  const down = markets({
    chart: async () => {
      throw new Error('erro ao buscar o histórico (502)')
    },
  })
  expect(await lookupAsset('exterior', 'AAPL', down)).toEqual({
    ok: false,
    error: 'não deu para conferir agora (erro ao buscar o histórico (502)); tente de novo',
  })
})

test('lookupAsset da B3 confere pela brapi quando o Yahoo falha', async () => {
  const down = markets({
    chart: async () => {
      throw new Error('erro ao buscar o histórico (502)')
    },
  })
  const brapi: PriceProvider = {
    getQuotes: async (symbols) => symbols.filter((s) => s === 'BBAS3').map((s) => ({ symbol: s, price: 16, changePct: 0, updatedAt: '', stale: false })),
  }
  expect(await lookupAsset('acao', 'BBAS3', down, brapi)).toEqual({ ok: true, symbol: 'BBAS3' })
  expect(await lookupAsset('acao', 'ZZZZ3', down, brapi)).toEqual({ ok: false, error: 'código não encontrado na B3' })
})

test('cleanName tira a razão social e o que vem depois do travessão', () => {
  expect(cleanName('Banco do Brasil S.A.')).toBe('Banco do Brasil')
  expect(cleanName('B3 S.A. - Brasil, Bolsa, Balcão')).toBe('B3')
  expect(cleanName('Cshg Logistica - Fundo De Investimento Imobiliario')).toBe('Cshg Logistica')
  expect(cleanName('Apple Inc.')).toBe('Apple')
  expect(cleanName('NVIDIA Corporation')).toBe('NVIDIA')
  expect(cleanName(null)).toBeUndefined()
})
