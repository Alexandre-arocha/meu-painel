import { loadNews, saveNews } from './storage'
import type { NewsItem } from './news'

beforeEach(() => localStorage.clear())

const AT = '2026-10-28T12:00:00.000Z'
const item = (i: number): NewsItem => ({
  id: `n${i}`,
  title: `Notícia ${i}`,
  link: null,
  source: 'Fonte',
  publishedAt: null,
  tags: ['Mercado'],
  tone: 'neutral',
  reason: '',
})

test('notícias salvas: salvar e carregar', () => {
  saveNews({ at: AT, items: [item(1)] })
  expect(loadNews()).toEqual({ at: AT, items: [item(1)] })
})

test('salva no máximo 50 notícias', () => {
  saveNews({ at: AT, items: Array.from({ length: 60 }, (_, i) => item(i)) })
  expect(loadNews()?.items).toHaveLength(50)
})

test('notícias salvas corrompidas devolvem null e itens sem título são descartados', () => {
  localStorage.setItem('painel:v1:lastNews', '{{')
  expect(loadNews()).toBeNull()
  localStorage.setItem('painel:v1:lastNews', JSON.stringify({ at: AT, items: [item(1), { ...item(2), title: '' }, null] }))
  expect(loadNews()?.items.map((i) => i.id)).toEqual(['n1'])
})
