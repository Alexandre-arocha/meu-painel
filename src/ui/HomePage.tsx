import { useState } from 'react'
import type { NewsSource } from '../data/news'
import type { PriceProvider } from '../data/prices'
import { loadEvents, loadPortfolio, loadRoutine, loadSettings } from '../data/storage'
import { countdownLabel, importantDates, planDay } from '../domain/agenda'
import { allocation, portfolioValue, type Allocation } from '../domain/portfolio'
import { hhmm, localDate, longDate, money, pct } from './format'
import { NewsFeed } from './NewsFeed'
import { SYMBOLS, useQuotes } from './useQuotes'

const PARTS: [keyof Allocation, string][] = [
  ['fixedIncome', 'Renda fixa'],
  ['BBAS3', 'BBAS3'],
  ['B3SA3', 'B3SA3'],
]
const percent = (n: number) => `${Math.round(n * 100)}%`

type Props = {
  makePrices: (token: string | undefined) => PriceProvider
  news: NewsSource
  now?: () => Date
  store?: Storage
}

// Tela única: números do dia, notícias, carteira e agenda. No celular vira uma coluna nessa ordem.
export function HomePage({ makePrices, news, now = () => new Date(), store = localStorage }: Props) {
  const [settings] = useState(() => loadSettings(store))
  const [portfolio] = useState(() => loadPortfolio(store))
  const { quotes, error } = useQuotes(makePrices, settings.brapiToken, store)

  const today = localDate(now())
  const events = loadEvents(store)
  const plan = planDay(today, loadRoutine(store), events)
  const nextDate = importantDates(events, today, 1)[0]

  const prices = Object.fromEntries(quotes.map((q) => [q.symbol, q.price]))
  const total = portfolioValue(portfolio, prices)
  const empty = !(portfolio.fixedIncome.amount > 0) && portfolio.holdings.every((h) => h.quantity <= 0)
  const missingPrice = portfolio.holdings.some((h) => h.quantity > 0 && !Number.isFinite(prices[h.symbol]))
  const split = allocation(portfolio, prices)
  const target = settings.targetAllocation

  function allocationNote(): string | null {
    if (empty) return 'Toque em Editar carteira para informar suas quantidades.'
    if (missingPrice) return 'A divisão aparece quando os preços carregarem.'
    return null
  }
  const note = allocationNote()

  return (
    <div className="page today">
      <div className="today-head">
        <p className="today-date">{longDate(now())}</p>
        {quotes[0] && <span className="muted">preços de {hhmm(quotes[0].updatedAt)}</span>}
      </div>
      {error && (
        <p className="muted">
          {error === 'token ausente' ? 'Informe o token da brapi em Editar carteira para ver os preços.' : error}
        </p>
      )}
      <div className="metrics">
        {SYMBOLS.map((s) => {
          const q = quotes.find((x) => x.symbol === s)
          return (
            <div className="metric" key={s}>
              <span className="muted">{s}</span>
              <b className="num">{q ? money(q.price) : '—'}</b>
              {q && <span className={`num ${q.changePct >= 0 ? 'up' : 'dn'}`}>{pct(q.changePct)}</span>}
            </div>
          )
        })}
        <div className="metric">
          <span className="muted">Carteira</span>
          <b className="num">{missingPrice ? '—' : money(total)}</b>
          {!missingPrice && total > 0 && <span className="muted">{percent(split.fixedIncome)} em renda fixa</span>}
        </div>
      </div>

      <div className="cols">
        <section aria-label="Notícias">
          <h2>Notícias</h2>
          <NewsFeed news={news} now={now} store={store} limit={8} title="" />
          <a className="more" href="#/noticias">
            Ver todas as notícias
          </a>
        </section>

        <section aria-label="Carteira e agenda">
          <h2>Carteira</h2>
          {note ? (
            <p className="muted">{note}</p>
          ) : (
            PARTS.map(([key, label]) => (
              <div className="alloc" key={key}>
                <div className="alloc-row">
                  <span>{label}</span>
                  <span className="num">
                    {percent(split[key])}
                    {target ? ` · meta ${percent(target[key])}` : ''}
                  </span>
                </div>
                <div className="bar" aria-hidden="true">
                  <i style={{ width: percent(split[key]) }} />
                </div>
              </div>
            ))
          )}
          <a className="more" href="#/investimentos">
            Editar carteira
          </a>

          <h2>Hoje</h2>
          {plan.length === 0 ? (
            <p className="muted">Nada para hoje.</p>
          ) : (
            <ul className="list">
              {plan.slice(0, 5).map((b, i) => (
                <li key={i}>
                  <span className="num muted">{b.start || 'Dia todo'}</span> {b.title}
                </li>
              ))}
            </ul>
          )}
          {nextDate && (
            <div className="row">
              <span>Próxima data</span>
              <span>
                {nextDate.event.title} · {countdownLabel(nextDate.days)}
              </span>
            </div>
          )}
          <a className="more" href="#/agenda">
            Abrir agenda
          </a>
        </section>
      </div>
    </div>
  )
}
