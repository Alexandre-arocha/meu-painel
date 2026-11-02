import type { Point } from '../data/prices'
import { isPriced, type Position } from './portfolio'
import { alignByDay, alignPoints, cdiIndex, dailyReturns, hasMonths, lastMonths, stdev } from './quant'

// Contas da carteira inteira: risco, a busca por pesos e a projeção. Olham o passado; não são recomendação.

const TRADING_DAYS = 252
const DAYS_PER_MONTH = 21

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

// mulberry32: um sorteio pequeno e repetível, para os números não mudarem a cada vez que a tela abre.
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Retorno de cada dia da carteira, com os pesos fixos. As séries têm o mesmo tamanho.
export function portfolioDaily(returns: number[][], weights: number[]): number[] {
  const days = returns[0]?.length ?? 0
  return Array.from({ length: days }, (_, d) => returns.reduce((a, r, i) => a + weights[i] * r[d], 0))
}

function covariance(a: number[], b: number[]): number {
  const [ma, mb] = [mean(a), mean(b)]
  return a.reduce((sum, x, i) => sum + (x - ma) * (b[i] - mb), 0) / Math.max(a.length - 1, 1)
}

// Quanto do risco da carteira vem de cada ativo; as partes somam 1.
export function riskContribution(returns: number[][], weights: number[]): number[] {
  const daily = portfolioDaily(returns, weights)
  const variance = covariance(daily, daily)
  return returns.map((r, i) => (variance > 0 ? (weights[i] * covariance(r, daily)) / variance : 0))
}

export type Candidate = { weights: number[]; vol: number; ret: number }

const covMatrix = (returns: number[][]) => returns.map((a) => returns.map((b) => covariance(a, b)))
const volOf = (cov: number[][], w: number[]) => Math.sqrt(w.reduce((a, wi, i) => a + wi * w.reduce((b, wj, j) => b + wj * cov[i][j], 0), 0) * TRADING_DAYS)
const retOf = (means: number[], w: number[]) => w.reduce((a, wi, i) => a + wi * means[i], 0) * TRADING_DAYS

// Volatilidade e retorno ao ano de uma carteira, olhando o histórico.
export function candidate(returns: number[][], weights: number[]): Candidate {
  return { weights, vol: volOf(covMatrix(returns), weights), ret: retOf(returns.map(mean), weights) }
}

// Sorteia carteiras só com pesos positivos e fica com a de menor risco e a de melhor retorno acima do CDI por risco.
export function searchPortfolios(returns: number[][], riskFreeYear: number, count = 5000, seed = 1): { minRisk: Candidate; bestSharpe: Candidate; cloud: Candidate[] } {
  const random = seededRandom(seed)
  const cov = covMatrix(returns)
  const means = returns.map(mean)
  const cloud = Array.from({ length: count }, () => {
    // -log(u) normalizado sorteia por igual entre todas as divisões possíveis.
    const raw = returns.map(() => -Math.log(1 - random()))
    const sum = raw.reduce((a, b) => a + b, 0)
    const weights = raw.map((x) => x / sum)
    return { weights, vol: volOf(cov, weights), ret: retOf(means, weights) }
  })
  const sharpe = (c: Candidate) => (c.vol > 0 ? (c.ret - riskFreeYear) / c.vol : -Infinity)
  const minRisk = cloud.reduce((best, c) => (c.vol < best.vol ? c : best))
  const bestSharpe = cloud.reduce((best, c) => (sharpe(c) > sharpe(best) ? c : best))
  return { minRisk, bestSharpe, cloud }
}

// Média e desvio mensais dos retornos diários, em log, para o sorteio não dar preço negativo.
export function calibrate(daily: number[]): { monthlyMean: number; monthlySd: number } {
  const logs = daily.map((r) => Math.log(1 + r))
  return { monthlyMean: mean(logs) * DAYS_PER_MONTH, monthlySd: stdev(logs) * Math.sqrt(DAYS_PER_MONTH) }
}

export type Projection = { p10: number[]; p50: number[]; p90: number[] }

type ProjectionInput = {
  risky: number // parte com cotação, que oscila
  safe: number // parte que rende pelo índice
  contribution: number // aporte no fim de cada mês
  riskyShare: number // fração do aporte que vai para a parte com cotação
  monthlyMean: number
  monthlySd: number
  safeMonthly: number
  months: number
  paths?: number
  seed?: number
}

// Monte Carlo mês a mês: só a parte com cotação é sorteada; a outra cresce pela taxa. Devolve os cenários de cada mês.
export function monteCarlo({ risky, safe, contribution, riskyShare, monthlyMean, monthlySd, safeMonthly, months, paths = 2000, seed = 1 }: ProjectionInput): Projection {
  const random = seededRandom(seed)
  const normal = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
  const values = new Float64Array(paths).fill(risky)
  const start = risky + safe
  const out: Projection = { p10: [start], p50: [start], p90: [start] }
  let fixed = safe
  for (let m = 1; m <= months; m++) {
    fixed = fixed * (1 + safeMonthly) + contribution * (1 - riskyShare)
    for (let p = 0; p < paths; p++) values[p] = values[p] * Math.exp(monthlyMean + monthlySd * normal()) + contribution * riskyShare
    const sorted = values.slice().sort()
    const at = (q: number) => sorted[Math.floor(q * (paths - 1))] + fixed
    out.p10.push(at(0.1))
    out.p50.push(at(0.5))
    out.p90.push(at(0.9))
  }
  return out
}

export type Rates = { cdi: number | null; selic: number | null; ipca: number | null }

// Índices atuais, como fração ao ano: o CDI vem ao dia, a Selic ao ano e o IPCA ao mês (acumula os últimos 12).
export function annualRates({ cdi, selic, ipca }: { cdi: Point[]; selic: Point[]; ipca: Point[] }): Rates {
  const lastOf = (xs: Point[]) => xs[xs.length - 1]?.p
  const dayRate = lastOf(cdi)
  const selicNow = lastOf(selic)
  return {
    cdi: dayRate === undefined ? null : (1 + dayRate / 100) ** TRADING_DAYS - 1,
    selic: selicNow === undefined ? null : selicNow / 100,
    ipca: ipca.length === 0 ? null : ipca.slice(-12).reduce((a, x) => a * (1 + x.p / 100), 1) - 1,
  }
}

const POUPANCA_LIMIT = 0.085 // acima desta Selic, a poupança rende 0,5% ao mês; abaixo, 70% da Selic (sem a TR)

// Rendimento ao ano de um valor digitado, antes do imposto. Sem índice informado, rende o CDI. Sem o dado do índice, null.
export function fixedRate(p: Position, r: Rates): number | null {
  if (isPriced(p)) return null
  if (p.subtype === 'poupanca') {
    if (r.selic === null) return null
    return r.selic > POUPANCA_LIMIT ? 1.005 ** 12 - 1 : 0.7 * r.selic
  }
  const rate = p.rate ?? 0
  if (p.index === 'pre' && p.rate !== undefined) return rate / 100
  if (p.index === 'ipca') return r.ipca === null ? null : (1 + r.ipca) * (1 + rate / 100) - 1
  if (p.index === 'selic') return r.selic === null ? null : (1 + r.selic) * (1 + rate / 100) - 1
  if (r.cdi === null) return null
  return p.index === 'cdi' && p.rate !== undefined ? (r.cdi * rate) / 100 : r.cdi
}

export type Snapshots = Record<string, number>

const MAX_SNAPSHOTS = 1000

// Guarda o total do dia em centavos. O mesmo dia troca; passando do limite, saem os dias mais antigos.
export function recordSnapshot(snapshots: Snapshots, day: string, total: number): Snapshots {
  const next = { ...snapshots, [day]: Math.round(total * 100) / 100 }
  return Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)).slice(-MAX_SNAPSHOTS))
}

export type Versus = { you: number; ibov: number | null; cdi: number | null }

const YEAR = 12

// Em 1 ano: os ativos com cotação de hoje, com os pesos de hoje, contra o Ibovespa e o CDI. Sem 1 ano de cada ativo, null.
export function yearVersus(held: { points: Point[]; value: number }[], ibov: Point[], cdi: Point[]): Versus | null {
  if (held.length === 0 || !held.every((h) => hasMonths(h.points, YEAR))) return null
  const windows = held.map((h) => lastMonths(h.points, YEAR))
  const total = held.reduce((a, h) => a + h.value, 0)
  const daily = portfolioDaily(alignByDay(windows).map(dailyReturns), held.map((h) => h.value / total))
  const you = daily.reduce((a, r) => a * (1 + r), 1) - 1
  const recent = lastMonths(ibov, YEAR)
  const index = cdiIndex(alignPoints(windows)[0], cdi)
  return {
    you,
    ibov: recent.length > 1 ? recent[recent.length - 1].p / recent[0].p - 1 : null,
    cdi: index ? index[index.length - 1] - 1 : null,
  }
}
