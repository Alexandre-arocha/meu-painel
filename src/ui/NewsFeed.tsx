import { useEffect, useState } from 'react'
import { markPortfolio, portfolioTerms, type NewsItem, type NewsSource } from '../data/news'
import { loadNews, loadPositions, loadTranslations, saveNews, saveTranslations } from '../data/storage'
import { createTranslator, translateNews, type Translator } from '../data/translate'
import { lexiconClassifier } from '../domain/tone'
import { dayTime, hhmm } from './format'
import { NewsList } from './NewsList'

const TOPICS = ['Tudo', 'Mercado', 'Mundo', 'Política', 'Tecnologia', 'Seus ativos']
const PAGE = 20
const serverTranslator = createTranslator()

type Status = { kind: 'loading' } | { kind: 'fresh'; at: string } | { kind: 'saved'; at: string } | { kind: 'failed' }
export type NewsFeedProps = {
  news: NewsSource
  now?: () => Date
  store?: Storage
  limit?: number
  title?: string
  translate?: Translator
  layout?: 'list' | 'cards'
}

// Feed com temas, Atualizar e as notícias salvas quando a busca falha. Usado na aba Notícias e no Início.
export function NewsFeed({
  news,
  now = () => new Date(),
  store = localStorage,
  limit,
  title = 'Feed de notícias',
  translate = serverTranslator,
  layout = 'list',
}: NewsFeedProps) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [topic, setTopic] = useState('Tudo')
  const [count, setCount] = useState(PAGE)
  const [round, setRound] = useState(0)

  // `now` fica fora das dependências: é só o relógio, e a função padrão muda a cada render.
  useEffect(() => {
    let alive = true
    const terms = portfolioTerms(loadPositions(store))
    const showSaved = () => {
      const saved = loadNews(store)
      if (saved && saved.items.length > 0) {
        setItems(markPortfolio(saved.items, terms))
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
        setItems(markPortfolio(fresh, terms))
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

  const shown = topic === 'Tudo' ? items : items.filter((i) => i.tags.includes(topic))
  const visible = shown.slice(0, limit ?? count)
  const loading = status.kind === 'loading'

  // Só as manchetes estrangeiras que estão na tela vão ao tradutor, para caber na cota grátis do DeepL.
  const pending = visible.filter((i) => i.lang && i.lang !== 'pt' && !i.original)
  const pendingKey = pending.map((i) => i.id).join('\n')
  // As dependências são só a chave: o mesmo conjunto de manchetes não pede tradução de novo a cada render.
  useEffect(() => {
    if (!pendingKey) return
    let alive = true
    const cache = loadTranslations(store)
    translateNews(pending, translate, cache, lexiconClassifier).then((r) => {
      if (!alive) return
      if (Object.keys(r.cache).length > Object.keys(cache).length) saveTranslations(r.cache, store)
      const done = new Map(r.items.filter((i) => i.original).map((i) => [i.id, i]))
      if (done.size > 0) setItems((all) => all.map((i) => done.get(i.id) ?? i))
    })
    return () => {
      alive = false
    }
  }, [pendingKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
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
            <button
              key={t}
              type="button"
              className="chip"
              aria-pressed={topic === t}
              onClick={() => {
                setTopic(t)
                setCount(PAGE)
              }}
            >
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
          items={visible}
          now={now()}
          title={title}
          cards={layout === 'cards'}
          empty={topic === 'Tudo' ? 'Nenhuma notícia por enquanto.' : `Nenhuma notícia de ${topic} agora.`}
        />
      </div>
      {!limit && shown.length > count && (
        <button type="button" className="ghost show-more" onClick={() => setCount((c) => c + PAGE)}>
          Mostrar mais
        </button>
      )}
    </>
  )
}
