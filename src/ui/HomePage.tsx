import { SEED_QUESTIONS } from '../data/questions'
import { loadAttempts, loadCustomQuestions, loadQuotes } from '../data/storage'
import { wrongQuestions } from '../domain/study'
import { localDate, money, pct } from './format'

const DAILY_GOAL = 20

export function HomePage({ now = () => new Date(), store = localStorage }: { now?: () => Date; store?: Storage }) {
  const today = localDate(now())
  const quotes = loadQuotes(store)
  const attempts = loadAttempts(store)
  const doneToday = attempts.filter((a) => localDate(new Date(a.at)) === today).length
  const pending = wrongQuestions([...SEED_QUESTIONS, ...loadCustomQuestions(store)], attempts).length

  return (
    <div className="page">
      <div className="grid">
        <section className="card" aria-label="Resumo de investimentos">
          <h2>Investimentos</h2>
          {quotes.length === 0 ? (
            <p className="muted">Informe o token da brapi na aba Investimentos para ver os preços.</p>
          ) : (
            quotes.map((q) => (
              <div className="row" key={q.symbol}>
                <span>{q.symbol}</span>
                <span className={`num ${q.changePct >= 0 ? 'up' : 'dn'}`}>
                  {money(q.price)} · {pct(q.changePct)}
                </span>
              </div>
            ))
          )}
          <a className="more" href="#/investimentos">
            Abrir investimentos
          </a>
        </section>

        <section className="card" aria-label="Resumo de estudos">
          <h2>Estudos hoje</h2>
          <div className="row">
            <span>Meta do dia</span>
            <span className="num">
              {doneToday} de {DAILY_GOAL} questões
            </span>
          </div>
          <div className="bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (doneToday / DAILY_GOAL) * 100)}%` }} />
          </div>
          <div className="row">
            <span>Para revisar</span>
            <span className="num">{pending}</span>
          </div>
          <a className="more" href="#/estudos">
            Abrir estudos
          </a>
        </section>
      </div>
    </div>
  )
}
