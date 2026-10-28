import type { NewsItem } from '../data/news'
import type { Quote } from '../data/prices'

export type Signal = {
  label: 'mais positivo' | 'neutro' | 'mais negativo' | 'sem dados'
  positives: number
  negatives: number
  agreesWithPrice: boolean | null
}

// Contagem simples de notícias recentes, comparada com a variação do preço. Apoio, não previsão.
export function computeSignal(
  news: NewsItem[],
  quote: Quote | undefined,
  now: Date,
  windowHours = 6,
): Signal {
  const from = now.getTime() - windowHours * 3600_000
  const recent = news.filter((n) => {
    if (!n.publishedAt) return false
    const t = new Date(n.publishedAt).getTime()
    return t >= from && t <= now.getTime()
  })
  const positives = recent.filter((n) => n.tone === 'positive').length
  const negatives = recent.filter((n) => n.tone === 'negative').length

  const label: Signal['label'] =
    recent.length === 0
      ? 'sem dados'
      : positives > negatives
        ? 'mais positivo'
        : negatives > positives
          ? 'mais negativo'
          : 'neutro'

  let agreesWithPrice: boolean | null = null
  if (quote && label === 'mais positivo') agreesWithPrice = quote.changePct > 0
  if (quote && label === 'mais negativo') agreesWithPrice = quote.changePct < 0

  return { label, positives, negatives, agreesWithPrice }
}
