import { FEEDS, isFeedId } from '../src/data/feeds.js'
import { isSyncKey } from '../src/data/syncKeys.js'
import { checkPassword, clearSessionCookie, sessionCookie, signSession, verifySession } from './session.js'

export type Env = { APP_PASSWORD?: string; BRAPI_TOKEN?: string; DATABASE_URL?: string; DEEPL_API_KEY?: string }
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

export async function handleFeed(req: Request, d: Deps): Promise<Response> {
  if (!(await authorized(req, d))) return noSession()
  return feedResponse(new URL(req.url).searchParams.get('src') ?? '', d.fetchFn ?? fetch)
}

// Sem checagem de sessão: o servidor de desenvolvimento do Vite também usa.
export async function feedResponse(id: string, fetchFn: typeof fetch): Promise<Response> {
  if (!isFeedId(id)) return json({ error: 'feed desconhecido' }, 404)
  try {
    const res = await fetchFn(FEEDS[id].url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; MeuPainel/1.0)' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return json({ error: `feed: ${res.status}` }, 502)
    return new Response(await res.text(), {
      status: 200,
      headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'private, max-age=300' },
    })
  } catch {
    return json({ error: 'feed indisponível' }, 502)
  }
}

const MAX_TEXTS = 50 // limite do DeepL por pedido
const MAX_CHARS = 500

export async function handleTranslate(req: Request, d: Deps): Promise<Response> {
  if (!(await authorized(req, d))) return noSession()
  return translateResponse(req, d.env.DEEPL_API_KEY, d.fetchFn ?? fetch)
}

// Sem checagem de sessão: o servidor de desenvolvimento do Vite também usa.
export async function translateResponse(req: Request, key: string | undefined, fetchFn: typeof fetch): Promise<Response> {
  let body: { texts?: unknown; source?: unknown } | null
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json({ error: 'corpo inválido' }, 400)
  }
  const texts = body?.texts
  const valid = (t: unknown) => typeof t === 'string' && t.length > 0 && t.length <= MAX_CHARS
  if (!Array.isArray(texts) || texts.length === 0 || texts.length > MAX_TEXTS || !texts.every(valid)) {
    return json({ error: 'textos inválidos' }, 400)
  }
  const source = body?.source === undefined ? undefined : String(body.source).toUpperCase()
  if (source !== undefined && !/^[A-Z]{2}$/.test(source)) return json({ error: 'língua inválida' }, 400)
  if (!key) return json({ error: 'DEEPL_API_KEY não configurada' }, 503)
  // Chaves do plano grátis terminam em ":fx" e só valem no servidor grátis do DeepL.
  const host = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'
  try {
    const res = await fetchFn(`${host}/v2/translate`, {
      method: 'POST',
      headers: { authorization: `DeepL-Auth-Key ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text: texts, target_lang: 'PT-BR', ...(source && { source_lang: source }) }),
      signal: AbortSignal.timeout(15_000),
    })
    if (res.status === 456) return json({ error: 'a cota do mês do DeepL acabou' }, 429)
    if (res.status === 403) return json({ error: 'chave do DeepL inválida' }, 502)
    if (!res.ok) return json({ error: `DeepL: ${res.status}` }, 502)
    const out = ((await res.json()) as { translations?: { text?: unknown }[] }).translations?.map((t) => t.text)
    if (!out || out.length !== texts.length || !out.every((t) => typeof t === 'string')) {
      return json({ error: 'resposta inesperada do DeepL' }, 502)
    }
    return json({ translations: out })
  } catch {
    return json({ error: 'DeepL indisponível' }, 502)
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
