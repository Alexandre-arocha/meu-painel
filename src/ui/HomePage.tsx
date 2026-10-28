import { SEED_QUESTIONS } from '../data/questions'
import { safeLink } from '../data/news'
import { loadAttempts, loadCustomQuestions, loadEvents, loadNews, loadQuotes, loadRoutine } from '../data/storage'
import { countdownLabel, importantDates, planDay } from '../domain/agenda'
import { wrongQuestions } from '../domain/study'
import { localDate, money, pct } from './format'

const DAILY_GOAL = 20

export function HomePage({ now = () => new Date(), store = localStorage }: { now?: () => Date; store?: Storage }) {
  const today = localDate(now())
  const quotes = loadQuotes(store)
  const attempts = loadAttempts(store)
  const doneToday = attempts.filter((a) => localDate(new Date(a.at)) === today).length
  const pending = wrongQuestions([...SEED_QUESTIONS, ...loadCustomQuestions(store)], attempts).length
  const events = loadEvents(store)
  const plan = planDay(today, loadRoutine(store), events)
  const next = importantDates(events, today, 1)[0]
  const headlines = loadNews(store)?.items.slice(0, 3) ?? []

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

        <section className="card" aria-label="Resumo da agenda">
          <h2>Agenda de hoje</h2>
          {plan.length === 0 ? (
            <p className="muted">Nada para hoje.</p>
          ) : (
            <ul className="list">
              {plan.slice(0, 4).map((b, i) => (
                <li key={i}>
                  <span className="num">{b.start || 'Dia todo'}</span> {b.title}
                </li>
              ))}
            </ul>
          )}
          {next && (
            <div className="row">
              <span>Próxima data</span>
              <span>
                {next.event.title} · {countdownLabel(next.days)}
              </span>
            </div>
          )}
          <a className="more" href="#/agenda">
            Abrir agenda
          </a>
        </section>

        <section className="card" aria-label="Resumo de notícias">
          <h2>Notícias</h2>
          {headlines.length === 0 ? (
            <p className="muted">Abra a aba Notícias para buscar mercado, concursos e tecnologia.</p>
          ) : (
            <ul className="list">
              {headlines.map((n) => {
                const href = safeLink(n.link)
                return (
                  <li key={n.id} className="headline">
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" title="Abre em nova aba">
                        {n.title}
                      </a>
                    ) : (
                      n.title
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <a className="more" href="#/noticias">
            Abrir notícias
          </a>
        </section>
      </div>
    </div>
  )
}
