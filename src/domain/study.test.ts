import { parseQuestions, pickNext, statsBySubject, wrongQuestions, type Attempt, type Question } from './study'

const q = (id: string, subject = 'A'): Question => ({
  id,
  area: 'geral',
  subject,
  statement: `Enunciado ${id}`,
  options: ['x', 'y'],
  answer: 0,
  explanation: '',
})
const at = (questionId: string, correct: boolean, t: string): Attempt => ({
  questionId,
  correct,
  at: `2026-10-28T${t}:00Z`,
})

test('statsBySubject conta respondidas e acertos por matéria', () => {
  const s = statsBySubject([q('1', 'A'), q('2', 'B')], [at('1', true, '10:00'), at('1', false, '11:00'), at('2', true, '10:00')])
  expect(s).toEqual([
    { subject: 'A', answered: 2, correct: 1, rate: 0.5 },
    { subject: 'B', answered: 1, correct: 1, rate: 1 },
  ])
})

test('wrongQuestions usa só a última tentativa de cada questão', () => {
  const w = wrongQuestions(
    [q('1'), q('2')],
    [at('1', false, '10:00'), at('1', true, '11:00'), at('2', true, '10:00'), at('2', false, '11:00')],
  )
  expect(w.map((x) => x.id)).toEqual(['2'])
})

test('pickNext no modo erros só devolve questões erradas', () => {
  const attempts = [at('2', false, '10:00'), at('1', true, '10:00')]
  for (const r of [0, 0.5, 0.99]) {
    expect(pickNext([q('1'), q('2'), q('3')], attempts, { mode: 'erros' }, () => r)?.id).toBe('2')
  }
})

test('pickNext no modo erros sem erros devolve undefined', () => {
  expect(pickNext([q('1')], [], { mode: 'erros' })).toBeUndefined()
})

test('pickNext filtra pela matéria escolhida', () => {
  for (const r of [0, 0.99]) {
    expect(pickNext([q('1', 'A'), q('2', 'B')], [], { mode: 'livre', subject: 'B' }, () => r)?.id).toBe('2')
  }
})

test('pickNext dá mais peso a questões erradas e não respondidas do que às acertadas', () => {
  // pesos base: acertada 1, nova 3, errada 4; matéria A com 50% de erro multiplica por 1,5 → 1,5 / 4,5 / 6 (total 12)
  const qs = [q('ok'), q('nova'), q('errada')]
  const attempts = [at('ok', true, '10:00'), at('errada', false, '10:00')]
  expect(pickNext(qs, attempts, { mode: 'livre' }, () => 0.1)?.id).toBe('ok')
  expect(pickNext(qs, attempts, { mode: 'livre' }, () => 0.3)?.id).toBe('nova')
  expect(pickNext(qs, attempts, { mode: 'livre' }, () => 0.6)?.id).toBe('errada')
})

test('pickNext evita repetir a questão atual quando há outras', () => {
  for (const r of [0, 0.99]) {
    expect(pickNext([q('1'), q('2')], [], { mode: 'livre' }, () => r, '1')?.id).toBe('2')
  }
})

test('parseQuestions aceita lista válida e completa campos opcionais', () => {
  const r = parseQuestions(
    JSON.stringify([{ id: 'x1', subject: 'Teste', statement: 'Quanto é 1+1?', options: ['1', '2'], answer: 1 }]),
  )
  expect(r).toEqual({
    ok: true,
    questions: [
      { id: 'x1', area: 'geral', subject: 'Teste', statement: 'Quanto é 1+1?', options: ['1', '2'], answer: 1, explanation: '' },
    ],
  })
})

test('parseQuestions rejeita JSON inválido, lista vazia, resposta fora das opções e ids repetidos', () => {
  expect(parseQuestions('abc')).toEqual({ ok: false, error: 'JSON inválido' })
  expect(parseQuestions('[]').ok).toBe(false)
  const bad = { id: 'a', subject: 'S', statement: 'E', options: ['1', '2'], answer: 2 }
  expect(parseQuestions(JSON.stringify([bad]))).toEqual({ ok: false, error: 'questão 1 incompleta' })
  const ok = { ...bad, answer: 0 }
  expect(parseQuestions(JSON.stringify([ok, ok]))).toEqual({ ok: false, error: 'ids repetidos' })
})
