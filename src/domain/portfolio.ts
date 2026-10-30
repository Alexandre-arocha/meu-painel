export type Ticker = 'BBAS3' | 'B3SA3'
export type Holding = { symbol: Ticker; quantity: number }
export type FixedIncome = { amount: number; ratePctYear?: number; maturity?: string }
export type Portfolio = { holdings: Holding[]; fixedIncome: FixedIncome }
export type Allocation = { fixedIncome: number; BBAS3: number; B3SA3: number }

export type QuantityResult = { ok: true; value: number } | { ok: false; error: string }

export function parseQuantity(input: string): QuantityResult {
  const text = input.trim()
  if (text === '') return { ok: false, error: 'informe a quantidade' }
  if (/^\d+[.,]\d+$/.test(text)) return { ok: false, error: 'use número inteiro' }
  if (!/^\d+$/.test(text)) return { ok: false, error: 'use apenas números positivos' }
  return { ok: true, value: Number(text) }
}

export function parseAmount(input: string): QuantityResult {
  let t = input.replace(/R\$|\s/g, '')
  if (t === '') return { ok: false, error: 'informe o valor' }
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  if (!/^\d+(\.\d+)?$/.test(t)) return { ok: false, error: 'valor inválido' }
  return { ok: true, value: Number(t) }
}

function values(p: Portfolio, prices: Record<string, number>): Allocation {
  const value = { fixedIncome: Math.max(0, p.fixedIncome.amount || 0), BBAS3: 0, B3SA3: 0 }
  for (const h of p.holdings) {
    const price = prices[h.symbol]
    if (Number.isFinite(price) && h.quantity > 0) value[h.symbol] += h.quantity * price
  }
  return value
}

export function portfolioValue(p: Portfolio, prices: Record<string, number>): number {
  const value = values(p, prices)
  return value.fixedIncome + value.BBAS3 + value.B3SA3
}

export function allocation(p: Portfolio, prices: Record<string, number>): Allocation {
  const value = values(p, prices)
  const total = value.fixedIncome + value.BBAS3 + value.B3SA3
  if (total === 0) return { fixedIncome: 0, BBAS3: 0, B3SA3: 0 }
  return {
    fixedIncome: value.fixedIncome / total,
    BBAS3: value.BBAS3 / total,
    B3SA3: value.B3SA3 / total,
  }
}
