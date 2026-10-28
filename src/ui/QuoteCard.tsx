import type { Quote } from '../data/prices'
import type { Signal } from '../domain/signal'
import { hhmm, money, pct } from './format'

function Sparkline({ symbol, points }: { symbol: string; points: Quote['intraday'] }) {
  const ps = points.map((p) => p.p)
  const min = Math.min(...ps)
  const span = Math.max(...ps) - min || 1
  const line = ps
    .map((p, i) => `${(i / Math.max(ps.length - 1, 1)) * 300},${110 - ((p - min) / span) * 100}`)
    .join(' ')
  return (
    <svg className="spark" viewBox="0 0 300 120" preserveAspectRatio="none" role="img" aria-label={`Gráfico do dia de ${symbol}`}>
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const signalClass = { 'mais positivo': 'up', 'mais negativo': 'dn', neutro: 'mut', 'sem dados': 'mut' } as const

export function QuoteCard({ symbol, quote, signal }: { symbol: string; quote?: Quote; signal: Signal }) {
  return (
    <section className="card" aria-label={symbol}>
      <header className="card-head">
        <h2>{symbol}</h2>
        {quote?.stale && <span className="pill warn">dado velho</span>}
      </header>
      {quote ? (
        <>
          <p className="price num">{money(quote.price)}</p>
          <p className={`num ${quote.changePct >= 0 ? 'up' : 'dn'}`}>{pct(quote.changePct)}</p>
          <p className="muted">atualizado às {hhmm(quote.updatedAt)}</p>
          {quote.intraday.length > 1 ? (
            <Sparkline symbol={symbol} points={quote.intraday} />
          ) : (
            <p className="muted">Sem gráfico do dia: mercado fechado ou dados indisponíveis.</p>
          )}
        </>
      ) : (
        <p className="muted">Sem preço ainda.</p>
      )}
      <p className="signal">
        Sinal das notícias: <span className={`pill ${signalClass[signal.label]}`}>{signal.label}</span>
      </p>
      {signal.agreesWithPrice !== null && (
        <p className="muted">
          {signal.agreesWithPrice ? 'O preço do dia está na mesma direção.' : 'O preço do dia está na direção oposta.'}
        </p>
      )}
    </section>
  )
}
