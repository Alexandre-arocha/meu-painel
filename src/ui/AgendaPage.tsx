import { useState, type FormEvent } from 'react'
import { loadEvents, loadRoutine, saveEvents, saveRoutine } from '../data/storage'
import {
  countdownLabel,
  importantDates,
  isDate,
  isTime,
  monthGrid,
  occursOn,
  planDay,
  shiftMonth,
  type AgendaEvent,
  type EventKind,
  type Routine,
} from '../domain/agenda'
import { localDate } from './format'

const KINDS: { id: EventKind; label: string }[] = [
  { id: 'pessoal', label: 'Pessoal' },
  { id: 'estudo', label: 'Estudo' },
  { id: 'prova', label: 'Prova / concurso' },
  { id: 'mercado', label: 'Mercado' },
]
const LEGEND = [
  { kind: 'estudo', label: 'Estudo' },
  { kind: 'mercado', label: 'Mercado' },
  { kind: 'trabalho', label: 'Trabalho' },
  { kind: 'pessoal', label: 'Pessoal e provas' },
]
const WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const brDate = (d: string) => d.split('-').reverse().join('/')
const isoDay = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
const monthOf = (date: string) => ({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) - 1 })
const toggle = (days: number[], day: number, on: boolean) => (on ? [...days, day].sort((a, b) => a - b) : days.filter((d) => d !== day))

type Form = { title: string; date: string; time: string; duration: string; kind: EventKind; repeat: number[] }

export function AgendaPage({ now = () => new Date(), store = localStorage }: { now?: () => Date; store?: Storage }) {
  const today = localDate(now())
  const [events, setEvents] = useState<AgendaEvent[]>(() => loadEvents(store))
  const [routine, setRoutine] = useState<Routine>(() => loadRoutine(store))
  const [selected, setSelected] = useState(today)
  const [view, setView] = useState(() => monthOf(today))
  const [form, setForm] = useState<Form>({ title: '', date: today, time: '', duration: '60', kind: 'pessoal', repeat: [] })
  const [formError, setFormError] = useState('')
  const [draft, setDraft] = useState({ ...routine, studyMinutes: String(routine.studyMinutes) })
  const [routineMsg, setRoutineMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const plan = planDay(selected, routine, events)
  const important = importantDates(events, today)
  const weekly = events.filter((e) => e.weekdays?.length)
  const upcoming = events
    .filter((e) => !e.weekdays?.length && e.date >= today)
    .sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`))

  function save(list: AgendaEvent[]) {
    setEvents(list)
    saveEvents(list, store)
  }

  function selectDay(date: string) {
    setSelected(date)
    setForm((f) => ({ ...f, date }))
  }

  function backToToday() {
    selectDay(today)
    setView(monthOf(today))
  }

  function add(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return setFormError('informe o título')
    if (!isDate(form.date)) return setFormError('data inválida')
    if (form.time && !isTime(form.time)) return setFormError('horário inválido')
    const duration = Number(form.duration)
    if (!/^\d+$/.test(form.duration) || duration < 5 || duration > 720) return setFormError('duração entre 5 e 720 minutos')
    setFormError('')
    save([
      ...events,
      {
        id: crypto.randomUUID(),
        title: form.title.trim(),
        date: form.date,
        kind: form.kind,
        ...(form.time ? { time: form.time } : {}),
        ...(duration !== 60 ? { durationMin: duration } : {}),
        ...(form.repeat.length ? { weekdays: form.repeat } : {}),
      },
    ])
    setForm({ ...form, title: '', time: '', duration: '60', repeat: [] })
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

  const eventRow = (e: AgendaEvent) => (
    <li key={e.id} className="item">
      <span>
        <span className="num">
          {e.weekdays?.length ? e.weekdays.map((d) => WEEK[d]).join(', ') : brDate(e.date)}
          {e.time ? ` ${e.time}` : ''}
        </span>{' '}
        {e.title}
      </span>
      <button type="button" className="ghost" aria-label={`Remover ${e.title}`} onClick={() => save(events.filter((x) => x.id !== e.id))}>
        Remover
      </button>
    </li>
  )

  return (
    <div className="page">
      <div className="grid">
        <section className="card" aria-label="Plano do dia">
          <h2>{selected === today ? 'Hoje, montado a partir da sua rotina' : `Plano de ${brDate(selected)}`}</h2>
          {plan.length === 0 ? (
            <p className="muted">Nada planejado para este dia.</p>
          ) : (
            <ul className="tl">
              {plan.map((b, i) => (
                <li key={i} className={b.kind}>
                  <span className="num">{b.start ? `${b.start}–${b.end}` : 'Dia todo'}</span> {b.title}
                </li>
              ))}
            </ul>
          )}
          <ul className="legend" aria-label="Legenda das cores">
            {LEGEND.map((l) => (
              <li key={l.kind} className={l.kind}>
                {l.label}
              </li>
            ))}
          </ul>
          {selected !== today && (
            <button type="button" className="ghost" onClick={backToToday}>
              Voltar para hoje
            </button>
          )}
        </section>

        <section className="card" aria-label="Calendário">
          <div className="cal-head">
            <button type="button" className="ghost icon" aria-label="Mês anterior" onClick={() => setView(shiftMonth(view.year, view.month, -1))}>
              ‹
            </button>
            <h2>
              {MONTHS[view.month]} de {view.year}
            </h2>
            <button type="button" className="ghost icon" aria-label="Próximo mês" onClick={() => setView(shiftMonth(view.year, view.month, 1))}>
              ›
            </button>
          </div>
          <div className="cal">
            {WEEK.map((w) => (
              <span key={w} className="h" aria-hidden="true">
                {w[0]}
              </span>
            ))}
            {monthGrid(view.year, view.month)
              .flat()
              .map((d, i) => {
                if (!d) return <span key={i} />
                const date = isoDay(view.year, view.month, d)
                const n = events.filter((e) => occursOn(e, date)).length
                return (
                  <button
                    key={i}
                    type="button"
                    className={`${n ? 'has' : ''}${date === today ? ' today' : ''}`}
                    aria-pressed={date === selected}
                    aria-label={`${d} de ${MONTHS[view.month]}${n ? `, ${n} compromisso${n > 1 ? 's' : ''}` : ''}`}
                    onClick={() => selectDay(date)}
                  >
                    {d}
                  </button>
                )
              })}
          </div>
          <p className="muted">Dias com traço azul têm compromisso. Toque num dia para ver o plano dele.</p>
        </section>

        <section className="card" aria-label="Datas importantes">
          <h2>Datas importantes</h2>
          {important.length === 0 ? (
            <p className="muted">Cadastre provas e eventos de mercado com o tipo "Prova / concurso" ou "Mercado" para ver a contagem aqui.</p>
          ) : (
            <ul className="list">
              {important.map(({ event, days }) => (
                <li key={event.id} className="item">
                  <span>
                    <span className="num">{brDate(event.date)}</span> {event.title}
                  </span>
                  <span className="pill warn">{countdownLabel(days)}</span>
                </li>
              ))}
            </ul>
          )}
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
              <div className="field">
                <label htmlFor="ev-duration">Duração (min)</label>
                <input id="ev-duration" inputMode="numeric" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
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
            </div>
            <fieldset className="days">
              <legend>Repetir toda semana</legend>
              {WEEK.map((w, i) => (
                <label key={w}>
                  <input
                    type="checkbox"
                    checked={form.repeat.includes(i)}
                    onChange={(e) => setForm({ ...form, repeat: toggle(form.repeat, i, e.target.checked) })}
                  />
                  {w}
                </label>
              ))}
            </fieldset>
            {formError && <p className="err">{formError}</p>}
            <button type="submit">Adicionar</button>
          </form>
        </section>

        <section className="card" aria-label="Próximos compromissos">
          <h2>Próximos compromissos</h2>
          {upcoming.length === 0 ? <p className="muted">Nada marcado.</p> : <ul className="list">{upcoming.map(eventRow)}</ul>}
          {weekly.length > 0 && (
            <>
              <h3 className="sub">Toda semana</h3>
              <ul className="list">{weekly.map(eventRow)}</ul>
            </>
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
                    onChange={(e) => setDraft({ ...draft, workDays: toggle(draft.workDays, i, e.target.checked) })}
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
