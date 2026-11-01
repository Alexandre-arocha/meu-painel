import {
  alignByDay,
  annualVol,
  correlation,
  dailyReturns,
  inBrl,
  lastMonths,
  maCrossBacktest,
  maxDrawdown,
  mergeSeries,
  portfolioRisk,
  projectFixedIncome,
  rsi,
  sma,
  splitByClass,
  stdev,
  tradingDay,
  withLivePrice,
} from './quant'
import { zeroClasses } from './portfolio'

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

test('rsi suaviza ganhos e perdas pelo método de Wilder, o padrão das corretoras', () => {
  // A média simples dos 2 últimos dias daria 50; Wilder guarda a alta forte do começo e dá 60.
  expect(rsi([1, 3, 4, 3], 2)).toBeCloseTo(60)
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

test('splitByClass divide o aporte pelo que falta para cada classe chegar à meta', () => {
  const current = { ...zeroClasses(), 'renda-fixa': 6000, acoes: 3000, exterior: 1000 }
  const target = { ...zeroClasses(), 'renda-fixa': 0.5, acoes: 0.3, exterior: 0.2 }
  // Com 2000, a carteira vai a 12000: falta 0 em renda fixa, 600 em ações e 1400 no exterior.
  const s = splitByClass(2000, current, target)
  expect(s['renda-fixa']).toBeCloseTo(0)
  expect(s.acoes).toBeCloseTo(600)
  expect(s.exterior).toBeCloseTo(1400)
  expect(Object.values(s).reduce((a, b) => a + b, 0)).toBeCloseTo(2000)
  expect(splitByClass(0, current, target).acoes).toBe(0)
})

test('mergeSeries junta os dias novos aos guardados, troca o dia repetido e mantém a ordem', () => {
  const old = [
    { t: '2026-10-28T13:00:00.000Z', p: 10 },
    { t: '2026-10-29T13:00:00.000Z', p: 11 },
  ]
  const fresh = [
    { t: '2026-10-29T20:00:00.000Z', p: 11.5 },
    { t: '2026-10-30T13:00:00.000Z', p: 12 },
  ]
  expect(mergeSeries(old, fresh)).toEqual([old[0], fresh[0], fresh[1]])
  expect(mergeSeries([], fresh)).toEqual(fresh)
})

test('lastMonths corta a série nos últimos meses contados do último ponto', () => {
  const pts = ['2026-06-30', '2026-07-31', '2026-08-01', '2026-10-31'].map((d, i) => ({ t: `${d}T13:00:00.000Z`, p: i }))
  expect(lastMonths(pts, 3).map((x) => x.p)).toEqual([1, 2, 3])
  expect(lastMonths([], 3)).toEqual([])
})

test('inBrl converte pelo dólar do mesmo dia ou do dia anterior e descarta o que vem antes do primeiro dólar', () => {
  const usd = [
    { t: '2026-10-28T15:00:00.000Z', p: 5 },
    { t: '2026-10-30T15:00:00.000Z', p: 6 },
  ]
  const aapl = [
    { t: '2026-10-27T13:30:00.000Z', p: 100 },
    { t: '2026-10-28T13:30:00.000Z', p: 100 },
    { t: '2026-10-29T13:30:00.000Z', p: 110 },
    { t: '2026-10-30T13:30:00.000Z', p: 120 },
  ]
  expect(inBrl(aapl, usd).map((x) => x.p)).toEqual([500, 550, 720])
  expect(inBrl(aapl, [])).toEqual([])
})

test('projectFixedIncome rende juros compostos pela taxa ao ano', () => {
  expect(projectFixedIncome(10000, 11)).toBeCloseTo(11100, 6)
  expect(projectFixedIncome(10000, 11, 24)).toBeCloseTo(12321, 6)
})

test('tradingDay usa o dia de Brasília', () => {
  expect(tradingDay('2026-10-30T03:00:00.000Z')).toBe('2026-10-30')
  expect(tradingDay('2026-10-31T01:00:00.000Z')).toBe('2026-10-30')
})

test('withLivePrice troca o fechamento de hoje pela cotação ao vivo ou acrescenta o dia novo', () => {
  const hist = [
    { t: '2026-10-29T03:00:00.000Z', p: 10 },
    { t: '2026-10-30T03:00:00.000Z', p: 11 },
  ]
  const live = (price: number, updatedAt: string) => ({ price, updatedAt })
  expect(withLivePrice(hist, live(12, '2026-10-30T17:00:00.000Z')).map((x) => x.p)).toEqual([10, 12])
  expect(withLivePrice(hist, live(13, '2026-10-31T14:00:00.000Z')).map((x) => x.p)).toEqual([10, 11, 13])
  expect(withLivePrice(hist, live(9, '2026-10-28T17:00:00.000Z'))).toEqual(hist)
  expect(withLivePrice(hist, live(9, 'undefined'))).toEqual(hist)
  expect(withLivePrice(hist, undefined)).toEqual(hist)
  expect(withLivePrice([], live(9, '2026-10-30T17:00:00.000Z'))).toEqual([])
})

test('alignByDay deixa só os dias em que todos os ativos negociaram', () => {
  const a = [
    { t: '2026-10-28T03:00:00.000Z', p: 10 },
    { t: '2026-10-29T03:00:00.000Z', p: 11 },
    { t: '2026-10-30T03:00:00.000Z', p: 12 },
  ]
  const b = [
    { t: '2026-10-29T03:00:00.000Z', p: 20 },
    { t: '2026-10-30T17:00:00.000Z', p: 21 },
    { t: '2026-10-31T03:00:00.000Z', p: 22 },
  ]
  expect(alignByDay([a, b])).toEqual([
    [11, 12],
    [20, 21],
  ])
  expect(alignByDay([])).toEqual([])
})
