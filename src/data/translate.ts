import type { ToneClassifier } from '../domain/tone'
import type { NewsItem } from './news'

export type Translator = (texts: string[], source: string) => Promise<string[]>

const BATCH = 50 // limite do DeepL por pedido

const LANG_NAMES: Record<string, string> = { en: 'inglês', fr: 'francês', es: 'espanhol', de: 'alemão', it: 'italiano', ja: 'japonês' }
export const langName = (lang: string) => LANG_NAMES[lang] ?? lang

// A chave do DeepL fica no servidor: o navegador só fala com /api/translate.
export function createTranslator(fetchFn: typeof fetch = fetch, url = '/api/translate'): Translator {
  return async (texts, source) => {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texts, source }),
    })
    if (!res.ok) throw new Error(`tradução: ${res.status}`)
    const out = ((await res.json()) as { translations?: unknown }).translations
    if (!Array.isArray(out) || out.length !== texts.length) throw new Error('tradução inválida')
    return out as string[]
  }
}

const foreign = (i: NewsItem) => !!i.lang && i.lang !== 'pt' && !i.original

const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, k) => xs.slice(k * n, k * n + n))

// Traduz os títulos estrangeiros: primeiro pelo cache, e o que faltar vai ao tradutor em lotes de até 50 por língua.
// Uma língua que falhar fica no original sem atrapalhar as outras. O tom é recalculado sobre o título traduzido.
export async function translateNews(
  items: NewsItem[],
  translate: Translator,
  cache: Record<string, string>,
  classifier: ToneClassifier,
): Promise<{ items: NewsItem[]; cache: Record<string, string> }> {
  const next = { ...cache }
  const missing = new Map<string, string[]>()
  for (const i of items.filter((i) => foreign(i) && !next[i.title])) {
    const list = missing.get(i.lang!) ?? []
    if (!list.includes(i.title)) missing.set(i.lang!, [...list, i.title])
  }
  await Promise.allSettled(
    [...missing].flatMap(([lang, titles]) =>
      chunks(titles, BATCH).map(async (batch) => {
        const out = await translate(batch, lang)
        batch.forEach((t, k) => (next[t] = out[k]))
      }),
    ),
  )
  const done = await Promise.all(
    items.map(async (i) => {
      const t = foreign(i) ? next[i.title] : undefined
      return t ? { ...i, title: t, original: i.title, ...(await classifier.classify(t)) } : i
    }),
  )
  return { items: done, cache: next }
}
