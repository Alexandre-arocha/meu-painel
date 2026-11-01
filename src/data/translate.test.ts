import { createTranslator, langName, translateNews, type Translator } from './translate'
import type { NewsItem } from './news'
import { lexiconClassifier } from '../domain/tone'

const item = (id: string, title: string, lang?: string): NewsItem => ({
  id,
  title,
  link: null,
  source: 'Fonte',
  publishedAt: null,
  tags: ['Mundo'],
  tone: 'neutral',
  reason: '',
  ...(lang && { lang }),
})

test('createTranslator manda os textos e a língua para /api/translate e devolve as traduções', async () => {
  const calls: { url: string; body: unknown }[] = []
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) })
    return new Response(JSON.stringify({ translations: ['Olá', 'Mundo'] }), { status: 200 })
  }) as unknown as typeof fetch
  expect(await createTranslator(f)(['Hello', 'World'], 'en')).toEqual(['Olá', 'Mundo'])
  expect(calls).toEqual([{ url: '/api/translate', body: { texts: ['Hello', 'World'], source: 'en' } }])
})

test('createTranslator falha quando o servidor recusa ou devolve a quantidade errada', async () => {
  const refused = (async () => new Response('{}', { status: 503 })) as unknown as typeof fetch
  await expect(createTranslator(refused)(['Hello'], 'en')).rejects.toThrow('tradução: 503')
  const short = (async () => new Response(JSON.stringify({ translations: [] }), { status: 200 })) as unknown as typeof fetch
  await expect(createTranslator(short)(['Hello'], 'en')).rejects.toThrow('tradução inválida')
})

test('translateNews usa o cache, traduz o resto em lotes de 50 por língua e guarda o título original', async () => {
  const batches: [string, number][] = []
  const translate: Translator = async (texts, lang) => {
    batches.push([lang, texts.length])
    return texts.map((t) => `pt:${t}`)
  }
  const english = Array.from({ length: 60 }, (_, i) => item(`e${i}`, `Title ${i}`, 'en'))
  const items = [item('pt', 'Bolsa sobe', 'pt'), item('br', 'Sem língua'), item('c', 'Cached', 'en'), item('f', 'Bonjour', 'fr'), ...english]
  const r = await translateNews(items, translate, { Cached: 'Do cache' }, lexiconClassifier)
  // Os lotes vão em paralelo: a ordem não importa.
  expect([...batches].sort()).toEqual([
    ['en', 10],
    ['en', 50],
    ['fr', 1],
  ])
  expect(r.items.slice(0, 4).map((i) => [i.title, i.original])).toEqual([
    ['Bolsa sobe', undefined],
    ['Sem língua', undefined],
    ['Do cache', 'Cached'],
    ['pt:Bonjour', 'Bonjour'],
  ])
  expect(r.cache['Title 59']).toBe('pt:Title 59')
})

test('translateNews calcula o tom sobre o título traduzido', async () => {
  const translate: Translator = async () => ['Banco tem lucro recorde']
  const r = await translateNews([item('a', 'Bank posts record profit', 'en')], translate, {}, lexiconClassifier)
  expect(r.items[0].tone).toBe('positive')
})

test('uma língua que falha fica no original sem atrapalhar as outras', async () => {
  const translate: Translator = async (texts, lang) => {
    if (lang === 'de') throw new Error('cota')
    return texts.map((t) => `pt:${t}`)
  }
  const r = await translateNews([item('d', 'Guten Tag', 'de'), item('e', 'Hello', 'en')], translate, {}, lexiconClassifier)
  expect(r.items.map((i) => i.title)).toEqual(['Guten Tag', 'pt:Hello'])
  expect(r.items[0].original).toBeUndefined()
})

test('item já traduzido não vai de novo ao tradutor', async () => {
  let calls = 0
  const translate: Translator = async (texts) => {
    calls++
    return texts
  }
  await translateNews([{ ...item('a', 'Já traduzido', 'en'), original: 'Already translated' }], translate, {}, lexiconClassifier)
  expect(calls).toBe(0)
})

test('langName dá o nome da língua em português', () => {
  expect(langName('en')).toBe('inglês')
  expect(langName('de')).toBe('alemão')
  expect(langName('xx')).toBe('xx')
})
