import { createBrapiProvider, type PriceProvider } from '../data/prices'
import { createGoogleNewsSource, type NewsSource } from '../data/news'
import { lexiconClassifier } from '../domain/tone'
import { InvestmentsPage } from './InvestmentsPage'

type Props = {
  makePrices?: (token: string | undefined) => PriceProvider
  news?: NewsSource
}

const defaultMakePrices = (token: string | undefined) => createBrapiProvider(token)
const defaultNews = createGoogleNewsSource(undefined, lexiconClassifier)

export function App({ makePrices = defaultMakePrices, news = defaultNews }: Props = {}) {
  return (
    <>
      <header className="app-head">
        <h1>Meu painel</h1>
      </header>
      <InvestmentsPage makePrices={makePrices} news={news} />
    </>
  )
}
