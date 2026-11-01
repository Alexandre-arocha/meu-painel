import { useState } from 'react'
import { safeLink, type NewsItem } from '../data/news'
import { langName } from '../data/translate'
import { ago } from './format'

const toneText = { positive: 'tom positivo', neutral: 'neutro', negative: 'tom negativo' } as const
const toneClass = { positive: 'up', neutral: 'mut', negative: 'dn' } as const

// Foto decorativa: o título já diz do que se trata. Se não carregar, some sem deixar buraco.
function Thumb({ src }: { src: string }) {
  const [ok, setOk] = useState(true)
  if (!ok) return null
  return <img className="thumb" src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setOk(false)} />
}

export function NewsList({
  items,
  now,
  title = 'Notícias das suas ações',
  empty = 'Nenhuma notícia por enquanto.',
  cards = false,
}: {
  items: NewsItem[]
  now: Date
  title?: string
  empty?: string
  cards?: boolean
}) {
  return (
    <section className="card wide" aria-label="Notícias">
      {title && <h2>{title}</h2>}
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className={cards ? 'news cards' : 'news'}>
          {items.map((n) => {
            const href = safeLink(n.link)
            const topics = n.tags.filter((t) => t !== 'Seus ativos').join(' · ')
            const foreign = !!n.lang && n.lang !== 'pt'
            const language = n.original ? `traduzido do ${langName(n.lang!)}` : foreign ? `em ${langName(n.lang!)}` : ''
            return (
              <li key={n.id}>
                <div className="news-text">
                  <p className="headline" lang={foreign && !n.original ? n.lang : undefined}>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" title="Abre em nova aba">
                        {n.title}
                      </a>
                    ) : (
                      n.title
                    )}
                  </p>
                  <p className="muted">{[n.source, language, ago(n.publishedAt, now), topics].filter(Boolean).join(' · ')}</p>
                  <div className="pills">
                    {n.tags.includes('Seus ativos') && <span className="pill ac">seus ativos</span>}
                    <span className={`pill ${toneClass[n.tone]}`} title={n.reason}>
                      {toneText[n.tone]}
                    </span>
                  </div>
                </div>
                {n.image && <Thumb src={n.image} />}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
