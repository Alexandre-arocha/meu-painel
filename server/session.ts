// Sessão de um usuário só: cookie "<expira_ms>.<hmac>" assinado com a APP_PASSWORD.
// Trocar a senha na Vercel invalida todas as sessões abertas.
export const SESSION_COOKIE = 'painel_session'
const MAX_AGE_S = 30 * 24 * 60 * 60

const enc = new TextEncoder()

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Comparação em tempo constante: não revela quantos caracteres batem.
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

export async function signSession(secret: string, now: number): Promise<string> {
  const expires = now + MAX_AGE_S * 1000
  return `${expires}.${await hmacHex(secret, `painel-session:${expires}`)}`
}

export async function verifySession(cookieHeader: string | null, secret: string, now: number): Promise<boolean> {
  const match = readCookie(cookieHeader, SESSION_COOKIE)?.match(/^(\d{1,16})\.([0-9a-f]{64})$/)
  if (!match) return false
  const expires = Number(match[1])
  if (expires <= now) return false
  return sameText(match[2], await hmacHex(secret, `painel-session:${expires}`))
}

export async function checkPassword(input: string, secret: string): Promise<boolean> {
  if (!input || !secret) return false
  // Compara os HMACs (mesmo tamanho), não as senhas, para o tempo não depender do texto digitado.
  return sameText(await hmacHex('painel-login', input), await hmacHex('painel-login', secret))
}

export const sessionCookie = (token: string) =>
  `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_S}`

export const clearSessionCookie = () => `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
