import {
  createGoogleNewsSource,
  createNewsSource,
  dedupe,
  markPortfolio,
  parseRss,
  safeLink,
  sortNews,
  type NewsItem,
} from './news'
import { FEED_IDS, FEEDS } from './feeds'
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

test('markPortfolio marca com "Seus ativos" as notícias que citam BB, BBAS3, B3 ou B3SA3', () => {
  const out = markPortfolio([
    { ...item('Banco do Brasil anuncia dividendos', null), tags: ['Mercado'] },
    item('Ibovespa sobe', null),
    item('B3 tem recorde de investidores', null),
    { ...item('BBAS3 em alta', null), tags: ['Seus ativos'] },
  ])
  expect(out.map((i) => i.tags)).toEqual([['Mercado', 'Seus ativos'], [], ['Seus ativos'], ['Seus ativos']])
})

test('parseRss acha a foto em media:content (a maior), media:thumbnail, enclosure ou img do texto, só em https', () => {
  const rss = `<?xml version="1.0"?><rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
  <item><title>A</title><media:content url="https://img.test/p.jpg" medium="image" width="240"/><media:content url="https://img.test/g.jpg" medium="image" width="1024"/></item>
  <item><title>B</title><media:thumbnail url="https://img.test/t.jpg" width="240"/></item>
  <item><title>C</title><enclosure url="https://img.test/e.jpg" type="image/jpeg" length="1"/></item>
  <item><title>D</title><description><![CDATA[<p><img src="https://img.test/d.jpg" alt=""/> texto</p>]]></description></item>
  <item><title>E</title><media:content url="http://img.test/inseguro.jpg" medium="image"/></item>
  <item><title>F</title><enclosure url="javascript:alert(1)" type="image/png"/></item>
  <item><title>G</title><enclosure url="https://cdn.test/audio.mp3" type="audio/mpeg"/></item>
  </channel></rss>`
  expect(parseRss(rss, 'Mundo').map((i) => i.image)).toEqual([
    'https://img.test/g.jpg',
    'https://img.test/t.jpg',
    'https://img.test/e.jpg',
    'https://img.test/d.jpg',
    undefined,
    undefined,
    undefined,
  ])
})

test('parseRss lê feeds Atom e usa a fonte e a língua do feed', () => {
  const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>New chip</title><link rel="alternate" type="text/html" href="https://verge.test/a"/><id>tag:1</id>
  <published>2026-10-30T12:00:00-04:00</published><content type="html">&lt;img src="https://img.test/v.jpg"&gt;&lt;p&gt;texto&lt;/p&gt;</content></entry>
  </feed>`
  expect(parseRss(atom, 'Tecnologia', { source: 'The Verge', lang: 'en' })).toEqual([
    {
      id: 'tag:1',
      title: 'New chip',
      link: 'https://verge.test/a',
      source: 'The Verge',
      publishedAt: '2026-10-30T16:00:00.000Z',
      tags: ['Tecnologia'],
      image: 'https://img.test/v.jpg',
      lang: 'en',
    },
  ])
})

const rssWith = (title: string) =>
  `<?xml version="1.0"?><rss><channel><item><title>${title}</title><link>https://n.test/${encodeURIComponent(title)}</link><pubDate>Wed, 28 Oct 2026 13:00:00 GMT</pubDate></item></channel></rss>`

test('fonte geral junta os feeds da lista e as buscas dos seus ativos', async () => {
  const urls: string[] = []
  const f = (async (url: string) => {
    urls.push(String(url))
    const src = new URL(String(url), 'http://x').searchParams.get('src') ?? 'google'
    return { ok: true, status: 200, text: async () => rssWith(`Notícia ${src}`) }
  }) as unknown as typeof fetch
  const items = await createNewsSource(f, lexiconClassifier, {
    feeds: ['bbc-world', 'g1-politica'],
    queries: [{ q: 'BBAS3', tag: 'Seus ativos' }],
    googleBase: '/news-proxy',
  }).fetchNews()
  expect(urls).toEqual(['/api/news/feed?src=bbc-world', '/api/news/feed?src=g1-politica', '/news-proxy/search?q=BBAS3&hl=pt-BR&gl=BR&ceid=BR:pt-419'])
  expect(items.map((i) => [i.title, i.tags, i.source, i.lang])).toEqual(
    expect.arrayContaining([
      ['Notícia bbc-world', ['Mundo'], 'BBC', 'en'],
      ['Notícia g1-politica', ['Política'], 'g1', 'pt'],
      ['Notícia google', ['Seus ativos'], '', undefined],
    ]),
  )
})

test('a lista de feeds só tem endereços https e temas conhecidos', () => {
  expect(FEED_IDS.length).toBeGreaterThanOrEqual(15)
  for (const id of FEED_IDS) {
    expect(FEEDS[id].url).toMatch(/^https:\/\//)
    expect(['Mercado', 'Mundo', 'Política', 'Tecnologia']).toContain(FEEDS[id].tag)
  }
})

test('fonte de notícias segue com os termos que deram certo quando um falha', async () => {
  const f = (async (url: string) => {
    if (String(url).includes('Selic')) throw new Error('rede')
    return okFetch(url)
  }) as unknown as typeof fetch
  const items = await createGoogleNewsSource(f, lexiconClassifier).fetchNews()
  expect(items).toHaveLength(2)
})
