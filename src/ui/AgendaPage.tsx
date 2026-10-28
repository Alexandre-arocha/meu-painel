import { useState, type FormEvent } from 'react'
import { loadEvents, loadRoutine, saveEvents, saveRoutine } from '../data/storage'
import { isDate, isTime, monthGrid, planDay, type AgendaEvent, type EventKind, type Routine } from '../domain/agenda'
import { localDate } from './format'

const KINDS: { id: EventKind; label: string }[] = [
  { id: 'pessoal', label: 'Pessoal' },
  { id: 'estudo', label: 'Estudo' },
  { id: 'prova', label: 'Prova / concurso' },
  { id: 'mercado', label: 'Mercado' },
]
const WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const brDate = (d: string) => d.split('-').reverse().join('/')

export function AgendaPage({ now = () => new Date(), store = localStorage }: { now?: () => Date; store?: Storage }) {
  const today = localDate(now())
  const [events, setEvents] = useState<AgendaEvent[]>(() => loadEvents(store))
  const [routine, setRoutine] = useState<Routine>(() => loadRoutine(store))
  const [form, setForm] = useState({ title: '', date: today, time: '', kind: 'pessoal' as EventKind })
  const [formError, setFormError] = useState('')
  const [draft, setDraft] = useState({ ...routine, studyMinutes: String(routine.studyMinutes) })
  const [routineMsg, setRoutineMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [year, month] = today.split('-').map(Number)
  const plan = planDay(today, routine, events)
  const upcoming = events
    .filter((e) => e.date >= today)
    .sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`))

  function save(list: AgendaEvent[]) {
    setEvents(list)
    saveEvents(list, store)
  }

  function add(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return setFormError('informe o título')
    if (!isDate(form.date)) return setFormError('data inválida')
    if (form.time && !isTime(form.time)) return setFormError('horário inválido')
    setFormError('')
    save([
      ...events,
      { id: crypto.randomUUID(), title: form.title.trim(), date: form.date, ...(form.time ? { time: form.time } : {}), kind: form.kind },
    ])
    setForm({ ...form, title: '', time: '' })
  }

  function saveRoutineForm(e: FormEvent) {
    e.preventDefault()
    if (!isTime(draft.workStart) || !isTime(draft.workEnd)) {
      return setRoutineMsg({ ok: false, text: 'horário de trabalho inválido' })
    }
    if (!/^\d+$/.test(draft.studyMinutes) || Number(draft.studyMinutes) > 600) {
      return setRoutineMsg({ ok: false, text: 'minutos de estudo entre 0 e 600' })
    }
    const next: Routine = { workStart: draft.workStart, workEnd: draft.workEnd, workDays: draft.workDays, studyMinutes: Number(draft.studyMinutes) }
    setRoutine(next)
    saveRoutine(next, store)
    setRoutineMsg({ ok: true, text: 'Rotina salva.' })
  }

  return (
    <div className="page">
      <div className="grid">
        <section className="card" aria-label="Hoje">
          <h2>Hoje, montado a partir da sua rotina</h2>
          {plan.length === 0 ? (
            <p className="muted">Nada planejado.</p>
          ) : (
            <ul className="tl">
              {plan.map((b, i) => (
                <li key={i} className={b.kind}>
                  <span className="num">{b.start ? `${b.start}–${b.end}` : 'Dia todo'}</span> {b.title}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-label="Calendário">
          <h2>
            {MONTHS[month - 1]} de {year}
          </h2>
          <div className="cal">
            {WEEK.map((w) => (
              <span key={w} className="h" aria-hidden="true">
                {w[0]}
              </span>
            ))}
            {monthGrid(year, month - 1)
              .flat()
              .map((d, i) => {
                if (!d) return <span key={i} />
                const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                const n = events.filter((e) => e.date === date).length
                return (
                  <span key={i} className={`d${n ? ' has' : ''}${date === today ? ' today' : ''}`} title={n ? `${n} compromisso(s)` : undefined}>
                    {d}
                  </span>
                )
              })}
          </div>
          <p className="muted">Dias com traço azul têm compromisso.</p>
        </section>

        <section className="card" aria-label="Novo compromisso">
          <h2>Novo compromisso</h2>
          <form onSubmit={add} noValidate>
            <div className="field">
              <label htmlFor="ev-title">Título</label>
              <input id="ev-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="two">
              <div className="field">
                <label htmlFor="ev-date">Data</label>
                <input id="ev-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="ev-time">Horário (opcional)</label>
                <input id="ev-time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="ev-kind">Tipo</label>
              <select id="ev-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as EventKind })}>
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            {formError && <p className="err">{formError}</p>}
            <button type="submit">Adicionar</button>
          </form>
        </section>

        <section className="card" aria-label="Próximos compromissos">
          <h2>Próximos compromissos</h2>
          {upcoming.length === 0 ? (
            <p className="muted">Nada marcado.</p>
          ) : (
            <ul className="list">
              {upcoming.map((e) => (
                <li key={e.id} className="item">
                  <span>
                    <span className="num">
                      {brDate(e.date)}
                      {e.time ? ` ${e.time}` : ''}
                    </span>{' '}
                    {e.title}
                  </span>
                  <button type="button" className="ghost" aria-label={`Remover ${e.title}`} onClick={() => save(events.filter((x) => x.id !== e.id))}>
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card wide" aria-label="Sua rotina">
          <h2>Sua rotina</h2>
          <form onSubmit={saveRoutineForm} noValidate>
            <div className="two">
              <div className="field">
                <label htmlFor="r-start">Início do trabalho</label>
                <input id="r-start" type="time" value={draft.workStart} onChange={(e) => setDraft({ ...draft, workStart: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="r-end">Fim do trabalho</label>
                <input id="r-end" type="time" value={draft.workEnd} onChange={(e) => setDraft({ ...draft, workEnd: e.target.value })} />
              </div>
            </div>
            <fieldset className="days">
              <legend>Dias de trabalho</legend>
              {WEEK.map((w, i) => (
                <label key={w}>
                  <input
                    type="checkbox"
                    checked={draft.workDays.includes(i)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        workDays: e.target.checked ? [...draft.workDays, i].sort() : draft.workDays.filter((d) => d !== i),
                      })
                    }
                  />
                  {w}
                </label>
              ))}
            </fieldset>
            <div className="field">
              <label htmlFor="r-min">Minutos de estudo por dia</label>
              <input id="r-min" inputMode="numeric" value={draft.studyMinutes} onChange={(e) => setDraft({ ...draft, studyMinutes: e.target.value })} />
            </div>
            {routineMsg && <p className={routineMsg.ok ? 'up' : 'err'}>{routineMsg.text}</p>}
            <button type="submit">Salvar rotina</button>
          </form>
        </section>
      </div>
    </div>
  )
}
