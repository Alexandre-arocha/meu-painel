import type { Position } from './portfolio'
import {
  annualRates,
  calibrate,
  fixedRate,
  monteCarlo,
  portfolioDaily,
  recordSnapshot,
  riskContribution,
  searchPortfolios,
  seededRandom,
  yearVersus,
} from './portfolioLab'

const at = (i: number, p: number) => ({ t: new Date(Date.UTC(2026, 9, 30, 15) - (i * 86_400_000 * 366) / 250).toISOString(), p })

test('o sorteio com a mesma semente repete a sequência', () => {
  const [a, b, c] = [seededRandom(7), seededRandom(7), seededRandom(8)]
  const first = [a(), a(), a()]
  expect([b(), b(), b()]).toEqual(first)
  expect(c()).not.toBe(first[0])
  expect(first.every((x) => x >= 0 && x < 1)).toBe(true)
})

test('portfolioDaily soma os retornos pelo peso de cada ativo', () => {
  const daily = portfolioDaily([[0.01, 0.02], [0.03, -0.02]], [0.5, 0.25])
  expect(daily[0]).toBeCloseTo(0.0125)
  expect(daily[1]).toBeCloseTo(0.005)
})

test('riskContribution: um ativo sem oscilação não contribui e as partes somam 1', () => {
  const a = [0.02, -0.01, 0.03, -0.02]
  const flat = [0, 0, 0, 0]
  expect(riskContribution([a, flat], [0.5, 0.5])).toEqual([1, 0])
  const c = riskContribution([a, [0.01, 0.02, -0.01, 0.01]], [0.6, 0.4])
  expect(c[0] + c[1]).toBeCloseTo(1)
  expect(riskContribution([flat], [1])).toEqual([0])
})

// Dois ativos sem correlação, com volatilidades 1 e 2: o menor risco tem 80% no primeiro (2² / (1² + 2²)).
const zigzag = (size: number, order: number[]) => Array.from({ length: 400 }, (_, i) => order[i % 4] * size)
const calm = zigzag(0.01, [1, -1, 1, -1])
const wild = zigzag(0.02, [1, 1, -1, -1])

test('a busca acha a carteira de menor risco de um caso com resposta conhecida', () => {
  const r = searchPortfolios([calm, wild], 0, 5000, 1)
  expect(r.minRisk.weights[0]).toBeCloseTo(0.8, 1)
  expect(r.minRisk.weights[0] + r.minRisk.weights[1]).toBeCloseTo(1)
  expect(r.cloud).toHaveLength(5000)
  expect(r.cloud.every((p) => p.vol >= r.minRisk.vol)).toBe(true)
  expect(searchPortfolios([calm, wild], 0, 5000, 1).minRisk).toEqual(r.minRisk)
})

test('a melhor relação retorno por risco desconta o CDI e prefere o ativo que rende mais', () => {
  const up = calm.map((x) => x + 0.001)
  const r = searchPortfolios([up, calm], 0.02, 2000, 1)
  expect(r.bestSharpe.weights[0]).toBeGreaterThan(0.9)
})

test('monteCarlo com volatilidade zero dá o valor exato', () => {
  const r = monteCarlo({ risky: 1000, safe: 2000, contribution: 100, riskyShare: 0.5, monthlyMean: Math.log(1.01), monthlySd: 0, safeMonthly: 0.005, months: 2, paths: 50, seed: 1 })
  const risky = (1000 * 1.01 + 50) * 1.01 + 50
  const safe = (2000 * 1.005 + 50) * 1.005 + 50
  expect(r.p50[0]).toBe(3000)
  expect(r.p50[2]).toBeCloseTo(risky + safe)
  expect(r.p10[2]).toBeCloseTo(r.p90[2])
})

test('monteCarlo devolve os cenários em ordem e repete com a mesma semente', () => {
  const params = { risky: 1000, safe: 0, contribution: 0, riskyShare: 1, monthlyMean: 0.01, monthlySd: 0.08, safeMonthly: 0, months: 24, paths: 500, seed: 3 }
  const r = monteCarlo(params)
  expect(r.p50).toHaveLength(25)
  for (let m = 1; m <= 24; m++) {
    expect(r.p10[m]).toBeLessThan(r.p50[m])
    expect(r.p50[m]).toBeLessThan(r.p90[m])
  }
  // A mediana de um passeio lognormal é o valor inicial crescendo pela média.
  expect(r.p50[24]).toBeGreaterThan(1000 * Math.exp(0.24) * 0.85)
  expect(r.p50[24]).toBeLessThan(1000 * Math.exp(0.24) * 1.15)
  expect(monteCarlo(params)).toEqual(r)
})

test('calibrate tira a média e o desvio mensais dos retornos diários', () => {
  const c = calibrate(Array(21).fill(0.001))
  expect(c.monthlyMean).toBeCloseTo(21 * Math.log(1.001))
  expect(c.monthlySd).toBeCloseTo(0)
})

test('annualRates lê o CDI ao dia, a Selic ao ano e 12 meses de IPCA; sem dados, null', () => {
  const ipca = Array.from({ length: 14 }, (_, i) => ({ t: `2026-${String((i % 12) + 1).padStart(2, '0')}-01`, p: i < 2 ? 9 : 0.5 }))
  const rates = annualRates({ cdi: [{ t: 'x', p: 0.05 }], selic: [{ t: 'x', p: 13 }], ipca })
  expect(rates.cdi).toBeCloseTo(1.0005 ** 252 - 1)
  expect(rates.selic).toBeCloseTo(0.13)
  expect(rates.ipca).toBeCloseTo(1.005 ** 12 - 1)
  expect(annualRates({ cdi: [], selic: [], ipca: [] })).toEqual({ cdi: null, selic: null, ipca: null })
})

test('fixedRate segue o índice de cada título; a poupança segue a regra oficial pela Selic', () => {
  const rates = { cdi: 0.1, selic: 0.11, ipca: 0.05 }
  const base = { id: '1', name: 'X', amount: 100 }
  const rf = (over: Partial<Position>) => fixedRate({ ...base, kind: 'renda-fixa', ...over } as Position, rates)
  expect(rf({ index: 'cdi', rate: 110 })).toBeCloseTo(0.11)
  expect(rf({ index: 'pre', rate: 12 })).toBeCloseTo(0.12)
  expect(rf({ index: 'ipca', rate: 6 })).toBeCloseTo(1.05 * 1.06 - 1)
  expect(rf({ index: 'selic', rate: 0.1 })).toBeCloseTo(1.11 * 1.001 - 1)
  // Selic acima de 8,5%: 0,5% ao mês. Abaixo: 70% da Selic.
  expect(rf({ subtype: 'poupanca' })).toBeCloseTo(1.005 ** 12 - 1)
  expect(fixedRate({ ...base, kind: 'renda-fixa', subtype: 'poupanca' }, { ...rates, selic: 0.07 })).toBeCloseTo(0.049)
  // Sem índice (fundos, previdência, título sem taxa): rende o CDI.
  expect(fixedRate({ ...base, kind: 'fundo' }, rates)).toBeCloseTo(0.1)
  expect(fixedRate({ ...base, kind: 'fundo' }, { cdi: null, selic: null, ipca: null })).toBeNull()
})

test('recordSnapshot grava o dia em centavos, troca o mesmo dia e guarda até 1000 dias', () => {
  expect(recordSnapshot({ '2026-10-30': 1 }, '2026-10-30', 1234.567)).toEqual({ '2026-10-30': 1234.57 })
  const many = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`d${String(i).padStart(4, '0')}`, i]))
  const next = recordSnapshot(many, 'e', 5)
  expect(Object.keys(next)).toHaveLength(1000)
  expect(next.d0000).toBeUndefined()
  expect(next.e).toBe(5)
})

test('yearVersus compara a carteira de hoje, o Ibovespa e o CDI em 1 ano; sem 1 ano de histórico, null', () => {
  const days = Array.from({ length: 250 }, (_, i) => 249 - i)
  const asset = days.map((i, k) => at(i, 100 * 1.001 ** k))
  const ibov = days.map((i, k) => at(i, 1000 * 1.0005 ** k))
  const cdi = days.map((i) => at(i, 0.04))
  const r = yearVersus([{ points: asset, value: 1000 }], ibov, cdi)!
  expect(r.you).toBeCloseTo(1.001 ** 249 - 1, 2)
  expect(r.ibov).toBeCloseTo(1.0005 ** 249 - 1, 2)
  expect(r.cdi).toBeCloseTo(1.0004 ** 249 - 1, 2)
  expect(yearVersus([{ points: asset.slice(-50), value: 1000 }], ibov, cdi)).toBeNull()
  expect(yearVersus([], ibov, cdi)).toBeNull()
  expect(yearVersus([{ points: asset, value: 1000 }], [], [])).toEqual({ you: r.you, ibov: null, cdi: null })
})
