import { DEFAULT_ROUTINE, isDate, isTime, monthGrid, planDay, type AgendaEvent } from './agenda'

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
