import { computeSignal } from './signal'
import type { NewsItem } from '../data/news'
import type { Quote } from '../data/prices'
import type { Tone } from './tone'

const NOW = new Date('2026-10-28T15:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString()

const news = (tone: Tone, h: number, id = `${tone}${h}`): NewsItem => ({
  id,
  title: id,
  source: 's',
  publishedAt: hoursAgo(h),
  tags: [],
  tone,
  reason: '',
})

const quote = (changePct: number): Quote => ({
  symbol: 'BBAS3',
  price: 30,
  changePct,
  updatedAt: NOW.toISOString(),
  stale: false,
  intraday: [],
})

test('3 positivas e 1 negativa nas últimas 6 h dão "mais positivo"', () => {
  const s = computeSignal(
    [news('positive', 1, 'a'), news('positive', 2, 'b'), news('positive', 3, 'c'), news('negative', 1, 'd')],
    undefined,
    NOW,
  )
  expect(s).toMatchObject({ label: 'mais positivo', positives: 3, negatives: 1 })
})

test('notícia de 8 h atrás é ignorada', () => {
  const s = computeSignal([news('negative', 8)], undefined, NOW)
  expect(s.label).toBe('sem dados')
})

test('empate dá "neutro"', () => {
  const s = computeSignal([news('positive', 1), news('negative', 2)], undefined, NOW)
  expect(s.label).toBe('neutro')
})

test('sem notícias na janela dá "sem dados"', () => {
  expect(computeSignal([], quote(1), NOW).label).toBe('sem dados')
})

test('agreesWithPrice é true com sinal positivo e changePct > 0', () => {
  expect(computeSignal([news('positive', 1)], quote(0.8), NOW).agreesWithPrice).toBe(true)
})

test('agreesWithPrice é false com sinal positivo e changePct < 0', () => {
  expect(computeSignal([news('positive', 1)], quote(-0.8), NOW).agreesWithPrice).toBe(false)
})

test('agreesWithPrice é null quando não há quote', () => {
  expect(computeSignal([news('positive', 1)], undefined, NOW).agreesWithPrice).toBeNull()
})

test('notícia sem data é ignorada', () => {
  const undated = { ...news('positive', 1), publishedAt: null }
  expect(computeSignal([undated], undefined, NOW).label).toBe('sem dados')
})
