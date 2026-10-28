// @vitest-environment node
import { SESSION_COOKIE, checkPassword, clearSessionCookie, sessionCookie, signSession, verifySession } from './session.js'

const SECRET = 'senha-de-teste' // valor de teste, não é a senha real
const NOW = Date.UTC(2026, 9, 28, 12)
const DAY = 86_400_000
const cookieOf = (token: string) => `outro=1; ${SESSION_COOKIE}=${token}`

test('sessão vale por 30 dias e expira depois', async () => {
  const token = await signSession(SECRET, NOW)
  expect(await verifySession(cookieOf(token), SECRET, NOW + 29 * DAY)).toBe(true)
  expect(await verifySession(cookieOf(token), SECRET, NOW + 31 * DAY)).toBe(false)
})

test('assinatura ou validade adulterada é recusada', async () => {
  const token = await signSession(SECRET, NOW)
  const [exp, sig] = token.split('.')
  expect(await verifySession(cookieOf(`${Number(exp) + DAY}.${sig}`), SECRET, NOW)).toBe(false)
  expect(await verifySession(cookieOf(`${exp}.${(sig[0] === 'a' ? 'b' : 'a') + sig.slice(1)}`), SECRET, NOW)).toBe(false)
  expect(await verifySession(null, SECRET, NOW)).toBe(false)
  expect(await verifySession(`${SESSION_COOKIE}=lixo`, SECRET, NOW)).toBe(false)
})

test('sessão de outra senha é recusada', async () => {
  const token = await signSession('outra-senha', NOW)
  expect(await verifySession(cookieOf(token), SECRET, NOW)).toBe(false)
})

test('checkPassword aceita a certa e recusa errada e vazia', async () => {
  expect(await checkPassword(SECRET, SECRET)).toBe(true)
  expect(await checkPassword('errada', SECRET)).toBe(false)
  expect(await checkPassword('', SECRET)).toBe(false)
})

test('cookie tem HttpOnly, Secure, SameSite=Strict e Max-Age de 30 dias', () => {
  const c = sessionCookie('abc')
  for (const part of [`${SESSION_COOKIE}=abc`, 'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=2592000']) {
    expect(c).toContain(part)
  }
  expect(clearSessionCookie()).toContain('Max-Age=0')
})
