import { useEffect, useState } from 'react'
import { createBrapiProvider, createProxyPriceProvider, type PriceProvider } from '../data/prices'
import { GENERAL_QUERIES, createGoogleNewsSource, type NewsSource } from '../data/news'
import { setWriteListener } from '../data/storage'
import { lexiconClassifier } from '../domain/tone'
import { startSync } from '../sync'
import { AgendaPage } from './AgendaPage'
import { HomePage } from './HomePage'
import { InvestmentsPage } from './InvestmentsPage'
import { LoginPage } from './LoginPage'
import { NewsPage } from './NewsPage'
import { StudyPage } from './StudyPage'

type Props = {
  makePrices?: (token: string | undefined) => PriceProvider
  news?: NewsSource
  generalNews?: NewsSource
  auth?: boolean // app publicado: senha, sincronização e funções /api
  fetchFn?: typeof fetch
}

// Em desenvolvimento: brapi direto e notícias pelo proxy do Vite. Publicado: tudo pelas funções /api.
const local = {
  makePrices: (token: string | undefined) => createBrapiProvider(token),
  news: createGoogleNewsSource(undefined, lexiconClassifier),
  generalNews: createGoogleNewsSource(undefined, lexiconClassifier, '/news-proxy', GENERAL_QUERIES),
}
const published = {
  makePrices: () => createProxyPriceProvider(),
  news: createGoogleNewsSource(undefined, lexiconClassifier, '/api/news'),
  generalNews: createGoogleNewsSource(undefined, lexiconClassifier, '/api/news', GENERAL_QUERIES),
}

const TABS = [
  ['inicio', 'Início'],
  ['investimentos', 'Investimentos'],
  ['estudos', 'Estudos'],
  ['agenda', 'Agenda'],
  ['noticias', 'Notícias'],
] as const
type Tab = (typeof TABS)[number][0]

const tabFromHash = (): Tab => TABS.find(([id]) => window.location.hash === `#/${id}`)?.[0] ?? 'inicio'

export function App({ makePrices, news, generalNews, auth = import.meta.env.PROD, fetchFn = fetch }: Props = {}) {
  const defaults = auth ? published : local
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [status, setStatus] = useState<'checking' | 'login' | 'ready'>(auth ? 'checking' : 'ready')
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function enter() {
    setStatus('checking')
    startSync(fetchFn, localStorage)
      .catch(() => setOffline(true))
      .finally(() => setStatus('ready'))
  }

  useEffect(() => {
    if (!auth) return
    let alive = true
    fetchFn('/api/session')
      .then((res) => {
        if (!alive) return
        if (res.ok) enter()
        else setStatus('login')
      })
      .catch(() => {
        // sem rede ao abrir: usa os dados deste aparelho até a conexão voltar
        if (!alive) return
        setOffline(true)
        setStatus('ready')
      })
    return () => {
      alive = false
    }
  }, [auth, fetchFn])

  function logout() {
    fetchFn('/api/logout', { method: 'POST' })
      .catch(() => undefined)
      .finally(() => {
        setWriteListener(null)
        setStatus('login')
      })
  }

  if (status === 'checking') return <p className="page muted">Carregando…</p>
  if (status === 'login') return <LoginPage fetchFn={fetchFn} onLogin={enter} />

  return (
    <>
      <header className="app-head">
        <div className="head-row">
          <h1>Meu painel</h1>
          {auth && (
            <button type="button" className="ghost" onClick={logout}>
              Sair
            </button>
          )}
        </div>
        <nav className="tabs" aria-label="Seções">
          {TABS.map(([id, label]) => (
            <a key={id} href={`#/${id}`} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
              {label}
            </a>
          ))}
        </nav>
      </header>
      {offline && (
        <p className="page banner" role="status">
          Sem conexão com o servidor: usando os dados deste aparelho. As mudanças vão quando a conexão voltar.
        </p>
      )}
      {tab === 'inicio' && <HomePage />}
      {tab === 'investimentos' && (
        <InvestmentsPage makePrices={makePrices ?? defaults.makePrices} news={news ?? defaults.news} serverPrices={auth} />
      )}
      {tab === 'estudos' && <StudyPage />}
      {tab === 'agenda' && <AgendaPage />}
      {tab === 'noticias' && <NewsPage news={generalNews ?? defaults.generalNews} />}
    </>
  )
}
