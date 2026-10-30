import { longDate } from './format'

test('longDate escreve o dia da semana e a data por extenso', () => {
  expect(longDate(new Date(2026, 9, 29))).toBe('Quinta-feira, 29 de outubro')
})
