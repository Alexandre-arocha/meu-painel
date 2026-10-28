import { normalize, type Tone, type ToneClassifier } from '../domain/tone'

export type NewsItem = {
  id: string
  title: string
  source: string
  publishedAt: string | null
  tags: string[]
  tone: Tone
  reason: string
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

// Feed geral da aba Notícias; as tags viram os filtros de tema.
export const GENERAL_QUERIES: NewsQuery[] = [
  { q: 'mercado financeiro Ibovespa', tag: 'Mercado' },
  { q: 'concurso público edital', tag: 'Concursos' },
  { q: 'concurso militar edital', tag: 'Concursos' },
  { q: 'tecnologia', tag: 'Tecnologia' },
]

export function parseRss(xml: string, tag: string): Omit<NewsItem, 'tone' | 'reason'>[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const text = (el: Element, name: string) => el.getElementsByTagName(name)[0]?.textContent?.trim() ?? ''
  const out: Omit<NewsItem, 'tone' | 'reason'>[] = []
  for (const el of Array.from(doc.getElementsByTagName('item'))) {
    const title = text(el, 'title')
    if (!title) continue
    const time = new Date(text(el, 'pubDate')).getTime()
    out.push({
      id: text(el, 'guid') || text(el, 'link') || title,
      title,
      source: text(el, 'source'),
      publishedAt: Number.isNaN(time) ? null : new Date(time).toISOString(),
      tags: [tag],
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

export function createGoogleNewsSource(
  fetchFn: typeof fetch = fetch,
  classifier: ToneClassifier,
  baseUrl = '/news-proxy',
  queries: NewsQuery[] = INVESTMENT_QUERIES,
): NewsSource {
  return {
    async fetchNews() {
      const batches = await Promise.allSettled(
        queries.map(async ({ q, tag }) => {
          const url = `${baseUrl}/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`
          const res = await fetchFn(url)
          if (!res.ok) throw new Error(`notícias: ${res.status}`)
          return parseRss(await res.text(), tag)
        }),
      )
      const raw = batches.flatMap((b) => (b.status === 'fulfilled' ? b.value : []))
      const classified = await Promise.all(
        raw.map(async (r) => ({ ...r, ...(await classifier.classify(r.title)) })),
      )
      return sortNews(dedupe(classified))
    },
  }
}
