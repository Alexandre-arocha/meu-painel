import {
  DEFAULT_ROUTINE,
  countdownLabel,
  daysUntil,
  importantDates,
  isDate,
  isTime,
  monthGrid,
  newEventId,
  occursOn,
  planDay,
  shiftMonth,
  type AgendaEvent,
} from './agenda'

test('monthGrid de outubro de 2026 começa na quinta e tem 5 semanas', () => {
  const g = monthGrid(2026, 9)
  expect(g).toHaveLength(5)
  expect(g[0]).toEqual([null, null, null, null, 1, 2, 3])
  expect(g[4]).toEqual([25, 26, 27, 28, 29, 30, 31])
})

const ev = (over: Partial<AgendaEvent>): AgendaEvent => ({ id: 'e', title: 'Evento', date: '2026-10-28', kind: 'pessoal', ...over })
const fmt = (blocks: { start: string; end: string; title: string }[]) => blocks.map((b) => `${b.start}-${b.end} ${b.title}`)

test('planDay em dia útil: notícias antes do trabalho, trabalho e estudo 1 h depois', () => {
  expect(fmt(planDay('2026-10-28', DEFAULT_ROUTINE, []))).toEqual([
    '07:45-08:00 Notícias do mercado',
    '08:00-17:00 Trabalho',
    '18:00-19:00 Estudo: questões',
  ])
})

test('planDay empurra o estudo para depois de um compromisso no mesmo horário', () => {
  const plan = fmt(planDay('2026-10-28', DEFAULT_ROUTINE, [ev({ title: 'Dentista', time: '18:00' })]))
  expect(plan).toContain('18:00-19:00 Dentista')
  expect(plan).toContain('19:00-20:00 Estudo: questões')
})

test('planDay no sábado não tem trabalho e estuda às 9h', () => {
  expect(fmt(planDay('2026-10-31', DEFAULT_ROUTINE, []))).toEqual(['09:00-10:00 Estudo: questões'])
})

test('planDay põe compromisso sem horário no topo e ignora outros dias', () => {
  const plan = planDay('2026-10-31', DEFAULT_ROUTINE, [
    ev({ date: '2026-10-31', title: 'Prova', kind: 'prova' }),
    ev({ date: '2026-11-01', title: 'Outro', time: '09:00' }),
  ])
  expect(plan[0]).toMatchObject({ title: 'Prova', start: '' })
  expect(plan.map((b) => b.title)).not.toContain('Outro')
})

test('isDate e isTime rejeitam valores impossíveis', () => {
  expect(isDate('2026-10-28')).toBe(true)
  expect(isDate('2026-02-30')).toBe(false)
  expect(isDate('ontem')).toBe(false)
  expect(isTime('23:59')).toBe(true)
  expect(isTime('24:00')).toBe(false)
})

test('evento semanal aparece só nos dias marcados e a partir do início', () => {
  const academia = ev({ title: 'Academia', date: '2026-10-26', weekdays: [1, 3] })
  expect(occursOn(academia, '2026-10-28')).toBe(true)
  expect(occursOn(academia, '2026-10-27')).toBe(false)
  expect(occursOn(academia, '2026-10-21')).toBe(false)
})

test('planDay usa a duração do compromisso', () => {
  const plan = fmt(planDay('2026-10-28', DEFAULT_ROUTINE, [ev({ title: 'Dentista', time: '18:00', durationMin: 90 })]))
  expect(plan).toContain('18:00-19:30 Dentista')
  expect(plan).toContain('19:30-20:30 Estudo: questões')
})

test('planDay inclui evento semanal', () => {
  const academia = ev({ title: 'Academia', date: '2026-10-01', time: '18:00', weekdays: [3] })
  expect(fmt(planDay('2026-10-28', DEFAULT_ROUTINE, [academia]))).toContain('18:00-19:00 Academia')
})

test('daysUntil e countdownLabel', () => {
  expect(daysUntil('2026-11-08', '2026-10-28')).toBe(11)
  expect(countdownLabel(0)).toBe('hoje')
  expect(countdownLabel(1)).toBe('amanhã')
  expect(countdownLabel(11)).toBe('faltam 11 dias')
})

test('importantDates lista só provas e mercado futuras, em ordem', () => {
  const r = importantDates(
    [
      ev({ id: 'p', title: 'Prova PM', date: '2026-11-08', kind: 'prova' }),
      ev({ id: 'x', title: 'Aniversário', date: '2026-10-30', kind: 'pessoal' }),
      ev({ id: 'm', title: 'Copom', date: '2026-11-04', kind: 'mercado' }),
      ev({ id: 'old', title: 'Prova antiga', date: '2026-10-01', kind: 'prova' }),
      ev({ id: 'w', title: 'Simulado semanal', date: '2026-10-01', kind: 'prova', weekdays: [6] }),
    ],
    '2026-10-28',
  )
  expect(r.map((d) => [d.event.title, d.days])).toEqual([
    ['Copom', 7],
    ['Prova PM', 11],
  ])
})

test('shiftMonth atravessa a virada do ano', () => {
  expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 })
  expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 })
})

test('newEventId funciona sem crypto.randomUUID (página aberta por http no celular)', () => {
  const desc = Object.getOwnPropertyDescriptor(crypto, 'randomUUID')
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
  try {
    const a = newEventId()
    const b = newEventId()
    expect(a).toMatch(/\S+/)
    expect(a).not.toBe(b)
  } finally {
    if (desc) Object.defineProperty(crypto, 'randomUUID', desc)
    else delete (crypto as { randomUUID?: unknown }).randomUUID
  }
})

test('monthGrid de agosto de 2026 tem 6 semanas', () => {
  const g = monthGrid(2026, 7)
  expect(g).toHaveLength(6)
  expect(g[0]).toEqual([null, null, null, null, null, null, 1])
  expect(g[5]).toEqual([30, 31, null, null, null, null, null])
})
