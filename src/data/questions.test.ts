import { SEED_QUESTIONS } from './questions'
import { parseQuestions } from '../domain/study'

test('banco inicial é válido, sem ids repetidos, e cobre tecnologia e militar', () => {
  expect(parseQuestions(JSON.stringify(SEED_QUESTIONS)).ok).toBe(true)
  const areas = new Set(SEED_QUESTIONS.map((q) => q.area))
  expect(areas.has('tecnologia')).toBe(true)
  expect(areas.has('militar')).toBe(true)
})

test('a primeira questão do banco é a de roteamento no modelo OSI', () => {
  expect(SEED_QUESTIONS[0]).toMatchObject({ id: 't-redes-1', answer: 1, options: ['Enlace', 'Rede', 'Transporte', 'Aplicação'] })
})
