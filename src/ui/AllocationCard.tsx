import { useState, type FormEvent } from 'react'
import { CLASSES, type AssetClass, type ClassTargets, type Totals } from '../domain/portfolio'
import { decimal } from './format'

const pc = (n: number) => `${Math.round(n * 100)}%`

// Divisão atual por classe e a meta de cada uma. A meta guia o simulador de aportes; a decisão de comprar é sua.
export function AllocationCard({ totals, target, onTarget }: { totals: Totals; target?: ClassTargets; onTarget: (t: ClassTargets) => void }) {
  const [draft, setDraft] = useState<Record<AssetClass, string>>(
    () => Object.fromEntries(CLASSES.map((c) => [c.id, target ? String(Math.round(target[c.id] * 100)) : ''])) as Record<AssetClass, string>,
  )
  const [error, setError] = useState('')
  const share = (c: AssetClass) => (totals.total > 0 ? totals.byClass[c] / totals.total : 0)
  const shown = CLASSES.filter((c) => totals.byClass[c.id] > 0 || (target?.[c.id] ?? 0) > 0)

  function submit(e: FormEvent) {
    e.preventDefault()
    const values = CLASSES.map((c) => (draft[c.id].trim() === '' ? 0 : Number(draft[c.id].replace(',', '.'))))
    const sum = values.reduce((a, b) => a + b, 0)
    if (!values.every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) {
      setError('use números de 0 a 100')
      return
    }
    if (Math.abs(sum - 100) > 0.5) {
      setError(`as metas devem somar 100% (agora somam ${decimal(sum)}%)`)
      return
    }
    setError('')
    onTarget(Object.fromEntries(CLASSES.map((c, i) => [c.id, values[i] / 100])) as ClassTargets)
  }

  return (
    <section className="card" aria-label="Divisão da carteira">
      <h2>Divisão por classe</h2>
      {shown.length === 0 ? (
        <p className="muted">A divisão aparece quando houver investimentos.</p>
      ) : (
        shown.map((c) => (
          <div className="alloc" key={c.id}>
            <div className="alloc-row">
              <span>{c.label}</span>
              <span className="num">
                {pc(share(c.id))}
                {target ? ` (meta ${pc(target[c.id])})` : ''}
              </span>
            </div>
            <div className="bar" aria-hidden="true">
              <i style={{ width: pc(share(c.id)) }} />
            </div>
          </div>
        ))
      )}
      {totals.missing.length > 0 && <p className="muted">Ativos sem preço ainda ficam fora da conta.</p>}
      <details className="more-info">
        <summary>Metas por classe</summary>
        <form onSubmit={submit} noValidate>
          <div className="two">
            {CLASSES.map((c) => (
              <div className="field" key={c.id}>
                <label htmlFor={`meta-${c.id}`}>Meta {c.label} (%)</label>
                <input
                  id={`meta-${c.id}`}
                  inputMode="decimal"
                  value={draft[c.id]}
                  onChange={(e) => setDraft({ ...draft, [c.id]: e.target.value })}
                />
              </div>
            ))}
          </div>
          {error && (
            <p className="err" role="alert">
              {error}
            </p>
          )}
          <button type="submit">Salvar metas</button>
        </form>
      </details>
    </section>
  )
}
