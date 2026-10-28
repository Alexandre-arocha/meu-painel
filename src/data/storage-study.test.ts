import { loadAttempts, loadCustomQuestions, saveAttempts, saveCustomQuestions, savePortfolio } from './storage'

beforeEach(() => localStorage.clear())

test('tentativas: salvar e carregar', () => {
  const a = [{ questionId: 'q1', correct: true, at: '2026-10-28T10:00:00Z' }]
  saveAttempts(a)
  expect(loadAttempts()).toEqual(a)
})

test('tentativas inválidas são descartadas ao carregar', () => {
  localStorage.setItem(
    'painel:v1:attempts',
    JSON.stringify([
      { questionId: 'q1', correct: 'sim', at: 1 },
      { questionId: 'q2', correct: false, at: '2026-10-28T10:00:00Z' },
    ]),
  )
  expect(loadAttempts()).toEqual([{ questionId: 'q2', correct: false, at: '2026-10-28T10:00:00Z' }])
})

test('questões importadas: salvar, carregar e ignorar conteúdo corrompido', () => {
  const qs = [{ id: 'x', area: 'geral' as const, subject: 'S', statement: 'E', options: ['a', 'b'], answer: 0, explanation: '' }]
  saveCustomQuestions(qs)
  expect(loadCustomQuestions()).toEqual(qs)
  localStorage.setItem('painel:v1:questions', '{{')
  expect(loadCustomQuestions()).toEqual([])
})

test('salvar não quebra quando o navegador recusa a gravação', () => {
  const full = {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
  } as unknown as Storage
  expect(savePortfolio({ holdings: [], fixedIncome: { amount: 0 } }, full)).toBe(false)
})
