import { useState } from 'react'
import { createMarkets, type Markets } from '../data/markets'
import type { NewsSource } from '../data/news'
import type { PriceProvider } from '../data/prices'
import { loadEvents, loadPositions, loadSettings } from '../data/storage'
import { countdownLabel, DEFAULT_ROUTINE, importantDates, planDay } from '../domain/agenda'
import {
  CLASSES,
  dayChange,
  isPriced,
  labelOf,
  maturityEvents,
  positionValue,
  priceKey,
  resolveTargets,
  totals,
} from '../domain/portfolio'
import { yearVersus } from '../domain/portfolioLab'
import { hhmm, localDate, longDate, money, pct, signedMoney } from './format'
import { LineChart } from './LineChart'
import { MonthCalendar } from './MonthCalendar'
import { NewsFeed } from './NewsFeed'
import { useBenchmarks } from './useBenchmarks'
import { useHistory } from './useHistory'
import { usePrices } from './usePrices'
import { useSnapshots } from './useSnapshots'

const defaultMarkets = createMarkets()
const TOP = 6 // ativos com cotação na lista do Início
const percent = (n: number) => `${Math.round(n * 100)}%`
const tone = (n: number) => (n >= 0 ? 'up' : 'dn')

type Props = {
  makePrices: (token: string | undefined) => PriceProvider
  markets?: Markets
  news: NewsSource
  now?: () => Date
  store?: Storage
}

// Tela inicial em três partes: investimentos, calendário e notícias, nessa ordem no celular.
// No computador elas viram colunas: notícias, investimentos e calendário.
export function HomePage({ makePrices, markets = defaultMarkets, news, now = () => new Date(), store = localStorage }: Props) {
  const [settings] = useState(() => loadSettings(store))
  const [positions] = useState(() => loadPositions(store))
  const { quotes, error } = usePrices(positions, { makePrices, token: settings.brapiToken, markets, store, now })
  const today = localDate(now())
  const [selected, setSelected] = useState(today)

  // Os vencimentos da renda fixa entram no calendário junto com os compromissos.
  const events = [...loadEvents(store), ...maturityEvents(positions)]
  // Sem dias de trabalho, o plano fica só com os compromissos e os vencimentos; a rotina continua na Agenda.
  const plan = planDay(selected, { ...DEFAULT_ROUTINE, workDays: [] }, events)
  const upcoming = importantDates(events, today, 3)

  const prices = Object.fromEntries(quotes.map((q) => [q.symbol, q.price]))
  const sums = totals(positions, prices)
  const ready = sums.missing.length === 0 && sums.total > 0
  // Com um preço velho na conta, a variação já não é a do dia: ela some até a fonte voltar.
  const change = ready ? dayChange(positions, quotes.filter((q) => !q.stale)) : null
  // Preço velho não entra na evolução: o dia só é gravado com todas as fontes de hoje.
  const snapshots = useSnapshots(ready && !quotes.some((q) => q.stale) ? sums.total : null, today, store)
  const days = Object.entries(snapshots).sort(([a], [b]) => a.localeCompare(b))
  const history = useHistory(positions, { makePrices, token: settings.brapiToken, markets, store, today })
  const benchmarks = useBenchmarks({ markets, store, today })
  const versus = ready
    ? yearVersus(
        positions.filter(isPriced).map((p) => ({ points: history.series[priceKey(p)] ?? [], value: positionValue(p, prices) ?? 0 })),
        benchmarks.ibov,
        benchmarks.cdi,
      )
    : null
  const versusText = (label: string, n: number | null | undefined) => (n == null ? [] : [`${label} ${pct(n * 100)}`])
  const target = resolveTargets(settings)
  // As classes com valor pegam as cores da paleta em ordem: vizinhas na barra são sempre vizinhas na paleta, o único
  // jeito de as 8 cores passarem no teste de daltonismo. Classe só com meta entra na legenda, sem cor.
  const held = CLASSES.filter((c) => sums.byClass[c.id] > 0)
  const classes = CLASSES.filter((c) => sums.byClass[c.id] > 0 || (target?.[c.id] ?? 0) > 0).map((c) => {
    const slot = held.indexOf(c)
    return { ...c, value: sums.byClass[c.id], goal: target?.[c.id] ?? 0, color: slot >= 0 ? `var(--viz-${slot + 1})` : undefined }
  })
  // Os maiores ativos com cotação; enquanto não há preço, vale a ordem do cadastro.
  const top = positions
    .filter(isPriced)
    .map((p) => ({ id: p.id, key: priceKey(p), label: labelOf(p), value: positionValue(p, prices) }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, TOP)

  return (
    <div className="page">
      <div className="today-head">
        <p className="today-date">{longDate(now())}</p>
        {quotes[0] && <span className="muted">preços de {hhmm(quotes[0].updatedAt)}</span>}
      </div>
      {error && (
        <p className="muted">
          {error === 'token ausente' ? 'Informe o token da brapi em Editar carteira para ver os preços.' : error}
        </p>
      )}

      <div className="home">
        <section className="home-invest" aria-label="Investimentos">
          <h2>Investimentos</h2>
          {positions.length === 0 ? (
            <div className="empty">
              <p className="muted">Cadastre o que você tem para ver o patrimônio, a variação do dia e a divisão por classe.</p>
              <a className="button" href="#/investimentos">
                Cadastrar investimentos
              </a>
            </div>
          ) : (
            <>
              <div className="worth">
                <span className="muted">Patrimônio</span>
                <b className="num">{ready ? money(sums.total) : '—'}</b>
                {change && (
                  <span className={`num ${tone(change.value)}`}>
                    {signedMoney(change.value)} ({pct(change.pct)}) no dia
                  </span>
                )}
              </div>
              {days.length > 1 && (
                <LineChart
                  height={64}
                  label="Evolução do patrimônio"
                  dates={days.map(([d]) => d.split('-').reverse().join('/'))}
                  format={money}
                  series={[{ label: 'Patrimônio', values: days.map(([, v]) => v), color: 'var(--viz-1)' }]}
                />
              )}
              {versus && (
                <p className="muted versus">
                  Em 1 ano: {[...versusText('seus ativos', versus.you), ...versusText('Ibovespa', versus.ibov), ...versusText('CDI', versus.cdi)].join(' · ')}
                </p>
              )}
              {ready ? (
                <>
                  <div className="class-bar" aria-hidden="true">
                    {classes
                      .filter((c) => c.color)
                      .map((c) => (
                        <i key={c.id} style={{ flexGrow: c.value, background: c.color }} />
                      ))}
                  </div>
                  <ul className="class-legend" aria-label="Divisão por classe">
                    {classes.map((c) => (
                      <li key={c.id}>
                        <span className="dot" style={{ background: c.color ?? 'var(--bd)' }} aria-hidden="true" />
                        <span>{c.label}</span>
                        <span className="num muted">
                          {percent(c.value / sums.total)}
                          {target ? ` · meta ${percent(c.goal)}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="muted">A divisão aparece quando os preços carregarem.</p>
              )}
              {top.length > 0 && (
                <ul className="list assets" aria-label="Seus ativos">
                  {top.map((a) => {
                    const q = quotes.find((x) => x.symbol === a.key)
                    return (
                      <li key={a.id}>
                        <span className="asset-name">{a.label}</span>
                        <span className={`num ${q ? tone(q.changePct) : ''}`}>{q && pct(q.changePct)}</span>
                        <span className="num">{a.value === null ? '—' : money(a.value)}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
              <a className="more" href="#/investimentos">
                Editar carteira
              </a>
            </>
          )}
        </section>

        <section className="home-cal" aria-label="Calendário">
          <h2>Calendário</h2>
          <MonthCalendar events={events} today={today} selected={selected} onSelect={setSelected} />
          <h3 className="sub">{selected === today ? 'Hoje' : longDate(new Date(`${selected}T12:00:00`))}</h3>
          {plan.length === 0 ? (
            <p className="muted">Nada para este dia.</p>
          ) : (
            <ul className="tl">
              {plan.map((b, i) => (
                <li key={i} className={b.kind}>
                  <span className="num">{b.start ? `${b.start}–${b.end}` : 'Dia todo'}</span> {b.title}
                </li>
              ))}
            </ul>
          )}
          {upcoming.length > 0 && (
            <>
              <h3 className="sub">Próximas datas</h3>
              <ul className="list">
                {upcoming.map(({ event, days }) => (
                  <li key={event.id} className="item">
                    <span>{event.title}</span>
                    <span className="pill warn">{countdownLabel(days)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <a className="more" href="#/agenda">
            Abrir agenda
          </a>
        </section>

        <section className="home-news" aria-label="Notícias">
          <h2>Notícias</h2>
          <NewsFeed news={news} now={now} store={store} limit={8} title="" layout="lead" />
          <a className="more" href="#/noticias">
            Ver todas as notícias
          </a>
        </section>
      </div>
    </div>
  )
}
