import { loadEvents, loadRoutine, saveEvents, saveRoutine } from './storage'
import { DEFAULT_ROUTINE } from '../domain/agenda'

beforeEach(() => localStorage.clear())

test('compromissos: salvar, carregar e descartar inválidos', () => {
  const ok = { id: '1', title: 'Prova', date: '2026-11-08', kind: 'prova' as const }
  saveEvents([ok])
  expect(loadEvents()).toEqual([ok])
  localStorage.setItem('painel:v1:events', JSON.stringify([ok, { id: '2', title: '', date: 'ontem', kind: 'x' }]))
  expect(loadEvents()).toEqual([ok])
})

test('rotina: salvar, carregar e voltar ao padrão se inválida', () => {
  const r = { workStart: '09:00', workEnd: '18:00', workDays: [1, 2, 3], studyMinutes: 90 }
  saveRoutine(r)
  expect(loadRoutine()).toEqual(r)
  localStorage.setItem('painel:v1:routine', JSON.stringify({ workStart: '25:00' }))
  expect(loadRoutine()).toEqual(DEFAULT_ROUTINE)
})
