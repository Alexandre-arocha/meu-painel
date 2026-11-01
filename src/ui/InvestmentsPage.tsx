import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createMarkets, lookupAsset, type Markets } from '../data/markets'
import type { NewsItem, NewsSource } from '../data/news'
import type { PriceProvider } from '../data/prices'
import { loadPositions, loadSettings, savePositions, saveSettings, type Settings } from '../data/storage'
import { priceKeys, resolveTargets, totals, type Position } from '../domain/portfolio'
import { AllocationCard } from './AllocationCard'
import { localDate } from './format'
import { PositionsCard } from './PositionsCard'
import { QuantEngine } from './QuantEngine'
import { useHistory } from './useHistory'
import { usePrices } from './usePrices'

const defaultMarkets = createMarkets()

type Props = {
  makePrices: (token: string | undefined) => PriceProvider
  markets?: Markets
  news: NewsSource
  now?: () => Date
  store?: Storage
  serverPrices?: boolean // app publicado: o token mora na Vercel, sem campo de token aqui
}

export function InvestmentsPage({ makePrices, markets = defaultMarkets, news, now = () => new Date(), store = localStorage, serverPrices = false }: Props) {
  const [positions, setPositions] = useState<Position[]>(() => loadPositions(store))
  const [settings, setSettings] = useState(() => loadSettings(store))
  const [items, setItems] = useState<NewsItem[]>([])
  const [tokenDraft, setTokenDraft] = useState(settings.brapiToken ?? '')
  const token = settings.brapiToken
  const { quotes, error } = usePrices(positions, { makePrices, token, markets, store, now })
  // Uma busca só do histórico para o motor: 1 por ativo por dia.
  const history = useHistory(positions, { makePrices, token, markets, store, today: localDate(now()) })
  const assetKeys = priceKeys(positions).join(',')

  // As notícias de cada ativo alimentam o sinal do motor; a busca refaz quando entra ou sai um ativo.
  useEffect(() => {
    let alive = true
    news
      .fetchNews()
      .then((n) => alive && setItems(n))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [news, assetKeys])

  const prices = useMemo(() => Object.fromEntries(quotes.map((q) => [q.symbol, q.price])), [quotes])
  const targets = resolveTargets(settings)

  function update(next: Settings) {
    setSettings(next)
    saveSettings(next, store)
  }

  function saveToken(e: FormEvent) {
    e.preventDefault()
    update({ ...settings, brapiToken: tokenDraft.trim() || undefined })
  }

  return (
    <div className="page">
      {error && (
        <p className="banner" role="alert">
          {error === 'token ausente' ? 'Informe o token da brapi para ver os preços da B3.' : error}
        </p>
      )}
      <div className="grid">
        <PositionsCard
          positions={positions}
          quotes={quotes}
          lookup={(kind, symbol) => lookupAsset(kind, symbol, markets, makePrices(token))}
          onSave={(next) => {
            setPositions(next)
            savePositions(next, store)
          }}
        />
        <QuantEngine history={history} positions={positions} quotes={quotes} targets={targets} news={items} now={new Date(now())} />
        <AllocationCard
          key={JSON.stringify(targets ?? null)}
          totals={totals(positions, prices)}
          target={targets}
          onTarget={(classTargets) => update({ ...settings, classTargets })}
        />
        {!serverPrices && (
          <section className="card" aria-label="Configurações">
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
