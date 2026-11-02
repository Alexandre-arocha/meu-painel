import {
  alignPoints,
  backtest,
  beta,
  bollinger,
  bollingerPosition,
  bollingerSignal,
  cdiIndex,
  ema,
  hasMonths,
  indexTo100,
  macd,
  maCrossSignal,
  momentumSignal,
  rsiSignal,
  sharpe,
  sortino,
  alignByDay,
  annualVol,
  correlation,
  dailyReturns,
  inBrl,
  lastMonths,
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

test('backtest com o sinal das médias compara a estratégia com comprar e segurar', () => {
  const values = [10, 9, 8, 9, 10, 11, 12]
  const r = backtest(values, maCrossSignal(values, 2, 3))
  r.strategy.forEach((v, i) => expect(v).toBeCloseTo([1, 1, 1, 1, 1, 1.1, 1.2][i]))
  r.hold.forEach((v, i) => expect(v).toBeCloseTo([1, 0.9, 0.8, 0.9, 1, 1.1, 1.2][i]))
  expect(r.trades).toBe(1)
})

test('backtest desconta o custo a cada troca e só entra no dia seguinte ao sinal', () => {
  const r = backtest([10, 11, 11], [true, false, false], 0.01)
  // Entra no fechamento do dia 0 (paga 1%), ganha os 10% do dia 1 e sai no fechamento dele (paga mais 1%).
  r.strategy.forEach((v, i) => expect(v).toBeCloseTo([0.99, 0.99 * 1.1 * 0.99, 0.99 * 1.1 * 0.99][i]))
  expect(r.hold[2]).toBeCloseTo(1.1)
  expect(r.trades).toBe(2)
})

test('rsiSignal compra abaixo de 30 e vende acima de 70', () => {
  const down = Array.from({ length: 16 }, (_, i) => 100 - i)
  const up = Array.from({ length: 30 }, (_, i) => 85 + i * 2)
  const s = rsiSignal([...down, ...up])
  expect(s[13]).toBe(false) // ainda sem RSI
  expect(s[15]).toBe(true) // só caiu: RSI 0
  expect(s[s.length - 1]).toBe(false) // subiu até passar de 70
})

test('bollingerSignal compra abaixo da banda de baixo e vende acima da média', () => {
  const flat = Array.from({ length: 20 }, (_, i) => (i % 2 ? 101 : 99))
  const s = bollingerSignal([...flat, 90, 95, 105])
  expect(s[19]).toBe(false)
  expect(s[20]).toBe(true)
  expect(s[21]).toBe(true)
  expect(s[22]).toBe(false)
})

test('momentumSignal fica comprado quando o preço está acima de n pregões atrás', () => {
  expect(momentumSignal([10, 11, 12, 11, 10], 2)).toEqual([false, false, true, false, false])
})

test('ema começa pela média simples e depois pesa mais os dias novos', () => {
  const e = ema([1, 2, 3, 4, 5], 3)
  expect(e.slice(0, 2)).toEqual([null, null])
  expect(e[2]).toBeCloseTo(2)
  expect(e[3]).toBeCloseTo(3)
  expect(e[4]).toBeCloseTo(4)
})

test('macd com alta constante fica acima de zero e o sinal converge para ele', () => {
  const m = macd(Array.from({ length: 200 }, (_, i) => 100 + i))
  expect(m.line[24]).toBeNull()
  expect(m.line[25]).not.toBeNull()
  expect(m.signal[32]).toBeNull()
  // Numa reta, o MACD tende a (26 - 12) / 2 = 7 por dia de inclinação.
  expect(m.line[199]).toBeCloseTo(7, 3)
  expect(m.signal[199]).toBeCloseTo(7, 3)
})

test('bollinger usa o desvio da população, e a posição vai de 0 (banda de baixo) a 1 (banda de cima)', () => {
  const values = Array.from({ length: 20 }, (_, i) => (i % 2 ? 11 : 9))
  const b = bollinger(values)
  expect(b.middle[19]).toBeCloseTo(10)
  expect(b.upper[19]).toBeCloseTo(12)
  expect(b.lower[19]).toBeCloseTo(8)
  expect(b.upper[18]).toBeNull()
  expect(bollingerPosition(values)).toBeCloseTo(0.75)
  expect(bollingerPosition(Array(20).fill(10))).toBeNull()
  expect(bollingerPosition([1, 2])).toBeNull()
})

test('sharpe e sortino usam o retorno acima do CDI e dão null sem variação ou sem queda', () => {
  const r = [0.02, -0.01, 0.03, -0.02]
  const rf = [0.001, 0.001, 0.001, 0.001]
  // Excesso: 0,019; -0,011; 0,029; -0,021. Média 0,004; desvio amostral 0,02271; 252 pregões.
  expect(sharpe(r, rf)).toBeCloseTo((0.004 / stdev([0.019, -0.011, 0.029, -0.021])) * Math.sqrt(252))
  // Desvio só das quedas: raiz de (0,011² + 0,021²) / 4.
  expect(sortino(r, rf)).toBeCloseTo((0.004 / Math.sqrt((0.011 ** 2 + 0.021 ** 2) / 4)) * Math.sqrt(252))
  expect(sharpe([0.01, 0.01], [0, 0])).toBeNull()
  expect(sortino([0.01, 0.02], [0, 0])).toBeNull()
})

test('beta mede quanto o ativo anda a cada 1 do mercado; null se o mercado não varia', () => {
  expect(beta([0.02, -0.04, 0.06], [0.01, -0.02, 0.03])).toBeCloseTo(2)
  expect(beta([0.01, 0.02], [0, 0])).toBeNull()
})

test('cdiIndex acumula o CDI entre os dias da série, inclusive os sem pregão nela; sem cobertura, null', () => {
  const at = (d: number, p: number) => ({ t: new Date(Date.UTC(2026, 9, d, 12)).toISOString(), p })
  const points = [at(1, 10), at(2, 11), at(5, 12)]
  const rates = [at(1, 1), at(2, 1), at(3, 1), at(4, 1), at(5, 1), at(6, 1)]
  const idx = cdiIndex(points, rates)!
  expect(idx[0]).toBe(1)
  expect(idx[1]).toBeCloseTo(1.01)
  expect(idx[2]).toBeCloseTo(1.01 ** 4)
  expect(cdiIndex(points, [])).toBeNull()
  expect(cdiIndex(points, [at(2, 1)])).toBeNull()
})

test('indexTo100 põe a série na base 100', () => {
  expect(indexTo100([50, 75, 25])).toEqual([100, 150, 50])
})

test('hasMonths aceita a série que cobre o período, com folga de 15 dias', () => {
  const at = (y: number, m: number, d: number) => ({ t: new Date(Date.UTC(y, m, d, 12)).toISOString(), p: 1 })
  const end = at(2026, 9, 30)
  expect(hasMonths([at(2025, 9, 20), end], 12)).toBe(true)
  expect(hasMonths([at(2025, 10, 30), end], 12)).toBe(false)
  expect(hasMonths([], 12)).toBe(false)
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

test('alignPoints devolve os pontos de cada série só nos dias em comum', () => {
  const at = (d: number, p: number) => ({ t: new Date(Date.UTC(2026, 9, d, 15)).toISOString(), p })
  expect(alignPoints([[at(1, 1), at(2, 2)], [at(2, 9), at(3, 8)]])).toEqual([[at(2, 2)], [at(2, 9)]])
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
