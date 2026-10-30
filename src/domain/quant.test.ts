import {
  annualVol,
  correlation,
  dailyReturns,
  maCrossBacktest,
  maxDrawdown,
  portfolioRisk,
  projectFixedIncome,
  rsi,
  sma,
  splitContribution,
  stdev,
} from './quant'

test('sma calcula a média móvel e deixa null antes de ter dados suficientes', () => {
  expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4])
})

test('dailyReturns e stdev', () => {
  const r = dailyReturns([100, 110, 99])
  expect(r[0]).toBeCloseTo(0.1)
  expect(r[1]).toBeCloseTo(-0.1)
  expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3)
})

test('annualVol é zero quando o retorno diário não varia', () => {
  expect(annualVol([100, 101, 102.01, 103.0301])).toBeCloseTo(0, 6)
})

test('maxDrawdown mede a maior queda desde um topo', () => {
  expect(maxDrawdown([100, 120, 90, 130, 117])).toBeCloseTo(-0.25)
})

test('rsi dá 100 quando só sobe, 50 quando alterna altas e baixas iguais e null sem dados', () => {
  expect(rsi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])).toBe(100)
  expect(rsi(Array.from({ length: 15 }, (_, i) => (i % 2 === 0 ? 10 : 11)))).toBeCloseTo(50)
  expect(rsi([1, 2, 3])).toBeNull()
})

test('maCrossBacktest compara a estratégia de médias com comprar e segurar', () => {
  const r = maCrossBacktest([10, 9, 8, 9, 10, 11, 12], 2, 3)
  r.strategy.forEach((v, i) => expect(v).toBeCloseTo([1, 1, 1, 1, 1, 1.1, 1.2][i]))
  r.hold.forEach((v, i) => expect(v).toBeCloseTo([1, 0.9, 0.8, 0.9, 1, 1.1, 1.2][i]))
  expect(r.trades).toBe(1)
})

test('correlation dá 1 para séries que andam juntas, -1 para opostas e null sem variação', () => {
  expect(correlation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
  expect(correlation([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1)
  expect(correlation([1, 1, 1], [1, 2, 3])).toBeNull()
})

test('portfolioRisk calcula a volatilidade e a queda possível num dia ruim (VaR 95%)', () => {
  const risk = portfolioRisk([{ value: 1000, returns: [0.01, -0.01, 0.01, -0.01] }], 1000)
  expect(risk.total).toBe(2000)
  expect(risk.var95).toBeCloseTo(19, 0)
  expect(risk.annualVol).toBeCloseTo(0.0917, 3)
})

test('splitContribution divide o aporte para chegar perto da meta, em ações inteiras', () => {
  const s = splitContribution(
    1000,
    { fixedIncome: 10000, BBAS3: 1646, B3SA3: 2840 },
    { fixedIncome: 0.6, BBAS3: 0.2, B3SA3: 0.2 },
    { BBAS3: 16.46, B3SA3: 14.2 },
  )
  expect(s.BBAS3.shares).toBe(51)
  expect(s.B3SA3.shares).toBe(10)
  expect(s.fixedIncome).toBeCloseTo(18.54, 2)
})

test('projectFixedIncome rende juros compostos pela taxa ao ano', () => {
  expect(projectFixedIncome(10000, 11)).toBeCloseTo(11100, 6)
  expect(projectFixedIncome(10000, 11, 24)).toBeCloseTo(12321, 6)
})
