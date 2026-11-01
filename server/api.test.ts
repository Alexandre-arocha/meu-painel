// @vitest-environment node
import {
  handleBrapi,
  handleData,
  handleFeed,
  handleHistory,
  handleLogin,
  handleLogout,
  handleNews,
  handleSession,
  handleTranslate,
  type Deps,
  type Kv,
} from './api.js'
import { SESSION_COOKIE, signSession } from './session.js'

const SECRET = 'senha-de-teste' // valor de teste
const NOW = Date.UTC(2026, 9, 28, 12)

const memoryKv = (): Kv & { data: Record<string, unknown> } => {
  const data: Record<string, unknown> = {}
  return {
    data,
    all: async () => ({ ...data }),
    put: async (k, v) => {
      data[k] = v
    },
  }
}
const deps = (over: Partial<Deps> = {}): Deps => ({
  env: { APP_PASSWORD: SECRET, BRAPI_TOKEN: 'token-de-teste' },
  now: () => NOW,
  delay: async () => {},
  ...over,
})
const withSession = async (url: string, init: RequestInit = {}) =>
  new Request(url, { ...init, headers: { cookie: `${SESSION_COOKIE}=${await signSession(SECRET, NOW)}` } })
const login = (password: unknown) => new Request('https://x/api/login', { method: 'POST', body: JSON.stringify({ password }) })
const put = (body: unknown) => withSession('https://x/api/data', { method: 'PUT', body: JSON.stringify(body) })

test('login com senha certa devolve cookie', async () => {
  const res = await handleLogin(login(SECRET), deps())
  expect(res.status).toBe(204)
  expect(res.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=`)
})

test('login errado espera 400 ms e devolve 401', async () => {
  const waits: number[] = []
  const res = await handleLogin(login('errada'), deps({ delay: async (ms) => void waits.push(ms) }))
  expect(res.status).toBe(401)
  expect(waits).toEqual([400])
  expect(res.headers.get('set-cookie')).toBeNull()
})

test('sem APP_PASSWORD o login devolve 500', async () => {
  expect((await handleLogin(login('x'), deps({ env: {} }))).status).toBe(500)
})

test('rotas protegidas sem sessão devolvem 401', async () => {
  const d = deps({ kv: memoryKv })
  const responses = [
    await handleSession(new Request('https://x/api/session'), d),
    await handleData(new Request('https://x/api/data'), d),
    await handleNews(new Request('https://x/api/news/search?q=Selic'), d),
    await handleBrapi(new Request('https://x/api/brapi/quote?symbols=BBAS3'), 'quote', d),
  ]
  for (const res of responses) expect(res.status).toBe(401)
  expect(handleLogout().headers.get('set-cookie')).toContain('Max-Age=0')
})

test('data GET devolve os itens e PUT grava chave permitida', async () => {
  const kv = memoryKv()
  const d = deps({ kv: () => kv })
  expect((await handleData(await put({ key: 'painel:v1:events', value: [{ id: '1' }] }), d)).status).toBe(204)
  const get = await handleData(await withSession('https://x/api/data'), d)
  expect(await get.json()).toEqual({ items: { 'painel:v1:events': [{ id: '1' }] } })
})

test('data PUT recusa chave fora da lista e corpo acima de 1 MB', async () => {
  const kv = memoryKv()
  const d = deps({ kv: () => kv })
  expect((await handleData(await put({ key: 'painel:v1:lastNews', value: [] }), d)).status).toBe(400)
  expect((await handleData(await put({ key: 'painel:v1:events', value: 'x'.repeat(1_000_001) }), d)).status).toBe(400)
  expect(kv.data).toEqual({})
})

test('news busca no Google Notícias com q e devolve XML', async () => {
  const urls: string[] = []
  const fetchFn = (async (url: string) => {
    urls.push(String(url))
    return new Response('<rss/>', { status: 200 })
  }) as unknown as typeof fetch
  const res = await handleNews(await withSession('https://x/api/news/search?q=Selic&hl=pt-BR'), deps({ fetchFn }))
  expect(res.status).toBe(200)
  expect(await res.text()).toBe('<rss/>')
  expect(urls).toEqual(['https://news.google.com/rss/search?q=Selic&hl=pt-BR&gl=BR&ceid=BR:pt-419'])
})

test('news recusa q vazio ou acima de 100 caracteres', async () => {
  expect((await handleNews(await withSession('https://x/api/news/search?q='), deps())).status).toBe(400)
  expect((await handleNews(await withSession(`https://x/api/news/search?q=${'a'.repeat(101)}`), deps())).status).toBe(400)
})

test('brapi repassa a query com o token do servidor e só aceita quote e historical', async () => {
  const calls: { url: string; auth: string | null }[] = []
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), auth: new Headers(init?.headers).get('authorization') })
    return new Response('{"results":[]}', { status: 200 })
  }) as unknown as typeof fetch
  const res = await handleBrapi(await withSession('https://x/api/brapi/quote?symbols=BBAS3,B3SA3'), 'quote', deps({ fetchFn }))
  expect(res.status).toBe(200)
  expect(calls).toEqual([{ url: 'https://brapi.dev/api/v2/stocks/quote?symbols=BBAS3,B3SA3', auth: 'Bearer token-de-teste' }])
  expect((await handleBrapi(await withSession('https://x/api/brapi/list'), 'list', deps({ fetchFn }))).status).toBe(404)
})

test('feed exige sessão, aceita só ids da lista e devolve o RSS', async () => {
  const urls: string[] = []
  const fetchFn = (async (url: string) => {
    urls.push(String(url))
    return new Response('<rss/>', { status: 200 })
  }) as unknown as typeof fetch
  expect((await handleFeed(new Request('https://x/api/news/feed?src=bbc-world'), deps({ fetchFn }))).status).toBe(401)
  for (const bad of ['https://evil.test/feed', 'toString', '']) {
    expect((await handleFeed(await withSession(`https://x/api/news/feed?src=${encodeURIComponent(bad)}`), deps({ fetchFn }))).status).toBe(404)
  }
  const res = await handleFeed(await withSession('https://x/api/news/feed?src=bbc-world'), deps({ fetchFn }))
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toContain('xml')
  expect(await res.text()).toBe('<rss/>')
  expect(urls).toEqual(['https://feeds.bbci.co.uk/news/world/rss.xml'])
})

test('feed fora do ar vira 502', async () => {
  const fetchFn = (async () => new Response('x', { status: 503 })) as unknown as typeof fetch
  expect((await handleFeed(await withSession('https://x/api/news/feed?src=g1-economia'), deps({ fetchFn }))).status).toBe(502)
})

const translateReq = async (body: unknown, session = true) => {
  const init = { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }
  return session ? withSession('https://x/api/translate', init) : new Request('https://x/api/translate', init)
}
const deepl = (over: Partial<Deps['env']> = {}) => ({ env: { APP_PASSWORD: SECRET, DEEPL_API_KEY: 'chave-de-teste:fx', ...over } })

test('tradução usa o DeepL Free com a chave do servidor e devolve na mesma ordem', async () => {
  const calls: { url: string; auth: string | null; body: unknown }[] = []
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), auth: new Headers(init?.headers).get('authorization'), body: JSON.parse(String(init?.body)) })
    return new Response(JSON.stringify({ translations: [{ text: 'Olá' }, { text: 'Mundo' }] }), { status: 200 })
  }) as unknown as typeof fetch
  const res = await handleTranslate(await translateReq({ texts: ['Hello', 'World'], source: 'en' }), deps({ ...deepl(), fetchFn }))
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ translations: ['Olá', 'Mundo'] })
  expect(calls).toEqual([
    {
      url: 'https://api-free.deepl.com/v2/translate',
      auth: 'DeepL-Auth-Key chave-de-teste:fx',
      body: { text: ['Hello', 'World'], target_lang: 'PT-BR', source_lang: 'EN' },
    },
  ])
})

test('chave paga do DeepL usa o servidor pago', async () => {
  const urls: string[] = []
  const fetchFn = (async (url: string) => {
    urls.push(String(url))
    return new Response(JSON.stringify({ translations: [{ text: 'Oi' }] }), { status: 200 })
  }) as unknown as typeof fetch
  await handleTranslate(await translateReq({ texts: ['Hi'] }), deps({ ...deepl({ DEEPL_API_KEY: 'chave-paga' }), fetchFn }))
  expect(urls).toEqual(['https://api.deepl.com/v2/translate'])
})

test('tradução recusa sem sessão, pedido inválido e falta de chave', async () => {
  const fetchFn = (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch
  const run = async (body: unknown, over: Partial<Deps> = {}, session = true) =>
    (await handleTranslate(await translateReq(body, session), deps({ ...deepl(), fetchFn, ...over }))).status
  expect(await run({ texts: ['a'] }, {}, false)).toBe(401)
  expect(await run('{{')).toBe(400)
  expect(await run({ texts: 'a' })).toBe(400)
  expect(await run({ texts: [] })).toBe(400)
  expect(await run({ texts: Array.from({ length: 51 }, () => 'a') })).toBe(400)
  expect(await run({ texts: ['a'.repeat(501)] })).toBe(400)
  expect(await run({ texts: ['a'], source: 'inglês' })).toBe(400)
  expect(await run({ texts: ['a'] }, { env: { APP_PASSWORD: SECRET } })).toBe(503)
})

test('cota do DeepL acabada e chave inválida viram mensagens claras', async () => {
  const answer = (status: number) => (async () => new Response('{}', { status })) as unknown as typeof fetch
  const quota = await handleTranslate(await translateReq({ texts: ['a'] }), deps({ ...deepl(), fetchFn: answer(456) }))
  expect(quota.status).toBe(429)
  expect(await quota.json()).toEqual({ error: 'a cota do mês do DeepL acabou' })
  const key = await handleTranslate(await translateReq({ texts: ['a'] }), deps({ ...deepl(), fetchFn: answer(403) }))
  expect(key.status).toBe(502)
  expect(await key.json()).toEqual({ error: 'chave do DeepL inválida' })
})

test('brapi sem BRAPI_TOKEN devolve 503', async () => {
  const res = await handleBrapi(await withSession('https://x/api/brapi/quote?symbols=BBAS3'), 'quote', deps({ env: { APP_PASSWORD: SECRET } }))
  expect(res.status).toBe(503)
})

// Resposta do Yahoo como ela vem: o dia sem pregão chega com null.
const DAYS = [1793106000, 1793192400, 1793278800]
const yahoo = (meta: Record<string, unknown> = {}) =>
  JSON.stringify({
    chart: {
      result: [
        {
          meta: { currency: 'BRL', regularMarketPrice: 16.5, regularMarketChangePercent: 0.61, regularMarketTime: 1793390742, longName: 'Banco do Brasil S.A.', ...meta },
          timestamp: DAYS,
          indicators: { quote: [{ close: [16.1, null, 16.5] }], adjclose: [{ adjclose: [15.9, null, 16.5] }] },
        },
      ],
      error: null,
    },
  })
const iso = (s: number) => new Date(s * 1000).toISOString()

test('histórico exige sessão, aceita só símbolo e período da lista e devolve os fechamentos ajustados', async () => {
  const urls: string[] = []
  const fetchFn = (async (url: string) => {
    urls.push(String(url))
    return new Response(yahoo(), { status: 200 })
  }) as unknown as typeof fetch
  expect((await handleHistory(new Request('https://x/api/history?symbol=BBAS3.SA&range=5y'), deps({ fetchFn }))).status).toBe(401)
  for (const bad of ['symbol=BBAS3.SA&range=1mo', 'symbol=..%2Fx&range=5y', 'symbol=&range=5y', `symbol=${'A'.repeat(21)}&range=5y`]) {
    expect((await handleHistory(await withSession(`https://x/api/history?${bad}`), deps({ fetchFn }))).status).toBe(400)
  }
  const res = await handleHistory(await withSession('https://x/api/history?symbol=BBAS3.SA&range=5y'), deps({ fetchFn }))
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({
    currency: 'BRL',
    price: 16.5,
    changePct: 0.61,
    updatedAt: iso(1793390742),
    name: 'Banco do Brasil S.A.',
    t: [iso(DAYS[0]), iso(DAYS[2])],
    c: [15.9, 16.5],
  })
  await handleHistory(await withSession('https://x/api/history?symbol=%5EBVSP&range=1y'), deps({ fetchFn }))
  await handleHistory(await withSession('https://x/api/history?symbol=USDBRL%3DX&range=5d'), deps({ fetchFn }))
  expect(urls).toEqual([
    'https://query1.finance.yahoo.com/v8/finance/chart/BBAS3.SA?range=5y&interval=1d&events=div%2Csplit',
    'https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?range=1y&interval=1d&events=div%2Csplit',
    'https://query1.finance.yahoo.com/v8/finance/chart/USDBRL%3DX?range=5d&interval=1d&events=div%2Csplit',
  ])
})

test('sem a variação do dia no Yahoo, o histórico calcula pelos dois últimos fechamentos', async () => {
  const fetchFn = (async () => new Response(yahoo({ regularMarketChangePercent: undefined }), { status: 200 })) as unknown as typeof fetch
  const body = await (await handleHistory(await withSession('https://x/api/history?symbol=BBAS3.SA&range=5d'), deps({ fetchFn }))).json()
  expect(body.changePct).toBeCloseTo((16.5 / 15.9 - 1) * 100)
})

test('histórico de símbolo desconhecido vira 404; Yahoo fora do ar ou resposta estranha vira 502', async () => {
  const answer = (status: number, body = '{}') => (async () => new Response(body, { status })) as unknown as typeof fetch
  const url = 'https://x/api/history?symbol=ZZZZQQ&range=5d'
  expect((await handleHistory(await withSession(url), deps({ fetchFn: answer(404, '{"chart":{"result":null}}') }))).status).toBe(404)
  expect((await handleHistory(await withSession(url), deps({ fetchFn: answer(500) }))).status).toBe(502)
  expect((await handleHistory(await withSession(url), deps({ fetchFn: answer(200, '{"chart":{"result":[{"meta":{}}]}}') }))).status).toBe(502)
  const offline = (async () => {
    throw new Error('rede')
  }) as unknown as typeof fetch
  expect((await handleHistory(await withSession(url), deps({ fetchFn: offline }))).status).toBe(502)
})
