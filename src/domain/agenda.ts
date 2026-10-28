export type EventKind = 'estudo' | 'mercado' | 'prova' | 'pessoal'
export type AgendaEvent = { id: string; title: string; date: string; time?: string; kind: EventKind }
export type Routine = { workStart: string; workEnd: string; workDays: number[]; studyMinutes: number }
export type Block = { start: string; end: string; title: string; kind: EventKind | 'trabalho' }

export const EVENT_KINDS: EventKind[] = ['estudo', 'mercado', 'prova', 'pessoal']
export const DEFAULT_ROUTINE: Routine = { workStart: '08:00', workEnd: '17:00', workDays: [1, 2, 3, 4, 5], studyMinutes: 60 }

const EVENT_MINUTES = 60
const DAY_OFF_STUDY = 9 * 60

export const isTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

export function isDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  const t = new Date(`${d}T00:00:00Z`)
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const toTime = (m: number) => {
  const c = Math.min(Math.max(m, 0), 24 * 60 - 1)
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`
}
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay()

// Plano do dia: compromissos com horário (1 h cada), notícias antes do trabalho, trabalho e um bloco de estudo
// 1 h depois do trabalho (9h em dia de folga), empurrado para depois de qualquer compromisso que ocupe o horário.
export function planDay(date: string, routine: Routine, events: AgendaEvent[]): Block[] {
  const today = events.filter((e) => e.date === date)
  const blocks: Block[] = today
    .filter((e) => e.time)
    .map((e) => ({ start: e.time!, end: toTime(toMin(e.time!) + EVENT_MINUTES), title: e.title, kind: e.kind }))
  const workday = routine.workDays.includes(weekday(date))
  if (workday) {
    blocks.push({ start: toTime(toMin(routine.workStart) - 15), end: routine.workStart, title: 'Notícias do mercado', kind: 'mercado' })
    blocks.push({ start: routine.workStart, end: routine.workEnd, title: 'Trabalho', kind: 'trabalho' })
  }
  if (routine.studyMinutes > 0) {
    let start = workday ? toMin(routine.workEnd) + 60 : DAY_OFF_STUDY
    const busy = blocks.map((b) => [toMin(b.start), toMin(b.end)] as const)
    let moved = true
    while (moved) {
      moved = false
      for (const [s, e] of busy) {
        if (start < e && start + routine.studyMinutes > s) {
          start = e
          moved = true
        }
      }
    }
    if (start + routine.studyMinutes <= 24 * 60) {
      blocks.push({ start: toTime(start), end: toTime(start + routine.studyMinutes), title: 'Estudo: questões', kind: 'estudo' })
    }
  }
  const allDay: Block[] = today.filter((e) => !e.time).map((e) => ({ start: '', end: '', title: e.title, kind: e.kind }))
  return [...allDay, ...blocks.sort((a, b) => toMin(a.start) - toMin(b.start))]
}

// Semanas do mês começando no domingo; null nas casas vazias. month: 0 = janeiro.
export function monthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
