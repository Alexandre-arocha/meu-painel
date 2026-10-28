// @vitest-environment node
import { handleBrapi, handleData, handleLogin, handleLogout, handleNews, handleSession, type Deps, type Kv } from './api.js'
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

test('brapi sem BRAPI_TOKEN devolve 503', async () => {
  const res = await handleBrapi(await withSession('https://x/api/brapi/quote?symbols=BBAS3'), 'quote', deps({ env: { APP_PASSWORD: SECRET } }))
  expect(res.status).toBe(503)
})
