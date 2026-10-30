import { useEffect, useState } from 'react'
import { createBrapiProvider, createProxyPriceProvider, type PriceProvider } from '../data/prices'
import { GENERAL_QUERIES, createGoogleNewsSource, type NewsSource } from '../data/news'
import { loadTheme, saveTheme, setWriteListener, type Theme } from '../data/storage'
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

// Ícones de traço simples; herdam a cor do botão.
function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

const tabFromHash = (): Tab => TABS.find(([id]) => window.location.hash === `#/${id}`)?.[0] ?? 'inicio'

export function App({ makePrices, news, generalNews, auth = import.meta.env.PROD, fetchFn = fetch }: Props = {}) {
  const defaults = auth ? published : local
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [status, setStatus] = useState<'checking' | 'login' | 'ready'>(auth ? 'checking' : 'ready')
  const [offline, setOffline] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => loadTheme())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#ffffff' : '#000000')
  }, [theme])

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

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    saveTheme(next)
  }

  if (status === 'checking') return <p className="page muted">Carregando…</p>
  if (status === 'login') return <LoginPage fetchFn={fetchFn} onLogin={enter} />

  return (
    <>
      <header className="app-head">
        <div className="head-row">
          <h1>Meu painel</h1>
          <div className="head-actions">
            <button
              type="button"
              className="ghost icon"
              aria-label={theme === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            {auth && (
              <button type="button" className="ghost" onClick={logout}>
                Sair
              </button>
            )}
          </div>
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
      {tab === 'inicio' && (
        <HomePage makePrices={makePrices ?? defaults.makePrices} news={generalNews ?? defaults.generalNews} />
      )}
      {tab === 'investimentos' && (
        <InvestmentsPage makePrices={makePrices ?? defaults.makePrices} news={news ?? defaults.news} serverPrices={auth} />
      )}
      {tab === 'estudos' && <StudyPage />}
      {tab === 'agenda' && <AgendaPage />}
      {tab === 'noticias' && <NewsPage news={generalNews ?? defaults.generalNews} />}
    </>
  )
}
