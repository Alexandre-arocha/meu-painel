import type { Point, Quote } from '../data/prices'
import { CLASSES, type ClassTargets, type ClassValues } from './portfolio'

// Contas do motor quantitativo: descrevem o passado e fazem contas com a meta. Não preveem preço.

const TRADING_DAYS = 252

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export function sma(values: number[], n: number): (number | null)[] {
  return values.map((_, i) => (i < n - 1 ? null : mean(values.slice(i - n + 1, i + 1))))
}

export function dailyReturns(values: number[]): number[] {
  return values.slice(1).map((v, i) => v / values[i] - 1)
}

// Desvio padrão amostral (divide por n − 1).
export function stdev(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1))
}

export function annualVol(values: number[]): number {
  return stdev(dailyReturns(values)) * Math.sqrt(TRADING_DAYS)
}

// Maior queda desde um topo, como fração negativa (-0.25 = caiu 25%).
export function maxDrawdown(values: number[]): number {
  let peak = values[0] ?? 0
  let worst = 0
  for (const v of values) {
    peak = Math.max(peak, v)
    if (peak > 0) worst = Math.min(worst, v / peak - 1)
  }
  return worst
}

// RSI de Wilder, o das corretoras: média simples dos n primeiros dias, depois suavizada dia a dia; null sem dados suficientes.
export function rsi(values: number[], n = 14): number | null {
  return rsiSeries(values, n)[values.length - 1] ?? null
}

function strength(gain: number, loss: number): number {
  if (gain === 0 && loss === 0) return 50
  if (loss === 0) return 100
  return 100 - 100 / (1 + gain / loss)
}

function rsiSeries(values: number[], n = 14): (number | null)[] {
  const out: (number | null)[] = values.map(() => null)
  let gain = 0
  let loss = 0
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1]
    const up = Math.max(d, 0)
    const down = Math.max(-d, 0)
    if (i <= n) {
      gain += up / n
      loss += down / n
    } else {
      gain = (gain * (n - 1) + up) / n
      loss = (loss * (n - 1) + down) / n
    }
    if (i >= n) out[i] = strength(gain, loss)
  }
  return out
}

// Média exponencial: começa pela média simples dos n primeiros dias.
export function ema(values: number[], n: number): (number | null)[] {
  const k = 2 / (n + 1)
  let prev = 0
  return values.map((v, i) => {
    if (i < n - 1) return null
    prev = i === n - 1 ? mean(values.slice(0, n)) : v * k + prev * (1 - k)
    return prev
  })
}

export function macd(values: number[], fast = 12, slow = 26, smooth = 9): { line: (number | null)[]; signal: (number | null)[] } {
  const f = ema(values, fast)
  const s = ema(values, slow)
  const line = values.map((_, i) => {
    const [a, b] = [f[i], s[i]]
    return a == null || b == null ? null : a - b
  })
  const start = Math.min(slow - 1, values.length)
  return { line, signal: [...line.slice(0, start), ...ema(line.slice(start) as number[], smooth)] }
}

// Bandas de Bollinger: média de n dias e k desvios (da população, como nas corretoras) para cada lado.
export function bollinger(values: number[], n = 20, k = 2): { middle: (number | null)[]; upper: (number | null)[]; lower: (number | null)[] } {
  const middle = sma(values, n)
  const width = middle.map((m, i) => {
    if (m == null) return null
    const window = values.slice(i - n + 1, i + 1)
    return k * Math.sqrt(window.reduce((a, v) => a + (v - m) ** 2, 0) / n)
  })
  const band = (sign: number) => middle.map((m, i) => (m == null ? null : m + sign * (width[i] as number)))
  return { middle, upper: band(1), lower: band(-1) }
}

// Onde o último preço está entre as bandas: 0 na de baixo, 1 na de cima; pode passar dos dois lados.
export function bollingerPosition(values: number[]): number | null {
  const { upper, lower } = bollinger(values)
  const i = values.length - 1
  const [up, low] = [upper[i], lower[i]]
  if (up == null || low == null || up === low) return null
  return (values[i] - low) / (up - low)
}

// Retorno por unidade de risco acima do CDI, ao ano. Séries do mesmo tamanho; sem variação, null.
export function sharpe(returns: number[], riskFree: number[]): number | null {
  const excess = returns.map((r, i) => r - riskFree[i])
  const sd = stdev(excess)
  return sd > 0 ? (mean(excess) / sd) * Math.sqrt(TRADING_DAYS) : null
}

// Como o Sharpe, mas só as quedas contam como risco; sem nenhuma queda, null.
export function sortino(returns: number[], riskFree: number[]): number | null {
  const excess = returns.map((r, i) => r - riskFree[i])
  if (excess.length === 0) return null
  const downside = Math.sqrt(mean(excess.map((e) => Math.min(e, 0) ** 2)))
  return downside > 0 ? (mean(excess) / downside) * Math.sqrt(TRADING_DAYS) : null
}

// Quanto o ativo anda a cada 1 do mercado.
export function beta(returns: number[], market: number[]): number | null {
  const [mr, mm] = [mean(returns), mean(market)]
  const cov = returns.reduce((a, r, i) => a + (r - mr) * (market[i] - mm), 0)
  const variance = market.reduce((a, m) => a + (m - mm) ** 2, 0)
  return variance > 0 ? cov / variance : null
}

// CDI acumulado de cada ponto desde o primeiro, que vale 1. As taxas são % ao dia, em ordem; sem cobrir o início, null.
export function cdiIndex(points: Point[], rates: Point[]): number[] | null {
  const start = points[0] && tradingDay(points[0].t)
  if (!start || !rates[0] || tradingDay(rates[0].t) > start) return null
  let j = 0
  while (j < rates.length && tradingDay(rates[j].t) <= start) j++
  let total = 1
  return points.map((x) => {
    const day = tradingDay(x.t)
    for (; j < rates.length && tradingDay(rates[j].t) <= day; j++) total *= 1 + rates[j].p / 100
    return total
  })
}

export const indexTo100 = (values: number[]) => values.map((v) => (v / values[0]) * 100)

export type Backtest = { strategy: number[]; hold: number[]; trades: number }

// signal[i]: quer estar comprado depois do fechamento do dia i. O ganho só conta do dia seguinte, e cada troca paga o custo.
export function backtest(values: number[], signal: boolean[], cost = 0): Backtest {
  let inPosition = false
  let trades = 0
  const strategy: number[] = []
  const hold: number[] = []
  for (let i = 0; i < values.length; i++) {
    const r = i === 0 ? 0 : values[i] / values[i - 1] - 1
    strategy.push((strategy[i - 1] ?? 1) * (inPosition ? 1 + r : 1))
    hold.push((hold[i - 1] ?? 1) * (1 + r))
    if (signal[i] !== inPosition) {
      inPosition = !inPosition
      trades++
      strategy[i] *= 1 - cost
    }
  }
  return { strategy, hold, trades }
}

// Cruzamento: comprado com a média rápida acima da lenta.
export function maCrossSignal(values: number[], fast: number, slow: number): boolean[] {
  const f = sma(values, fast)
  const s = sma(values, slow)
  return values.map((_, i) => {
    const [a, b] = [f[i], s[i]]
    return a != null && b != null && a > b
  })
}

// Entra quando o indicador pede e segura até ele pedir para sair.
function holdUntil(values: number[], enter: (i: number) => boolean, exit: (i: number) => boolean): boolean[] {
  let on = false
  return values.map((_, i) => {
    if (enter(i)) on = true
    else if (exit(i)) on = false
    return on
  })
}

export function rsiSignal(values: number[], low = 30, high = 70): boolean[] {
  const r = rsiSeries(values)
  return holdUntil(values, (i) => (r[i] ?? 50) < low, (i) => (r[i] ?? 50) > high)
}

// Compra abaixo da banda de baixo e vende quando o preço volta para cima da média.
export function bollingerSignal(values: number[]): boolean[] {
  const { middle, lower } = bollinger(values)
  return holdUntil(
    values,
    (i) => values[i] < (lower[i] ?? -Infinity),
    (i) => values[i] > (middle[i] ?? Infinity),
  )
}

// Comprado quando o preço está acima do de n pregões atrás (63 pregões: cerca de 3 meses).
export function momentumSignal(values: number[], n = 63): boolean[] {
  return values.map((v, i) => i >= n && v > values[i - n])
}

// Correlação de Pearson dos últimos pontos em comum; null quando uma série não varia.
export function correlation(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length)
  if (n < 2) return null
  const x = a.slice(-n)
  const y = b.slice(-n)
  const mx = mean(x)
  const my = mean(y)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my)
    sxx += (x[i] - mx) ** 2
    syy += (y[i] - my) ** 2
  }
  if (sxx === 0 || syy === 0) return null
  return sxy / Math.sqrt(sxx * syy)
}

export type Risk = { total: number; annualVol: number; var95: number }

// shortcut: a renda fixa entra com volatilidade zero; trocar se a carteira tiver título prefixado longo.
export function portfolioRisk(stocks: { value: number; returns: number[] }[], fixedIncome: number): Risk {
  const total = fixedIncome + stocks.reduce((a, s) => a + s.value, 0)
  if (total <= 0) return { total: 0, annualVol: 0, var95: 0 }
  const n = stocks.length === 0 ? 0 : Math.min(...stocks.map((s) => s.returns.length))
  const daily = Array.from({ length: n }, (_, i) =>
    stocks.reduce((a, s) => a + (s.value / total) * s.returns[s.returns.length - n + i], 0),
  )
  const sd = stdev(daily)
  return { total, annualVol: sd * Math.sqrt(TRADING_DAYS), var95: 1.645 * sd * total }
}

// Divide o aporte pelo que falta para cada classe chegar à meta. A escolha do ativo dentro da classe fica com quem investe.
export function splitByClass(amount: number, current: ClassValues, target: ClassTargets): ClassValues {
  const total = Object.values(current).reduce((a, b) => a + b, 0) + amount
  const need = CLASSES.map(({ id }) => [id, Math.max(0, target[id] * total - current[id])] as const)
  const sumNeed = need.reduce((a, [, n]) => a + n, 0)
  return Object.fromEntries(need.map(([id, n]) => [id, sumNeed > 0 ? (amount * n) / sumNeed : 0])) as ClassValues
}

export function projectFixedIncome(amount: number, ratePctYear: number, months = 12): number {
  return amount * (1 + ratePctYear / 100) ** (months / 12)
}

// Dia do pregão em Brasília (UTC-3 o ano todo), como AAAA-MM-DD.
export function tradingDay(iso: string): string {
  return new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(0, 10)
}

// Junta a cotação ao vivo ao histórico diário: ela troca o fechamento do mesmo dia ou entra como o dia seguinte.
export function withLivePrice(points: Point[], live?: Pick<Quote, 'price' | 'updatedAt'>): Point[] {
  const lastPoint = points[points.length - 1]
  if (!live || !lastPoint || Number.isNaN(Date.parse(live.updatedAt))) return points
  const day = tradingDay(live.updatedAt)
  const lastDay = tradingDay(lastPoint.t)
  if (day < lastDay) return points
  const point = { t: live.updatedAt, p: live.price }
  return day === lastDay ? [...points.slice(0, -1), point] : [...points, point]
}

const MAX_POINTS = 2600 // cerca de 10 anos de pregões

// Junta fechamentos novos aos guardados pelo dia do pregão: o novo vale mais.
export function mergeSeries(old: Point[], fresh: Point[]): Point[] {
  const byDay = new Map(old.map((x) => [tradingDay(x.t), x]))
  for (const x of fresh) byDay.set(tradingDay(x.t), x)
  return [...byDay.values()].sort((a, b) => a.t.localeCompare(b.t)).slice(-MAX_POINTS)
}

// Os últimos meses da série, contados a partir do último ponto.
export function lastMonths(points: Point[], months: number): Point[] {
  const end = points[points.length - 1]
  if (!end) return []
  const from = monthsBefore(end.t, months)
  return points.filter((x) => Date.parse(x.t) >= from)
}

function monthsBefore(iso: string, months: number): number {
  const d = new Date(iso)
  return d.setUTCMonth(d.getUTCMonth() - months)
}

const SLACK_DAYS = 15 // feriados e dias sem pregão no começo do período

// A série cobre esse período inteiro? A cripto, por exemplo, só tem 1 ano.
export function hasMonths(points: Point[], months: number): boolean {
  const end = points[points.length - 1]
  return !!end && Date.parse(points[0].t) <= monthsBefore(end.t, months) + SLACK_DAYS * 86_400_000
}

// Série em dólar em reais, pelo dólar do mesmo dia; sem cotação no dia, vale a do dia anterior. As duas vêm em ordem.
export function inBrl(points: Point[], usd: Point[]): Point[] {
  const out: Point[] = []
  let j = -1
  for (const x of points) {
    const day = tradingDay(x.t)
    while (j + 1 < usd.length && tradingDay(usd[j + 1].t) <= day) j++
    if (j >= 0) out.push({ t: x.t, p: x.p * usd[j].p })
  }
  return out
}

// Os pontos de cada série só nos dias em que todas negociaram, para comparar dia com dia.
export function alignPoints(list: Point[][]): Point[][] {
  const byDay = list.map((points) => new Map(points.map((x) => [tradingDay(x.t), x])))
  const days = [...(byDay[0]?.keys() ?? [])].filter((d) => byDay.every((m) => m.has(d)))
  return byDay.map((m) => days.map((d) => m.get(d) as Point))
}

export function alignByDay(list: Point[][]): number[][] {
  return alignPoints(list).map((points) => points.map((x) => x.p))
}
