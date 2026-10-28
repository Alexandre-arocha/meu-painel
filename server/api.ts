import { isSyncKey } from '../src/data/syncKeys.js'
import { checkPassword, clearSessionCookie, sessionCookie, signSession, verifySession } from './session.js'

export type Env = { APP_PASSWORD?: string; BRAPI_TOKEN?: string; DATABASE_URL?: string }
export type Kv = { all(): Promise<Record<string, unknown>>; put(key: string, value: unknown): Promise<void> }
export type Deps = {
  env: Env
  kv?: () => Kv
  fetchFn?: typeof fetch
  now?: () => number
  delay?: (ms: number) => Promise<void>
}

const MAX_BODY = 1_000_000
const BRAPI_ENDPOINTS = ['quote', 'historical']
const NO_STORE = { 'cache-control': 'no-store' }

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...NO_STORE } })
const empty = (status: number, headers: Record<string, string> = {}) => new Response(null, { status, headers: { ...NO_STORE, ...headers } })
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const noSession = () => json({ error: 'sem sessão' }, 401)

async function authorized(req: Request, d: Deps): Promise<boolean> {
  const secret = d.env.APP_PASSWORD
  return !!secret && verifySession(req.headers.get('cookie'), secret, (d.now ?? Date.now)())
}

export async function handleLogin(req: Request, d: Deps): Promise<Response> {
  const secret = d.env.APP_PASSWORD
  if (!secret) return json({ error: 'APP_PASSWORD não configurada' }, 500)
  let password = ''
  try {
    password = String(((await req.json()) as { password?: unknown }).password ?? '')
  } catch {
    // corpo inválido conta como senha errada
  }
  if (!(await checkPassword(password, secret))) {
    await (d.delay ?? sleep)(400) // atrasa tentativas em série
    return json({ error: 'senha incorreta' }, 401)
  }
  return empty(204, { 'set-cookie': sessionCookie(await signSession(secret, (d.now ?? Date.now)())) })
}

export const handleLogout = () => empty(204, { 'set-cookie': clearSessionCookie() })

export async function handleSession(req: Request, d: Deps): Promise<Response> {
  return (await authorized(req, d)) ? empty(204) : noSession()
}

export async function handleData(req: Request, d: Deps): Promise<Response> {
  if (!(await authorized(req, d))) return noSession()
  if (!d.kv) return json({ error: 'DATABASE_URL não configurada' }, 503)
  const kv = d.kv()
  if (req.method === 'GET') {
    const all = await kv.all()
    return json({ items: Object.fromEntries(Object.entries(all).filter(([key]) => isSyncKey(key))) })
  }
  if (req.method !== 'PUT') return json({ error: 'método não permitido' }, 405)
  const text = await req.text()
  if (text.length > MAX_BODY) return json({ error: 'gravação acima de 1 MB' }, 400)
  let body: { key?: unknown; value?: unknown }
  try {
    body = JSON.parse(text)
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  if (typeof body.key !== 'string' || !isSyncKey(body.key) || body.value === undefined) {
    return json({ error: 'chave não permitida' }, 400)
  }
  await kv.put(body.key, body.value)
  return empty(204)
}

export async function handleNews(req: Request, d: Deps): Promise<Response> {
  if (!(await authorized(req, d))) return noSession()
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (!q || q.length > 100) return json({ error: 'busca inválida' }, 400)
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`
  try {
    const res = await (d.fetchFn ?? fetch)(url)
    if (!res.ok) return json({ error: `notícias: ${res.status}` }, 502)
    return new Response(await res.text(), {
      status: 200,
      headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'private, max-age=300' },
    })
  } catch {
    return json({ error: 'notícias indisponíveis' }, 502)
  }
}

export async function handleBrapi(req: Request, endpoint: string, d: Deps): Promise<Response> {
  if (!(await authorized(req, d))) return noSession()
  if (!BRAPI_ENDPOINTS.includes(endpoint)) return json({ error: 'não encontrado' }, 404)
  const token = d.env.BRAPI_TOKEN
  if (!token) return json({ error: 'BRAPI_TOKEN não configurado' }, 503)
  try {
    const res = await (d.fetchFn ?? fetch)(`https://brapi.dev/api/v2/stocks/${endpoint}${new URL(req.url).search}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    // 401 da brapi não pode virar "sem sessão" no navegador: vira 502 com o motivo.
    if (res.status === 401) return json({ error: 'token da brapi inválido' }, 502)
    return new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json', ...NO_STORE } })
  } catch {
    return json({ error: 'brapi indisponível' }, 502)
  }
}
