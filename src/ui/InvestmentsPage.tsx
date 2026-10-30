import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { PriceProvider } from '../data/prices'
import type { NewsItem, NewsSource } from '../data/news'
import { loadPortfolio, loadSettings, savePortfolio, saveSettings } from '../data/storage'
import { allocation, type Portfolio } from '../domain/portfolio'
import { computeSignal } from '../domain/signal'
import { AllocationCard } from './AllocationCard'
import { NewsList } from './NewsList'
import { PortfolioCard } from './PortfolioCard'
import { QuoteCard } from './QuoteCard'
import { SYMBOLS, useQuotes } from './useQuotes'

type Props = {
  makePrices: (token: string | undefined) => PriceProvider
  news: NewsSource
  now?: () => Date
  store?: Storage
  serverPrices?: boolean // app publicado: o token mora na Vercel, sem campo de token aqui
}

export function InvestmentsPage({ makePrices, news, now = () => new Date(), store = localStorage, serverPrices = false }: Props) {
  const [portfolio, setPortfolio] = useState<Portfolio>(() => loadPortfolio(store))
  const [settings, setSettings] = useState(() => loadSettings(store))
  const [items, setItems] = useState<NewsItem[]>([])
  const [tokenDraft, setTokenDraft] = useState(settings.brapiToken ?? '')
  const token = settings.brapiToken
  const { quotes, error } = useQuotes(makePrices, token, store)

  useEffect(() => {
    let alive = true
    news
      .fetchNews()
      .then((n) => alive && setItems(n))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [news])

  const prices = useMemo(() => Object.fromEntries(quotes.map((q) => [q.symbol, q.price])), [quotes])
  const current = new Date(now())

  function saveToken(e: FormEvent) {
    e.preventDefault()
    const next = { ...settings, brapiToken: tokenDraft.trim() || undefined }
    setSettings(next)
    saveSettings(next, store)
  }

  return (
    <div className="page">
      {error && (
        <p className="banner" role="alert">
          {error === 'token ausente' ? 'Informe o token da brapi para ver os preços.' : error}
        </p>
      )}
      <div className="grid">
        {SYMBOLS.map((s) => (
          <QuoteCard
            key={s}
            symbol={s}
            quote={quotes.find((q) => q.symbol === s)}
            signal={computeSignal(
              items.filter((i) => i.tags.includes(s)),
              quotes.find((q) => q.symbol === s),
              current,
            )}
          />
        ))}
        <PortfolioCard
          key={JSON.stringify(portfolio)}
          portfolio={portfolio}
          onSave={(p) => {
            setPortfolio(p)
            savePortfolio(p, store)
          }}
        />
        <AllocationCard
          key={JSON.stringify(settings.targetAllocation ?? null)}
          allocation={allocation(portfolio, prices)}
          target={settings.targetAllocation}
          onTarget={(t) => {
            const next = { ...settings, targetAllocation: t }
            setSettings(next)
            saveSettings(next, store)
          }}
        />
        <NewsList items={items} now={current} />
        {!serverPrices && (
        <section className="card wide" aria-label="Configurações">
          <h2>Configurações</h2>
          <form onSubmit={saveToken}>
            <div className="field">
              <label htmlFor="token">Token da brapi</label>
              <input id="token" type="password" autoComplete="off" value={tokenDraft} onChange={(e) => setTokenDraft(e.target.value)} />
              <p className="muted">Fica só neste aparelho. Crie um token gratuito em brapi.dev.</p>
            </div>
            <button type="submit">Salvar token</button>
          </form>
        </section>
        )}
      </div>
      <p className="notice">Sinal de apoio, não é previsão garantida.</p>
    </div>
  )
}
