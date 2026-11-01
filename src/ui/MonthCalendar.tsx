import { useState } from 'react'
import { monthGrid, occursOn, shiftMonth, type AgendaEvent } from '../domain/agenda'
import { WEEK } from './format'

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const isoDay = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
const monthOf = (date: string) => ({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) - 1 })

type Props = { events: AgendaEvent[]; today: string; selected: string; onSelect: (date: string) => void }

// O mês com os dias de compromisso marcados. Tocar num dia escolhe o dia; quem usa mostra o que há nele (Agenda e Início).
export function MonthCalendar({ events, today, selected, onSelect }: Props) {
  const [view, setView] = useState(() => monthOf(selected))
  // Se o dia escolhido muda por fora (Voltar para hoje), o calendário vai para o mês dele.
  const [shown, setShown] = useState(selected)
  if (shown !== selected) {
    setShown(selected)
    setView(monthOf(selected))
  }

  return (
    <>
      <div className="cal-head">
        <button type="button" className="ghost icon" aria-label="Mês anterior" onClick={() => setView(shiftMonth(view.year, view.month, -1))}>
          ‹
        </button>
        <h3>
          {MONTHS[view.month]} de {view.year}
        </h3>
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
                onClick={() => onSelect(date)}
              >
                {d}
              </button>
            )
          })}
      </div>
    </>
  )
}
