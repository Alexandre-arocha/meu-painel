import type { Point, Quote } from '../data/prices'
import type { Allocation } from './portfolio'

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
  if (values.length < n + 1) return null
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
  }
  if (gain === 0 && loss === 0) return 50
  if (loss === 0) return 100
  return 100 - 100 / (1 + gain / loss)
}

export type Backtest = { strategy: number[]; hold: number[]; trades: number }

// Fica comprado no dia seguinte a um dia em que a média rápida fechou acima da lenta.
export function maCrossBacktest(values: number[], fast = 9, slow = 21): Backtest {
  const f = sma(values, fast)
  const s = sma(values, slow)
  let inPosition = false
  let trades = 0
  const strategy = [1]
  const hold = [1]
  for (let i = 1; i < values.length; i++) {
    const r = values[i] / values[i - 1] - 1
    strategy.push(strategy[i - 1] * (inPosition ? 1 + r : 1))
    hold.push(hold[i - 1] * (1 + r))
    const fi = f[i]
    const si = s[i]
    if (fi != null && si != null && (fi > si) !== inPosition) {
      inPosition = !inPosition
      trades++
    }
  }
  return { strategy, hold, trades }
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

export type Split = {
  BBAS3: { shares: number; value: number }
  B3SA3: { shares: number; value: number }
  fixedIncome: number
}

// Divide o aporte pelo que falta para cada parte chegar à meta. Ações em quantidade inteira; o resto vai para a renda fixa.
export function splitContribution(
  amount: number,
  currentValues: Allocation,
  target: Allocation,
  prices: { BBAS3?: number; B3SA3?: number },
): Split {
  const total = currentValues.fixedIncome + currentValues.BBAS3 + currentValues.B3SA3 + amount
  const need = (k: keyof Allocation) => Math.max(0, target[k] * total - currentValues[k])
  const sumNeed = need('fixedIncome') + need('BBAS3') + need('B3SA3')
  const stock = (k: 'BBAS3' | 'B3SA3') => {
    const price = prices[k] ?? 0
    const part = sumNeed > 0 ? (amount * need(k)) / sumNeed : 0
    const shares = price > 0 ? Math.floor(part / price) : 0
    return { shares, value: shares * price }
  }
  const BBAS3 = stock('BBAS3')
  const B3SA3 = stock('B3SA3')
  return { BBAS3, B3SA3, fixedIncome: amount - BBAS3.value - B3SA3.value }
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

// Fechamentos de cada série só nos dias em que todas negociaram, para comparar dia com dia.
export function alignByDay(list: Point[][]): number[][] {
  const byDay = list.map((points) => new Map(points.map((x) => [tradingDay(x.t), x.p])))
  const days = [...(byDay[0]?.keys() ?? [])].filter((d) => byDay.every((m) => m.has(d)))
  return byDay.map((m) => days.map((d) => m.get(d) as number))
}
