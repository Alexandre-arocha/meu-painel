import type { NewsItem } from '../data/news'
import { ago } from './format'

const toneText = { positive: 'tom positivo', neutral: 'neutro', negative: 'tom negativo' } as const
const toneClass = { positive: 'up', neutral: 'mut', negative: 'dn' } as const

export function NewsList({ items, now }: { items: NewsItem[]; now: Date }) {
  return (
    <section className="card wide" aria-label="Notícias">
      <h2>Notícias das suas ações</h2>
      {items.length === 0 ? (
        <p className="muted">Nenhuma notícia por enquanto.</p>
      ) : (
        <ul className="news">
          {items.slice(0, 20).map((n) => (
            <li key={n.id}>
              <div>
                <p>{n.title}</p>
                <p className="muted">
                  {[n.source, ago(n.publishedAt, now), n.tags.join(' · ')].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className={`pill ${toneClass[n.tone]}`} title={n.reason}>
                {toneText[n.tone]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
