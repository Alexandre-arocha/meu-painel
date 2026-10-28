import {
  GENERAL_QUERIES,
  createGoogleNewsSource,
  dedupe,
  markPortfolio,
  parseRss,
  safeLink,
  sortNews,
  type NewsItem,
} from './news'
import { lexiconClassifier } from '../domain/tone'

const xml = `<?xml version="1.0"?><rss><channel>
<item><title>Banco do Brasil tem lucro</title><link>http://a/1</link><pubDate>Wed, 28 Oct 2026 13:00:00 GMT</pubDate><source>Fonte A</source></item>
<item><title></title><link>http://a/2</link><pubDate>Wed, 28 Oct 2026 12:00:00 GMT</pubDate></item>
<item><title>Sem data válida</title><link>http://a/3</link><pubDate>ontem</pubDate></item>
</channel></rss>`

test('parseRss ignora item sem título', () => {
  const items = parseRss(xml, 'BBAS3')
  expect(items.map((i) => i.title)).toEqual(['Banco do Brasil tem lucro', 'Sem data válida'])
})

test('parseRss usa data inválida como null sem quebrar', () => {
  const items = parseRss(xml, 'BBAS3')
  expect(items[0].publishedAt).toBe('2026-10-28T13:00:00.000Z')
  expect(items[1].publishedAt).toBeNull()
  expect(items[0].tags).toEqual(['BBAS3'])
  expect(items[0].source).toBe('Fonte A')
})

const item = (title: string, publishedAt: string | null): NewsItem => ({
  id: title,
  title,
  link: null,
  source: 's',
  publishedAt,
  tags: [],
  tone: 'neutral',
  reason: '',
})

test('dedupe remove títulos repetidos ignorando maiúsculas e acentos', () => {
  const out = dedupe([item('Queda na Bolsa', null), item('queda na bolsa', null), item('Outra notícia', null)])
  expect(out.map((i) => i.title)).toEqual(['Queda na Bolsa', 'Outra notícia'])
})

test('sortNews ordena da mais nova para a mais antiga e deixa sem data no fim', () => {
  const out = sortNews([
    item('sem data', null),
    item('velha', '2026-10-28T10:00:00.000Z'),
    item('nova', '2026-10-28T12:00:00.000Z'),
  ])
  expect(out.map((i) => i.title)).toEqual(['nova', 'velha', 'sem data'])
})

const okFetch = (async () => ({ ok: true, status: 200, text: async () => xml })) as unknown as typeof fetch

test('fonte de notícias busca os 4 termos, remove repetidas e classifica o tom', async () => {
  let calls = 0
  const f = (async (...a: Parameters<typeof fetch>) => {
    calls++
    return okFetch(...a)
  }) as unknown as typeof fetch
  const items = await createGoogleNewsSource(f, lexiconClassifier).fetchNews()
  expect(calls).toBe(4)
  expect(items).toHaveLength(2)
  expect(items[0]).toMatchObject({ title: 'Banco do Brasil tem lucro', tone: 'positive' })
})

test('safeLink aceita http e https e rejeita javascript:, data:, relativo e sem protocolo', () => {
  expect(safeLink('https://exemplo.com/a')).toBe('https://exemplo.com/a')
  expect(safeLink('http://exemplo.com/a')).toBe('http://exemplo.com/a')
  for (const bad of ['javascript:alert(1)', 'data:text/html,oi', '/noticia/1', 'www.exemplo.com', '', null, undefined]) {
    expect(safeLink(bad)).toBeNull()
  }
})

test('parseRss guarda o link seguro de cada item', () => {
  expect(parseRss(xml, 'BBAS3')[0].link).toBe('http://a/1')
})

test('markPortfolio marca notícias que citam BB, BBAS3, B3 ou B3SA3', () => {
  const out = markPortfolio([
    { ...item('Banco do Brasil anuncia dividendos', null), tags: ['Mercado'] },
    item('Ibovespa sobe', null),
    item('B3 tem recorde de investidores', null),
    { ...item('BBAS3 em alta', null), tags: ['Carteira'] },
  ])
  expect(out.map((i) => i.tags)).toEqual([['Mercado', 'Carteira'], [], ['Carteira'], ['Carteira']])
})

test('fonte geral busca mercado, concursos e tecnologia', async () => {
  const urls: string[] = []
  const f = (async (url: string) => {
    urls.push(String(url))
    return okFetch(url)
  }) as unknown as typeof fetch
  await createGoogleNewsSource(f, lexiconClassifier, '/news-proxy', GENERAL_QUERIES).fetchNews()
  expect(urls).toHaveLength(GENERAL_QUERIES.length)
  expect(urls.some((u) => u.includes('concurso'))).toBe(true)
  expect(new Set(GENERAL_QUERIES.map((q) => q.tag))).toEqual(new Set(['Mercado', 'Concursos', 'Tecnologia']))
})

test('fonte de notícias segue com os termos que deram certo quando um falha', async () => {
  const f = (async (url: string) => {
    if (String(url).includes('Selic')) throw new Error('rede')
    return okFetch(url)
  }) as unknown as typeof fetch
  const items = await createGoogleNewsSource(f, lexiconClassifier).fetchNews()
  expect(items).toHaveLength(2)
})
