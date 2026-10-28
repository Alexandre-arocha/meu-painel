export type EventKind = 'estudo' | 'mercado' | 'prova' | 'pessoal'
export type AgendaEvent = {
  id: string
  title: string
  date: string // num evento semanal, a data a partir da qual ele vale
  time?: string
  durationMin?: number
  weekdays?: number[] // repete toda semana nesses dias (0 = domingo)
  kind: EventKind
}
export type Routine = { workStart: string; workEnd: string; workDays: number[]; studyMinutes: number }
export type Block = { start: string; end: string; title: string; kind: EventKind | 'trabalho' }

export const EVENT_KINDS: EventKind[] = ['estudo', 'mercado', 'prova', 'pessoal']
export const DEFAULT_ROUTINE: Routine = { workStart: '08:00', workEnd: '17:00', workDays: [1, 2, 3, 4, 5], studyMinutes: 60 }

const EVENT_MINUTES = 60
const DAY_OFF_STUDY = 9 * 60

export const isTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

// crypto.randomUUID só existe em página segura (https ou localhost); aberto por http no celular, usa o plano B.
export const newEventId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

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
export const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay()

export function occursOn(e: AgendaEvent, date: string): boolean {
  if (e.weekdays && e.weekdays.length > 0) return date >= e.date && e.weekdays.includes(weekday(date))
  return e.date === date
}

// Plano do dia: compromissos com horário (duração própria, 1 h se não informada), notícias antes do trabalho, trabalho e um bloco de estudo
// 1 h depois do trabalho (9h em dia de folga), empurrado para depois de qualquer compromisso que ocupe o horário.
export function planDay(date: string, routine: Routine, events: AgendaEvent[]): Block[] {
  const today = events.filter((e) => occursOn(e, date))
  const blocks: Block[] = today
    .filter((e) => e.time)
    .map((e) => ({
      start: e.time!,
      end: toTime(toMin(e.time!) + (e.durationMin ?? EVENT_MINUTES)),
      title: e.title,
      kind: e.kind,
    }))
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

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month + delta, 1))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
}

// Dias de calendário entre duas datas AAAA-MM-DD (meia-noite UTC dos dois lados, sem efeito de fuso).
export const daysUntil = (date: string, today: string) =>
  Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)

export function countdownLabel(days: number): string {
  if (days === 0) return 'hoje'
  if (days === 1) return 'amanhã'
  return `faltam ${days} dias`
}

export type ImportantDate = { event: AgendaEvent; days: number }

// Provas e eventos de mercado de hoje em diante (não semanais), em ordem de data.
export function importantDates(events: AgendaEvent[], today: string, limit = 5): ImportantDate[] {
  return events
    .filter((e) => (e.kind === 'prova' || e.kind === 'mercado') && !e.weekdays?.length && e.date >= today)
    .sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`))
    .slice(0, limit)
    .map((event) => ({ event, days: daysUntil(event.date, today) }))
}
