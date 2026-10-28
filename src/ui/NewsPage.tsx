import { useEffect, useState } from 'react'
import { markPortfolio, type NewsItem, type NewsSource } from '../data/news'
import { loadNews, saveNews } from '../data/storage'
import { dayTime, hhmm } from './format'
import { NewsList } from './NewsList'

const TOPICS = ['Todas', 'Carteira', 'Mercado', 'Concursos', 'Tecnologia']

type Status = { kind: 'loading' } | { kind: 'fresh'; at: string } | { kind: 'saved'; at: string } | { kind: 'failed' }
type Props = { news: NewsSource; now?: () => Date; store?: Storage }

export function NewsPage({ news, now = () => new Date(), store = localStorage }: Props) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [topic, setTopic] = useState('Todas')
  const [round, setRound] = useState(0)

  // `now` fica fora das dependências: é só o relógio, e a função padrão muda a cada render.
  useEffect(() => {
    let alive = true
    const showSaved = () => {
      const saved = loadNews(store)
      if (saved && saved.items.length > 0) {
        setItems(markPortfolio(saved.items))
        setStatus({ kind: 'saved', at: saved.at })
      } else {
        setStatus({ kind: 'failed' })
      }
    }
    setStatus({ kind: 'loading' })
    news
      .fetchNews()
      .then((fresh) => {
        if (!alive) return
        if (fresh.length === 0) return showSaved()
        const at = now().toISOString()
        setItems(markPortfolio(fresh))
        setStatus({ kind: 'fresh', at })
        saveNews({ at, items: fresh }, store)
      })
      .catch(() => {
        if (alive) showSaved()
      })
    return () => {
      alive = false
    }
  }, [news, store, round])

  const shown = topic === 'Todas' ? items : items.filter((i) => i.tags.includes(topic))
  const loading = status.kind === 'loading'

  return (
    <div className="page">
      {status.kind === 'failed' && (
        <p className="banner" role="alert">
          Não foi possível carregar as notícias.
        </p>
      )}
      {status.kind === 'saved' && (
        <p className="banner" role="alert">
          Sem conexão com as notícias agora. Mostrando as notícias salvas em {dayTime(status.at)}.
        </p>
      )}
      <div className="toolbar">
        <div className="chips" role="group" aria-label="Temas">
          {TOPICS.map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={topic === t} onClick={() => setTopic(t)}>
              {t}
            </button>
          ))}
        </div>
        <button type="button" className="ghost" disabled={loading} onClick={() => setRound((r) => r + 1)}>
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>
      <p className="muted status" aria-live="polite">
        {status.kind === 'fresh' ? `Atualizado às ${hhmm(status.at)}` : loading ? 'Buscando notícias…' : ''}
      </p>
      <div className="grid">
        <NewsList
          items={shown}
          now={now()}
          title="Feed de notícias"
          empty={topic === 'Todas' ? 'Nenhuma notícia por enquanto.' : `Nenhuma notícia de ${topic} agora.`}
        />
      </div>
    </div>
  )
}
