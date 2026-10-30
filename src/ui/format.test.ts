import { longDate, ratio } from './format'

test('ratio escreve uma fração como porcentagem com uma casa', () => {
  expect(ratio(0.2843)).toBe('28,4%')
})

test('longDate escreve o dia da semana e a data por extenso', () => {
  expect(longDate(new Date(2026, 9, 29))).toBe('Quinta-feira, 29 de outubro')
})
