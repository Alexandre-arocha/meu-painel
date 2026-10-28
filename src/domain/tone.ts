export type Tone = 'positive' | 'neutral' | 'negative'

export interface ToneClassifier {
  classify(title: string): Promise<{ tone: Tone; reason: string }>
}

export const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const POSITIVE = ['lucro', 'alta', 'recorde', 'sobe', 'sobem', 'cresce', 'crescimento', 'supera', 'dividendos', 'aprova', 'valorizacao']
const NEGATIVE = ['queda', 'prejuizo', 'rebaixa', 'rebaixamento', 'cai', 'caem', 'perda', 'multa', 'investigacao', 'desaba']

export const lexiconClassifier: ToneClassifier = {
  async classify(title) {
    const words = normalize(title).split(/[^a-z0-9]+/)
    const pos = POSITIVE.filter((w) => words.includes(w))
    const neg = NEGATIVE.filter((w) => words.includes(w))
    if (pos.length === 0 && neg.length === 0) return { tone: 'neutral', reason: 'sem palavra-chave' }
    if (pos.length === neg.length) return { tone: 'neutral', reason: 'sinais mistos' }
    return pos.length > neg.length
      ? { tone: 'positive', reason: `palavra-chave: ${pos.join(', ')}` }
      : { tone: 'negative', reason: `palavra-chave: ${neg.join(', ')}` }
  },
}
