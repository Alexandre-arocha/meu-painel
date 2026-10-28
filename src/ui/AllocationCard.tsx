import { useState, type FormEvent } from 'react'
import type { Allocation } from '../domain/portfolio'

const ROWS: { key: keyof Allocation; label: string }[] = [
  { key: 'fixedIncome', label: 'Renda fixa' },
  { key: 'BBAS3', label: 'BBAS3' },
  { key: 'B3SA3', label: 'B3SA3' },
]
const pc = (n: number) => `${Math.round(n * 100)}%`

export function AllocationCard({
  allocation,
  target,
  onTarget,
}: {
  allocation: Allocation
  target?: Allocation
  onTarget: (t: Allocation) => void
}) {
  const [draft, setDraft] = useState<Record<keyof Allocation, string>>({
    fixedIncome: target ? String(Math.round(target.fixedIncome * 100)) : '',
    BBAS3: target ? String(Math.round(target.BBAS3 * 100)) : '',
    B3SA3: target ? String(Math.round(target.B3SA3 * 100)) : '',
  })
  const [error, setError] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const v = ROWS.map((r) => Number(draft[r.key].replace(',', '.')))
    const ok = v.every((n) => Number.isFinite(n) && n >= 0 && n <= 100)
    const sum = v.reduce((a, b) => a + b, 0)
    if (!ok || Math.abs(sum - 100) > 0.5) {
      setError('as metas devem somar 100%')
      return
    }
    setError('')
    onTarget({ fixedIncome: v[0] / 100, BBAS3: v[1] / 100, B3SA3: v[2] / 100 })
  }

  return (
    <section className="card" aria-label="Divisão da carteira">
      <h2>Para onde vai o próximo aporte?</h2>
      {ROWS.map(({ key, label }) => (
        <div className="alloc" key={key}>
          <div className="alloc-row">
            <span>{label}</span>
            <span className="num">
              {pc(allocation[key])}
              {target ? ` (meta ${pc(target[key])})` : ''}
            </span>
          </div>
          <div className="bar" aria-hidden="true">
            <i style={{ width: pc(allocation[key]) }} />
          </div>
        </div>
      ))}
      <p className="muted">Mostra a divisão atual e a que você quer. A decisão de comprar é sua.</p>
      <form onSubmit={submit} noValidate>
        {ROWS.map(({ key, label }) => (
          <div className="field" key={key}>
            <label htmlFor={`meta-${key}`}>Meta {label} (%)</label>
            <input
              id={`meta-${key}`}
              inputMode="decimal"
              value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            />
          </div>
        ))}
        {error && <p className="err">{error}</p>}
        <button type="submit">Salvar metas</button>
      </form>
    </section>
  )
}
