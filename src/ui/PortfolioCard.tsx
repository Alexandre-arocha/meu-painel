import { useState, type FormEvent } from 'react'
import { parseAmount, parseQuantity, type Holding, type Portfolio, type Ticker } from '../domain/portfolio'

const TICKERS: Ticker[] = ['BBAS3', 'B3SA3']
type Errors = Partial<Record<Ticker | 'fixedIncome', string>>

const qtyOf = (p: Portfolio, s: Ticker) => p.holdings.find((h) => h.symbol === s)?.quantity ?? 0
const show = (n: number) => (n > 0 ? String(n).replace('.', ',') : '')

export function PortfolioCard({ portfolio, onSave }: { portfolio: Portfolio; onSave: (p: Portfolio) => void }) {
  const [qty, setQty] = useState<Record<Ticker, string>>({
    BBAS3: show(qtyOf(portfolio, 'BBAS3')),
    B3SA3: show(qtyOf(portfolio, 'B3SA3')),
  })
  const [fixed, setFixed] = useState(show(portfolio.fixedIncome.amount))
  const [errors, setErrors] = useState<Errors>({})
  const empty = portfolio.holdings.length === 0 && portfolio.fixedIncome.amount === 0

  function submit(e: FormEvent) {
    e.preventDefault()
    const next: Errors = {}
    const holdings: Holding[] = []
    for (const s of TICKERS) {
      const r = parseQuantity(qty[s].trim() === '' ? '0' : qty[s])
      if (!r.ok) next[s] = r.error
      else if (r.value > 0) holdings.push({ symbol: s, quantity: r.value })
    }
    const f = parseAmount(fixed.trim() === '' ? '0' : fixed)
    if (!f.ok) next.fixedIncome = f.error
    setErrors(next)
    if (Object.keys(next).length === 0 && f.ok) {
      onSave({ holdings, fixedIncome: { ...portfolio.fixedIncome, amount: f.value } })
    }
  }

  return (
    <section className="card" aria-label="Carteira">
      <h2>Carteira</h2>
      {empty && <p className="muted">Informe suas quantidades para ver a divisão da carteira.</p>}
      <form onSubmit={submit} noValidate>
        {TICKERS.map((s) => (
          <div className="field" key={s}>
            <label htmlFor={`qty-${s}`}>Quantidade de {s}</label>
            <input
              id={`qty-${s}`}
              inputMode="numeric"
              value={qty[s]}
              aria-invalid={!!errors[s]}
              aria-describedby={errors[s] ? `err-${s}` : undefined}
              onChange={(e) => setQty({ ...qty, [s]: e.target.value })}
            />
            {errors[s] && <p className="err" id={`err-${s}`}>{errors[s]}</p>}
          </div>
        ))}
        <div className="field">
          <label htmlFor="fixed">Renda fixa (R$)</label>
          <input
            id="fixed"
            inputMode="decimal"
            value={fixed}
            aria-invalid={!!errors.fixedIncome}
            aria-describedby={errors.fixedIncome ? 'err-fixed' : undefined}
            onChange={(e) => setFixed(e.target.value)}
          />
          {errors.fixedIncome && <p className="err" id="err-fixed">{errors.fixedIncome}</p>}
        </div>
        <button type="submit">Salvar carteira</button>
      </form>
    </section>
  )
}
