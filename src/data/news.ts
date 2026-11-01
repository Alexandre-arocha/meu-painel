import { normalize, type Tone, type ToneClassifier } from '../domain/tone'
import { FEEDS, type FeedId } from './feeds'

export type NewsItem = {
  id: string
  title: string
  link: string | null
  source: string
  publishedAt: string | null
  tags: string[]
  tone: Tone
  reason: string
  image?: string
  lang?: string // língua do feed; sem ela, português
  original?: string // título antes da tradução
}

export interface NewsSource {
  fetchNews(): Promise<NewsItem[]>
}

export type NewsQuery = { q: string; tag: string }

// Termos da fase 1 (ver plano). Em dev, /news-proxy aponta para https://news.google.com/rss (vite.config.ts).
export const INVESTMENT_QUERIES: NewsQuery[] = [
  { q: 'Banco do Brasil BBAS3', tag: 'BBAS3' },
  { q: 'B3 B3SA3', tag: 'B3SA3' },
  { q: 'Selic', tag: 'Selic' },
  { q: 'renda fixa', tag: 'renda fixa' },
]

// Buscas do Google News para o tema "Seus ativos" do feed geral.
export const PORTFOLIO_QUERIES: NewsQuery[] = [
  { q: 'Banco do Brasil BBAS3', tag: 'Seus ativos' },
  { q: 'B3 B3SA3', tag: 'Seus ativos' },
]

// Links de RSS vêm de fora: só http(s) absoluto vira link, para nunca virar javascript: na tela.
export function safeLink(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

// Foto só em https: o app publicado é https e o navegador bloquearia ou avisaria sobre http.
export function safeImage(url: string | null | undefined): string | undefined {
  const href = safeLink(url?.replace(/&amp;/g, '&'))
  return href?.startsWith('https:') ? href : undefined
}

const PORTFOLIO_TERMS = /\b(banco do brasil|bbas3|b3sa3|b3)\b/

// Marca com a tag "Seus ativos" as notícias cujo título cita as ações do dono.
export function markPortfolio(items: NewsItem[]): NewsItem[] {
  return items.map((i) =>
    !i.tags.includes('Seus ativos') && PORTFOLIO_TERMS.test(normalize(i.title)) ? { ...i, tags: [...i.tags, 'Seus ativos'] } : i,
  )
}

const text = (el: Element, name: string) => el.getElementsByTagName(name)[0]?.textContent?.trim() ?? ''

// Primeira foto https: o maior media:content, media:thumbnail, enclosure de imagem ou o primeiro <img> do texto.
function findImage(el: Element): string | undefined {
  const media = Array.from(el.getElementsByTagName('media:content'))
    .filter((m) => (m.getAttribute('medium') ?? 'image') === 'image')
    .sort((a, b) => Number(b.getAttribute('width') ?? 0) - Number(a.getAttribute('width') ?? 0))
  const enclosure = Array.from(el.getElementsByTagName('enclosure')).find((e) => e.getAttribute('type')?.startsWith('image/'))
  const html = text(el, 'description') + text(el, 'content:encoded') + text(el, 'content')
  const candidates = [
    media[0]?.getAttribute('url'),
    el.getElementsByTagName('media:thumbnail')[0]?.getAttribute('url'),
    enclosure?.getAttribute('url'),
    html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1],
  ]
  return candidates.map(safeImage).find(Boolean)
}

type ParseOpts = { source?: string; lang?: string }

// Lê RSS (<item>) e Atom (<entry>). A fonte e a língua vêm do feed quando informadas.
export function parseRss(xml: string, tag: string, opts: ParseOpts = {}): Omit<NewsItem, 'tone' | 'reason'>[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const nodes = [...Array.from(doc.getElementsByTagName('item')), ...Array.from(doc.getElementsByTagName('entry'))]
  const out: Omit<NewsItem, 'tone' | 'reason'>[] = []
  for (const el of nodes) {
    const title = text(el, 'title')
    if (!title) continue
    const atomLink = Array.from(el.getElementsByTagName('link')).find((l) => (l.getAttribute('rel') ?? 'alternate') === 'alternate')
    const link = text(el, 'link') || atomLink?.getAttribute('href') || ''
    const time = new Date(text(el, 'pubDate') || text(el, 'published') || text(el, 'updated')).getTime()
    const image = findImage(el)
    out.push({
      id: text(el, 'guid') || text(el, 'id') || link || title,
      title,
      link: safeLink(link),
      source: opts.source ?? text(el, 'source'),
      publishedAt: Number.isNaN(time) ? null : new Date(time).toISOString(),
      tags: [tag],
      ...(image && { image }),
      ...(opts.lang && { lang: opts.lang }),
    })
  }
  return out
}

export function dedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>()
  return items.filter((i) => {
    const key = normalize(i.title)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function sortNews(items: NewsItem[]): NewsItem[] {
  const t = (i: NewsItem) => (i.publishedAt ? new Date(i.publishedAt).getTime() : -Infinity)
  return [...items].sort((a, b) => t(b) - t(a))
}

type FeedRequest = ParseOpts & { url: string; tag: string }

// Busca tudo junto, segue com o que deu certo, classifica o tom e devolve sem repetidas, da mais nova para a mais antiga.
async function collect(requests: FeedRequest[], fetchFn: typeof fetch, classifier: ToneClassifier): Promise<NewsItem[]> {
  const batches = await Promise.allSettled(
    requests.map(async (r) => {
      const res = await fetchFn(r.url)
      if (!res.ok) throw new Error(`notícias: ${res.status}`)
      return parseRss(await res.text(), r.tag, r)
    }),
  )
  const raw = batches.flatMap((b) => (b.status === 'fulfilled' ? b.value : []))
  const classified = await Promise.all(raw.map(async (r) => ({ ...r, ...(await classifier.classify(r.title)) })))
  return sortNews(dedupe(classified))
}

const googleUrl = (base: string, q: string) => `${base}/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`

export function createGoogleNewsSource(
  fetchFn: typeof fetch = fetch,
  classifier: ToneClassifier,
  baseUrl = '/news-proxy',
  queries: NewsQuery[] = INVESTMENT_QUERIES,
): NewsSource {
  return { fetchNews: () => collect(queries.map(({ q, tag }) => ({ url: googleUrl(baseUrl, q), tag })), fetchFn, classifier) }
}

type GeneralOpts = { feeds: FeedId[]; queries: NewsQuery[]; googleBase?: string; feedBase?: string }

// Feed geral: os feeds com foto (do Brasil e do mundo) mais as buscas do Google News dos seus ativos.
export function createNewsSource(
  fetchFn: typeof fetch = fetch,
  classifier: ToneClassifier,
  { feeds, queries, googleBase = '/news-proxy', feedBase = '/api/news/feed' }: GeneralOpts,
): NewsSource {
  const requests: FeedRequest[] = [
    ...feeds.map((id) => ({ ...FEEDS[id], url: `${feedBase}?src=${id}` })),
    ...queries.map(({ q, tag }) => ({ url: googleUrl(googleBase, q), tag })),
  ]
  return { fetchNews: () => collect(requests, fetchFn, classifier) }
}
