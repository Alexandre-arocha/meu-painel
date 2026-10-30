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

// Ícones da barra de abas do celular (no computador ficam escondidos pelo CSS).
const TAB_ICONS: Record<Tab, string> = {
  inicio: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
  investimentos: 'M3 17l6-6 4 4 8-8M14 7h7v7',
  estudos: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  agenda: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18',
  noticias: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM7 8h10M7 12h10M7 16h6',
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={TAB_ICONS[id]} />
              </svg>
              <span>{label}</span>
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
