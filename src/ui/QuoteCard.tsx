import type { Point, Quote } from '../data/prices'
import { withLivePrice } from '../domain/quant'
import type { Signal } from '../domain/signal'
import { dayMonth, hhmm, money, pct } from './format'
import { LineChart } from './LineChart'

const MONTH = 22 // pregões, cerca de um mês

const signalClass = { 'mais positivo': 'up', 'mais negativo': 'dn', neutro: 'mut', 'sem dados': 'mut' } as const

// Preço, variação e o último mês do histórico diário, que termina na cotação ao vivo.
export function QuoteCard({ symbol, quote, history, signal }: { symbol: string; quote?: Quote; history: Point[]; signal: Signal }) {
  const month = withLivePrice(history, quote).slice(-MONTH)
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
        </>
      ) : (
        <p className="muted">Sem preço ainda.</p>
      )}
      {month.length > 1 ? (
        <LineChart
          height={96}
          label={`Preço ajustado de ${symbol} no último mês`}
          dates={month.map((p) => dayMonth(p.t))}
          format={money}
          series={[{ label: 'Preço ajustado', values: month.map((p) => p.p), color: 'var(--viz-1)' }]}
        />
      ) : (
        <p className="muted">Sem histórico para o gráfico do mês.</p>
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
