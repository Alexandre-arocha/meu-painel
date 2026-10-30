import { allocation, parseAmount, parseQuantity, portfolioValue, type Portfolio } from './portfolio'

const carteira: Portfolio = {
  holdings: [
    { symbol: 'BBAS3', quantity: 100 },
    { symbol: 'B3SA3', quantity: 200 },
  ],
  fixedIncome: { amount: 10000 },
}

test('portfolioValue soma renda fixa e ações pelo preço', () => {
  expect(portfolioValue(carteira, { BBAS3: 16.46, B3SA3: 14.2 })).toBeCloseTo(14486, 2)
})

test('portfolioValue conta como zero a ação sem preço', () => {
  expect(portfolioValue(carteira, { BBAS3: 16.46 })).toBeCloseTo(11646, 2)
})

test('parseAmount aceita "10000", "10.000,50" e "10000.5"', () => {
  expect(parseAmount('10000')).toEqual({ ok: true, value: 10000 })
  expect(parseAmount('10.000,50')).toEqual({ ok: true, value: 10000.5 })
  expect(parseAmount('10000.5')).toEqual({ ok: true, value: 10000.5 })
})

test('parseAmount rejeita "-5", "abc" e ""', () => {
  for (const bad of ['-5', 'abc', '']) expect(parseAmount(bad).ok).toBe(false)
})

const empty: Portfolio = { holdings: [], fixedIncome: { amount: 0 } }

test('allocation com 10000 de renda fixa, 100 BBAS3 a 30 e 50 B3SA3 a 20 soma 1', () => {
  const p: Portfolio = {
    holdings: [
      { symbol: 'BBAS3', quantity: 100 },
      { symbol: 'B3SA3', quantity: 50 },
    ],
    fixedIncome: { amount: 10000 },
  }
  const a = allocation(p, { BBAS3: 30, B3SA3: 20 })
  expect(a.fixedIncome).toBeCloseTo(10000 / 14000)
  expect(a.BBAS3).toBeCloseTo(3000 / 14000)
  expect(a.B3SA3).toBeCloseTo(1000 / 14000)
  expect(a.fixedIncome + a.BBAS3 + a.B3SA3).toBeCloseTo(1)
})

test('allocation com carteira vazia devolve zeros', () => {
  expect(allocation(empty, {})).toEqual({ fixedIncome: 0, BBAS3: 0, B3SA3: 0 })
})

test('allocation ignora ticker sem preço e não retorna NaN', () => {
  const p: Portfolio = {
    holdings: [{ symbol: 'BBAS3', quantity: 10 }],
    fixedIncome: { amount: 1000 },
  }
  const a = allocation(p, {})
  expect(a).toEqual({ fixedIncome: 1, BBAS3: 0, B3SA3: 0 })
})

test('parseQuantity rejeita "-1", "abc" e ""', () => {
  for (const bad of ['-1', 'abc', '']) {
    expect(parseQuantity(bad).ok).toBe(false)
  }
})

test('parseQuantity aceita "10" como 10', () => {
  expect(parseQuantity('10')).toEqual({ ok: true, value: 10 })
})

test('parseQuantity rejeita "1,5" com erro "use número inteiro"', () => {
  expect(parseQuantity('1,5')).toEqual({ ok: false, error: 'use número inteiro' })
})
