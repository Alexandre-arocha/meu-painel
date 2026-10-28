import { createBrapiProvider, type PriceProvider } from '../data/prices'
import { createGoogleNewsSource, type NewsSource } from '../data/news'
import { lexiconClassifier } from '../domain/tone'
import { useEffect, useState } from 'react'
import { AgendaPage } from './AgendaPage'
import { HomePage } from './HomePage'
import { InvestmentsPage } from './InvestmentsPage'
import { StudyPage } from './StudyPage'

type Props = {
  makePrices?: (token: string | undefined) => PriceProvider
  news?: NewsSource
}

const defaultMakePrices = (token: string | undefined) => createBrapiProvider(token)
const defaultNews = createGoogleNewsSource(undefined, lexiconClassifier)

const TABS = [
  ['inicio', 'Início'],
  ['investimentos', 'Investimentos'],
  ['estudos', 'Estudos'],
  ['agenda', 'Agenda'],
] as const
type Tab = (typeof TABS)[number][0]

const tabFromHash = (): Tab => TABS.find(([id]) => window.location.hash === `#/${id}`)?.[0] ?? 'inicio'

export function App({ makePrices = defaultMakePrices, news = defaultNews }: Props = {}) {
  const [tab, setTab] = useState<Tab>(tabFromHash)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <>
      <header className="app-head">
        <h1>Meu painel</h1>
        <nav className="tabs" aria-label="Seções">
          {TABS.map(([id, label]) => (
            <a key={id} href={`#/${id}`} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
              {label}
            </a>
          ))}
        </nav>
      </header>
      {tab === 'inicio' && <HomePage />}
      {tab === 'investimentos' && <InvestmentsPage makePrices={makePrices} news={news} />}
      {tab === 'estudos' && <StudyPage />}
      {tab === 'agenda' && <AgendaPage />}
    </>
  )
}
