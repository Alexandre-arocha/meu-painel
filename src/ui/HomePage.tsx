import { useMemo, useState } from 'react'
import type { NewsSource } from '../data/news'
import type { PriceProvider } from '../data/prices'
import { SEED_QUESTIONS } from '../data/questions'
import { loadAttempts, loadCustomQuestions, loadEvents, loadPortfolio, loadRoutine, loadSettings, saveAttempts } from '../data/storage'
import { countdownLabel, importantDates, planDay } from '../domain/agenda'
import { allocation, portfolioValue, type Allocation } from '../domain/portfolio'
import { pickNext, wrongQuestions, type Attempt, type Question } from '../domain/study'
import { hhmm, localDate, longDate, money, pct } from './format'
import { NewsFeed } from './NewsFeed'
import { QuestionView } from './QuestionView'
import { SYMBOLS, useQuotes } from './useQuotes'

const DAILY_GOAL = 20
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
  rand?: () => number
}

// Tela única: números do dia, notícias, questão, carteira e agenda. No celular vira uma coluna nessa ordem.
export function HomePage({ makePrices, news, now = () => new Date(), store = localStorage, rand = Math.random }: Props) {
  const [settings] = useState(() => loadSettings(store))
  const [portfolio] = useState(() => loadPortfolio(store))
  const { quotes, error } = useQuotes(makePrices, settings.brapiToken, store)

  const questions = useMemo(() => {
    const seedIds = new Set(SEED_QUESTIONS.map((q) => q.id))
    return [...SEED_QUESTIONS, ...loadCustomQuestions(store).filter((q) => !seedIds.has(q.id))]
  }, [store])
  const [attempts, setAttempts] = useState<Attempt[]>(() => loadAttempts(store))
  const [current, setCurrent] = useState<Question | undefined>(() => pickNext(questions, attempts, { mode: 'livre' }, rand))
  const [chosen, setChosen] = useState<number | null>(null)

  function answer(i: number) {
    if (!current || chosen !== null) return
    setChosen(i)
    const list = [...attempts, { questionId: current.id, correct: i === current.answer, at: now().toISOString() }]
    setAttempts(list)
    saveAttempts(list, store)
  }

  function nextQuestion() {
    setChosen(null)
    setCurrent(pickNext(questions, attempts, { mode: 'livre' }, rand, current?.id))
  }

  const today = localDate(now())
  const doneToday = attempts.filter((a) => localDate(new Date(a.at)) === today).length
  const pending = wrongQuestions(questions, attempts).length
  const events = loadEvents(store)
  const plan = planDay(today, loadRoutine(store), events)
  const nextDate = importantDates(events, today, 1)[0]

  const prices = Object.fromEntries(quotes.map((q) => [q.symbol, q.price]))
  const total = portfolioValue(portfolio, prices)
  const empty = !(portfolio.fixedIncome.amount > 0) && portfolio.holdings.every((h) => h.quantity <= 0)
  const missingPrice = portfolio.holdings.some((h) => h.quantity > 0 && !Number.isFinite(prices[h.symbol]))
  const split = allocation(portfolio, prices)
  const target = settings.targetAllocation

  return (
    <div className="page today">
      <div className="today-head">
        <p className="today-date">{longDate(now())}</p>
        {quotes[0] && <span className="muted">preços de {hhmm(quotes[0].updatedAt)}</span>}
      </div>
      {error && (
        <p className="muted">
          {error === 'token ausente' ? 'Informe o token da brapi na aba Investimentos para ver os preços.' : error}
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
        <div className="metric">
          <span className="muted">Estudo hoje</span>
          <b className="num">{`${doneToday} de ${DAILY_GOAL}`}</b>
          <span className="muted">{pending === 1 ? '1 erro para revisar' : `${pending} erros para revisar`}</span>
        </div>
      </div>

      <div className="cols">
        <section aria-label="Notícias">
          <h2>Notícias</h2>
          <NewsFeed news={news} now={now} store={store} limit={8} title="" />
        </section>

        <section aria-label="Questão do dia">
          <h2>Questão do dia</h2>
          {current ? (
            <QuestionView question={current} chosen={chosen} onAnswer={answer} onNext={nextQuestion} />
          ) : (
            <p className="muted">Nenhuma questão disponível.</p>
          )}
          <a className="more" href="#/estudos">
            Abrir estudos
          </a>
        </section>

        <section aria-label="Carteira e agenda">
          <h2>Carteira</h2>
          {empty ? (
            <p className="muted">Informe suas quantidades na aba Investimentos.</p>
          ) : missingPrice ? (
            <p className="muted">A divisão aparece quando os preços carregarem.</p>
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
