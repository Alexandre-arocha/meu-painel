import { loadNews, loadTranslations, saveNews, saveTranslations } from './storage'
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

test('notícia salva com foto, língua e título original volta igual; foto insegura é descartada', () => {
  const foreign = { ...item(1), image: 'https://img.test/a.jpg', lang: 'en', original: 'Original title' }
  saveNews({ at: AT, items: [foreign, { ...item(2), image: 'javascript:alert(1)' }, { ...item(3), image: 'http://img.test/b.jpg' }] })
  expect(loadNews()?.items).toEqual([foreign, item(2), item(3)])
})

test('traduções guardadas: até 1000, saindo as mais antigas; lixo vira vazio', () => {
  const many = Object.fromEntries(Array.from({ length: 1005 }, (_, i) => [`t${i}`, `p${i}`]))
  saveTranslations(many)
  const back = loadTranslations()
  expect(Object.keys(back)).toHaveLength(1000)
  expect(back.t1004).toBe('p1004')
  expect(back.t0).toBeUndefined()
  localStorage.setItem('painel:v1:translations', JSON.stringify({ a: 'b', c: 3 }))
  expect(loadTranslations()).toEqual({ a: 'b' })
  localStorage.setItem('painel:v1:translations', '[1]')
  expect(loadTranslations()).toEqual({})
})

test('notícias salvas corrompidas devolvem null e itens sem título são descartados', () => {
  localStorage.setItem('painel:v1:lastNews', '{{')
  expect(loadNews()).toBeNull()
  localStorage.setItem('painel:v1:lastNews', JSON.stringify({ at: AT, items: [item(1), { ...item(2), title: '' }, null] }))
  expect(loadNews()?.items.map((i) => i.id)).toEqual(['n1'])
})
