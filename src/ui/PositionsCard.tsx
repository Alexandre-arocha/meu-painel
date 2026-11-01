import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import type { Lookup } from '../data/markets'
import type { Quote } from '../data/prices'
import { newEventId as newId } from '../domain/agenda'
import {
  CLASSES,
  INDEXES,
  KINDS,
  SUBTYPES,
  classOf,
  isPriced,
  isPricedKind,
  labelOf,
  positionValue,
  priceKey,
  validateDraft,
  type Draft,
  type DraftErrors,
  type Kind,
  type ManualPosition,
  type Position,
  type PricedKind,
  type PricedPosition,
  type RateIndex,
} from '../domain/portfolio'
import { decimal, money, pct } from './format'

type Props = {
  positions: Position[]
  quotes: Quote[]
  lookup: (kind: PricedKind, symbol: string) => Promise<Lookup>
  onSave: (positions: Position[]) => void
}

const PLACEHOLDERS: Partial<Record<Kind, string>> = {
  acao: 'PETR4',
  fii: 'HGLG11',
  etf: 'BOVA11',
  bdr: 'AAPL34',
  exterior: 'AAPL',
  cripto: 'BTC',
  moeda: 'USD',
  'renda-fixa': 'CDB Banco X',
  fundo: 'Fundo Y',
  previdencia: 'Previdência Z',
}
const HINTS: Partial<Record<Kind, string>> = {
  exterior: 'Ações e ETFs dos EUA. O valor aparece em reais, pelo dólar do dia.',
  cripto: 'O código ou o nome, como BTC ou ethereum.',
  moeda: 'A quantidade na moeda, como 1.500 dólares.',
}
const UNITS: Partial<Record<Kind, [string, string]>> = {
  acao: ['ação', 'ações'],
  fii: ['cota', 'cotas'],
  etf: ['cota', 'cotas'],
  bdr: ['BDR', 'BDRs'],
  exterior: ['ação', 'ações'],
  cripto: ['unidade', 'unidades'],
}
const RATE_LABELS: Record<RateIndex, string> = {
  cdi: 'Taxa (% do CDI)',
  ipca: 'Taxa acima do IPCA (% ao ano)',
  selic: 'Taxa acima da Selic (% ao ano)',
  pre: 'Taxa (% ao ano)',
}

const BLANK: Omit<Draft, 'kind'> = { symbol: '', quantity: '', name: '', amount: '', subtype: '', index: '', rate: '', maturity: '' }
// CDB é o título mais comum; a lista segue na ordem Tesouro, bancários, crédito e poupança.
const firstSubtype = (kind: Kind) => (kind === 'renda-fixa' ? 'cdb' : (Object.keys(SUBTYPES[kind] ?? {})[0] ?? ''))
const fresh = (kind: Kind): Draft => ({ ...BLANK, kind, subtype: firstSubtype(kind) })
const toInput = (n: number) => String(n).replace('.', ',')

function toDraft(p: Position): Draft {
  if (isPriced(p)) return { ...fresh(p.kind), symbol: p.symbol, quantity: toInput(p.quantity) }
  return {
    ...fresh(p.kind),
    name: p.name,
    amount: toInput(p.amount),
    subtype: p.subtype ?? firstSubtype(p.kind),
    index: p.index ?? '',
    rate: p.rate === undefined ? '' : toInput(p.rate),
    maturity: p.maturity ?? '',
  }
}

function quantityText(p: PricedPosition): string {
  if (p.kind === 'moeda') return `${decimal(p.quantity)} ${p.symbol}`
  const [one, many] = UNITS[p.kind] ?? ['', '']
  return `${decimal(p.quantity)} ${p.quantity < 2 ? one : many}`
}

function rateText(p: ManualPosition): string {
  if (!p.index) return ''
  if (p.rate === undefined) return INDEXES[p.index]
  const r = decimal(p.rate)
  return { cdi: `${r}% do CDI`, ipca: `IPCA + ${r}%`, selic: `Selic + ${r}%`, pre: `${r}% ao ano` }[p.index]
}

// "Petrobras · 100 ações" ou "CDB · 110% do CDI · vence 12/2027".
function detail(p: Position): string {
  if (isPriced(p)) return [p.kind !== 'cripto' && p.name, quantityText(p)].filter(Boolean).join(' · ')
  const subtype = p.subtype ? SUBTYPES[p.kind]?.[p.subtype] : ''
  const maturity = p.maturity ? `vence ${p.maturity.slice(5, 7)}/${p.maturity.slice(0, 4)}` : ''
  return [subtype, rateText(p), maturity].filter(Boolean).join(' · ')
}

function Field({ id, label, error, ...input }: { id: string; label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined} {...input} />
      {error && (
        <p className="err" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  )
}

// Lista por classe e formulário que muda conforme o tipo. Ativo com cotação é conferido antes de salvar.
export function PositionsCard({ positions, quotes, lookup, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>(() => fresh('acao'))
  const [errors, setErrors] = useState<DraftErrors>({})
  const [pending, setPending] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const editing = positions.find((p) => p.id === editingId)
  const priced = isPricedKind(draft.kind)
  const subtypes = SUBTYPES[draft.kind]
  const prices = Object.fromEntries(quotes.map((q) => [q.symbol, q.price]))
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  // Ao editar, o foco vai para o número que costuma mudar: a quantidade ou o valor.
  useEffect(() => {
    if (editingId) document.getElementById(priced ? 'pos-qty' : 'pos-amount')?.focus()
  }, [editingId]) // eslint-disable-line react-hooks/exhaustive-deps

  function reset(kind: Kind = draft.kind) {
    setEditingId(null)
    setErrors({})
    setDraft(fresh(kind))
  }

  function edit(p: Position) {
    setConfirmId(null)
    setErrors({})
    setEditingId(p.id)
    setDraft(toDraft(p))
  }

  function remove(id: string) {
    setConfirmId(null)
    if (editingId === id) reset()
    onSave(positions.filter((p) => p.id !== id))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const v = validateDraft(draft)
    if (!v.ok) {
      setErrors(v.errors)
      return
    }
    setErrors({})
    let position = v.position
    if ('symbol' in position) {
      const same = editing && isPriced(editing) && editing.symbol === position.symbol
      if (same) {
        position = { ...position, ...(editing.name && { name: editing.name }) }
      } else {
        setPending(true)
        const found = await lookup(position.kind, position.symbol)
        setPending(false)
        if (!found.ok) {
          setErrors({ symbol: found.error })
          return
        }
        position = { ...position, symbol: found.symbol, ...(found.name && { name: found.name }) }
      }
      const key = priceKey(position)
      if (positions.some((p) => p.id !== editingId && isPriced(p) && priceKey(p) === key)) {
        setErrors({ symbol: 'esse ativo já está na carteira; edite a quantidade' })
        return
      }
    }
    const saved = { ...position, id: editingId ?? newId() } as Position
    onSave(editingId ? positions.map((p) => (p.id === editingId ? saved : p)) : [...positions, saved])
    reset()
  }

  const title = editing ? `Editar ${labelOf(editing)}` : 'Adicionar investimento'

  return (
    <section className="card wide" aria-label="Seus investimentos">
      <h2>Seus investimentos</h2>
      {positions.length === 0 && <p className="muted">Nenhum investimento ainda. Cadastre o primeiro abaixo.</p>}
      {CLASSES.map((c) => {
        const items = positions.filter((p) => classOf(p.kind) === c.id)
        if (items.length === 0) return null
        // Sem o preço de algum ativo, o total da classe fica em traço: zero enganaria.
        const values = items.map((p) => positionValue(p, prices))
        const sum = values.includes(null) ? null : values.reduce<number>((a, v) => a + (v ?? 0), 0)
        return (
          <div className="pos-group" key={c.id}>
            <div className="pos-group-head">
              <h3>{c.label}</h3>
              <span className="num muted">{sum === null ? '—' : money(sum)}</span>
            </div>
            <ul className="positions" aria-label={c.label}>
              {items.map((p) => {
                const label = labelOf(p)
                const value = positionValue(p, prices)
                const quote = isPriced(p) ? quotes.find((q) => q.symbol === priceKey(p)) : undefined
                const info = detail(p)
                return (
                  <li key={p.id}>
                    <div className="pos-main">
                      <span className="pos-name">{label}</span>
                      {info && <span className="muted">{info}</span>}
                    </div>
                    <div className="pos-value">
                      <span className="num">{value === null ? '—' : money(value)}</span>
                      {quote && <span className={`num ${quote.changePct >= 0 ? 'up' : 'dn'}`}>{pct(quote.changePct)}</span>}
                      {quote?.stale && <span className="pill warn">dado velho</span>}
                    </div>
                    {confirmId === p.id ? (
                      <div className="pos-actions" role="group" aria-label={`Remover ${label}?`}>
                        <span>Remover {label}?</span>
                        <button type="button" className="ghost danger" onClick={() => remove(p.id)}>
                          Remover
                        </button>
                        <button type="button" className="ghost" onClick={() => setConfirmId(null)}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="pos-actions">
                        <button type="button" className="ghost" aria-label={`Editar ${label}`} onClick={() => edit(p)}>
                          Editar
                        </button>
                        <button type="button" className="ghost" aria-label={`Remover ${label}`} onClick={() => setConfirmId(p.id)}>
                          Remover
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}

      <form className="pos-form" onSubmit={submit} noValidate aria-label={title}>
        <h3>{title}</h3>
        <div className="field">
          <label htmlFor="pos-kind">Tipo</label>
          <select id="pos-kind" value={draft.kind} disabled={!!editing} onChange={(e) => reset(e.target.value as Kind)}>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        {priced ? (
          <>
            <div className="two">
              <Field
                id="pos-symbol"
                label="Código"
                autoCapitalize="characters"
                autoComplete="off"
                placeholder={PLACEHOLDERS[draft.kind]}
                value={draft.symbol}
                error={errors.symbol}
                onChange={(e) => set({ symbol: e.target.value })}
              />
              <Field
                id="pos-qty"
                label="Quantidade"
                inputMode="decimal"
                value={draft.quantity}
                error={errors.quantity}
                onChange={(e) => set({ quantity: e.target.value })}
              />
            </div>
            {HINTS[draft.kind] && <p className="muted">{HINTS[draft.kind]}</p>}
          </>
        ) : (
          <>
            <div className="two">
              <Field
                id="pos-name"
                label="Nome"
                placeholder={PLACEHOLDERS[draft.kind]}
                value={draft.name}
                error={errors.name}
                onChange={(e) => set({ name: e.target.value })}
              />
              <Field
                id="pos-amount"
                label="Valor (R$)"
                inputMode="decimal"
                value={draft.amount}
                error={errors.amount}
                onChange={(e) => set({ amount: e.target.value })}
              />
            </div>
            {subtypes && (
              <div className="field">
                <label htmlFor="pos-subtype">{draft.kind === 'previdencia' ? 'Plano' : 'Tipo de título'}</label>
                <select id="pos-subtype" value={draft.subtype} onChange={(e) => set({ subtype: e.target.value })}>
                  {Object.entries(subtypes).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="two">
              <div className="field">
                <label htmlFor="pos-index">Índice</label>
                <select id="pos-index" value={draft.index} onChange={(e) => set({ index: e.target.value, rate: e.target.value ? draft.rate : '' })}>
                  <option value="">Sem índice</option>
                  {Object.entries(INDEXES).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {draft.index && (
                <Field
                  id="pos-rate"
                  label={RATE_LABELS[draft.index as RateIndex]}
                  inputMode="decimal"
                  value={draft.rate}
                  error={errors.rate}
                  onChange={(e) => set({ rate: e.target.value })}
                />
              )}
            </div>
            <Field id="pos-maturity" label="Vencimento" type="date" value={draft.maturity} error={errors.maturity} onChange={(e) => set({ maturity: e.target.value })} />
          </>
        )}
        <div className="form-actions">
          <button type="submit" disabled={pending}>
            {pending ? 'Conferindo…' : editing ? 'Salvar alterações' : 'Adicionar'}
          </button>
          {editing && (
            <button type="button" className="ghost" onClick={() => reset()}>
              Cancelar
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
