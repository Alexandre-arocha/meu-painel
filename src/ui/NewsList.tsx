import { safeLink, type NewsItem } from '../data/news'
import { ago } from './format'

const toneText = { positive: 'tom positivo', neutral: 'neutro', negative: 'tom negativo' } as const
const toneClass = { positive: 'up', neutral: 'mut', negative: 'dn' } as const

export function NewsList({
  items,
  now,
  title = 'Notícias das suas ações',
  empty = 'Nenhuma notícia por enquanto.',
}: {
  items: NewsItem[]
  now: Date
  title?: string
  empty?: string
}) {
  return (
    <section className="card wide" aria-label="Notícias">
      {title && <h2>{title}</h2>}
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="news">
          {items.slice(0, 20).map((n) => {
            const href = safeLink(n.link)
            const topics = n.tags.filter((t) => t !== 'Carteira').join(' · ')
            return (
              <li key={n.id}>
                <div>
                  <p className="headline">
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" title="Abre em nova aba">
                        {n.title}
                      </a>
                    ) : (
                      n.title
                    )}
                  </p>
                  <p className="muted">{[n.source, ago(n.publishedAt, now), topics].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="pills">
                  {n.tags.includes('Carteira') && <span className="pill ac">sua carteira</span>}
                  <span className={`pill ${toneClass[n.tone]}`} title={n.reason}>
                    {toneText[n.tone]}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
