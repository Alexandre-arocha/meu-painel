import { useEffect, useState } from 'react'
import type { NewsItem, NewsSource } from '../data/news'
import { NewsList } from './NewsList'

const TOPICS = ['Todas', 'Mercado', 'Concursos', 'Tecnologia']

export function NewsPage({ news, now = () => new Date() }: { news: NewsSource; now?: () => Date }) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [failed, setFailed] = useState(false)
  const [topic, setTopic] = useState('Todas')

  useEffect(() => {
    let alive = true
    news
      .fetchNews()
      .then((n) => {
        if (alive) setItems(n)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [news])

  const shown = topic === 'Todas' ? items : items.filter((i) => i.tags.includes(topic))

  return (
    <div className="page">
      {failed && (
        <p className="banner" role="alert">
          Não foi possível carregar as notícias.
        </p>
      )}
      <div className="chips topics" role="group" aria-label="Temas">
        {TOPICS.map((t) => (
          <button key={t} type="button" className="chip" aria-pressed={topic === t} onClick={() => setTopic(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="grid">
        <NewsList items={shown} now={new Date(now())} title="Feed de notícias" />
      </div>
    </div>
  )
}
