import { useState } from 'react'
import { createMarkets, type Markets } from '../data/markets'
import type { NewsSource } from '../data/news'
import type { PriceProvider } from '../data/prices'
import { loadEvents, loadPositions, loadRoutine, loadSettings } from '../data/storage'
import { countdownLabel, importantDates, planDay } from '../domain/agenda'
import { CLASSES, isPriced, labelOf, positionValue, priceKey, resolveTargets, totals } from '../domain/portfolio'
import { hhmm, localDate, longDate, money, pct } from './format'
import { NewsFeed } from './NewsFeed'
import { usePrices } from './usePrices'

const defaultMarkets = createMarkets()
const TOP = 3 // ativos com cotação na linha de números
const percent = (n: number) => `${Math.round(n * 100)}%`

type Props = {
  makePrices: (token: string | undefined) => PriceProvider
  markets?: Markets
  news: NewsSource
  now?: () => Date
  store?: Storage
}

// Tela única: números do dia, notícias, carteira e agenda. No celular vira uma coluna nessa ordem.
export function HomePage({ makePrices, markets = defaultMarkets, news, now = () => new Date(), store = localStorage }: Props) {
  const [settings] = useState(() => loadSettings(store))
  const [positions] = useState(() => loadPositions(store))
  const { quotes, error } = usePrices(positions, { makePrices, token: settings.brapiToken, markets, store, now })

  const today = localDate(now())
  const events = loadEvents(store)
  const plan = planDay(today, loadRoutine(store), events)
  const nextDate = importantDates(events, today, 1)[0]

  const prices = Object.fromEntries(quotes.map((q) => [q.symbol, q.price]))
  const sums = totals(positions, prices)
  const missingPrice = sums.missing.length > 0
  const target = resolveTargets(settings)
  // Os maiores ativos com cotação; enquanto não há preço, vale a ordem do cadastro.
  const top = positions
    .filter(isPriced)
    .map((p) => ({ key: priceKey(p), label: labelOf(p), value: positionValue(p, prices) ?? 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP)
  const shown = CLASSES.filter((c) => sums.byClass[c.id] > 0)

  function allocationNote(): string | null {
    if (positions.length === 0) return 'Toque em Editar carteira para cadastrar seus investimentos.'
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
        {top.map((a) => {
          const q = quotes.find((x) => x.symbol === a.key)
          return (
            <div className="metric" key={a.key}>
              <span className="muted">{a.label}</span>
              <b className="num">{q ? money(q.price) : '—'}</b>
              {q && <span className={`num ${q.changePct >= 0 ? 'up' : 'dn'}`}>{pct(q.changePct)}</span>}
            </div>
          )
        })}
        <div className="metric">
          <span className="muted">Carteira</span>
          <b className="num">{missingPrice ? '—' : money(sums.total)}</b>
          {!missingPrice && sums.total > 0 && <span className="muted">{percent(sums.byClass['renda-fixa'] / sums.total)} em renda fixa</span>}
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
            shown.map((c) => (
              <div className="alloc" key={c.id}>
                <div className="alloc-row">
                  <span>{c.label}</span>
                  <span className="num">
                    {percent(sums.byClass[c.id] / sums.total)}
                    {target ? ` · meta ${percent(target[c.id])}` : ''}
                  </span>
                </div>
                <div className="bar" aria-hidden="true">
                  <i style={{ width: percent(sums.byClass[c.id] / sums.total) }} />
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
