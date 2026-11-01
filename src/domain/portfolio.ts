import { isDate } from './agenda'

// Investimentos cadastrados à mão. Os que têm cotação pública guardam código e quantidade; os demais, o valor em reais.
export type PricedKind = 'acao' | 'fii' | 'etf' | 'bdr' | 'exterior' | 'cripto' | 'moeda'
export type ManualKind = 'renda-fixa' | 'fundo' | 'previdencia'
export type Kind = PricedKind | ManualKind
export type RateIndex = 'cdi' | 'ipca' | 'selic' | 'pre'

export type PricedPosition = { id: string; kind: PricedKind; symbol: string; quantity: number; name?: string }
// Taxa: % do CDI no CDI; % ao ano acima do índice no IPCA e na Selic; % ao ano no prefixado.
export type ManualPosition = {
  id: string
  kind: ManualKind
  name: string
  amount: number
  subtype?: string
  index?: RateIndex
  rate?: number
  maturity?: string
}
export type Position = PricedPosition | ManualPosition

export const KINDS: { id: Kind; label: string }[] = [
  { id: 'acao', label: 'Ação' },
  { id: 'fii', label: 'FII' },
  { id: 'etf', label: 'ETF' },
  { id: 'bdr', label: 'BDR' },
  { id: 'exterior', label: 'Exterior (EUA)' },
  { id: 'cripto', label: 'Cripto' },
  { id: 'moeda', label: 'Moeda' },
  { id: 'renda-fixa', label: 'Renda fixa' },
  { id: 'fundo', label: 'Fundo' },
  { id: 'previdencia', label: 'Previdência' },
]

export const SUBTYPES: Partial<Record<Kind, Record<string, string>>> = {
  'renda-fixa': {
    'tesouro-selic': 'Tesouro Selic',
    'tesouro-ipca': 'Tesouro IPCA+',
    'tesouro-pre': 'Tesouro Prefixado',
    cdb: 'CDB',
    lci: 'LCI',
    lca: 'LCA',
    debenture: 'Debênture',
    'cri-cra': 'CRI/CRA',
    poupanca: 'Poupança',
  },
  previdencia: { pgbl: 'PGBL', vgbl: 'VGBL' },
}

export const INDEXES: Record<RateIndex, string> = { cdi: 'CDI', ipca: 'IPCA', selic: 'Selic', pre: 'Prefixado' }

export type AssetClass = 'renda-fixa' | 'acoes' | 'fiis' | 'etfs' | 'exterior' | 'cripto' | 'moedas' | 'fundos'
export const CLASSES: { id: AssetClass; label: string }[] = [
  { id: 'renda-fixa', label: 'Renda fixa' },
  { id: 'acoes', label: 'Ações' },
  { id: 'fiis', label: 'FIIs' },
  { id: 'etfs', label: 'ETFs' },
  { id: 'exterior', label: 'Exterior' },
  { id: 'cripto', label: 'Cripto' },
  { id: 'moedas', label: 'Moedas' },
  { id: 'fundos', label: 'Fundos' },
]
const CLASS_OF: Record<Kind, AssetClass> = {
  acao: 'acoes',
  fii: 'fiis',
  etf: 'etfs',
  bdr: 'exterior',
  exterior: 'exterior',
  cripto: 'cripto',
  moeda: 'moedas',
  'renda-fixa': 'renda-fixa',
  fundo: 'fundos',
  previdencia: 'fundos',
}
export const classOf = (kind: Kind): AssetClass => CLASS_OF[kind]

const PRICED: string[] = ['acao', 'fii', 'etf', 'bdr', 'exterior', 'cripto', 'moeda']
export const isPricedKind = (k: string): k is PricedKind => PRICED.includes(k)
export const isPriced = (p: Position): p is PricedPosition => isPricedKind(p.kind)

// De onde vem o preço: B3 (ações, FIIs, ETFs e BDRs), EUA, cripto ou câmbio.
export type Market = 'b3' | 'us' | 'crypto' | 'fx'
export function marketOf(kind: PricedKind): Market {
  if (kind === 'exterior') return 'us'
  if (kind === 'cripto') return 'crypto'
  if (kind === 'moeda') return 'fx'
  return 'b3'
}
export const priceKey = (p: Pick<PricedPosition, 'kind' | 'symbol'>) => `${marketOf(p.kind)}:${p.symbol}`
// O código do ativo; a cripto aparece pelo nome (o código dela é o id da CoinGecko); o resto, pelo nome digitado.
export function labelOf(p: Position): string {
  if (!isPriced(p)) return p.name
  return p.kind === 'cripto' ? (p.name ?? p.symbol) : p.symbol
}
// Chaves de preço da carteira, sem repetir e em ordem: só mudam quando entra ou sai um ativo.
export const priceKeys = (positions: Position[]) => [...new Set(positions.filter(isPriced).map(priceKey))].sort()

export type ClassValues = Record<AssetClass, number>
export const zeroClasses = (): ClassValues => Object.fromEntries(CLASSES.map((c) => [c.id, 0])) as ClassValues

// Valor em reais. Os preços já chegam em reais, inclusive os de fora; sem preço, null.
export function positionValue(p: Position, prices: Record<string, number>): number | null {
  if (!isPriced(p)) return p.amount
  const price = prices[priceKey(p)]
  return Number.isFinite(price) ? p.quantity * price : null
}

export type Totals = { total: number; byClass: ClassValues; missing: string[] }

export function totals(positions: Position[], prices: Record<string, number>): Totals {
  const byClass = zeroClasses()
  const missing: string[] = []
  for (const p of positions) {
    const value = positionValue(p, prices)
    if (value !== null) byClass[classOf(p.kind)] += value
    else if (isPriced(p)) missing.push(priceKey(p))
  }
  return { total: Object.values(byClass).reduce((a, b) => a + b, 0), byClass, missing }
}

export type ParseResult = { ok: true; value: number } | { ok: false; error: string }

export function parseAmount(input: string): ParseResult {
  let t = input.replace(/R\$|\s/g, '')
  if (t === '') return { ok: false, error: 'informe o valor' }
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  // "1.500" é mil e quinhentos; "0.005" é decimal, porque milhar não começa com zero.
  else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  if (!/^\d+(\.\d+)?$/.test(t)) return { ok: false, error: 'valor inválido' }
  return { ok: true, value: Number(t) }
}

// Campos do formulário, como o usuário digitou.
export type Draft = {
  kind: Kind
  symbol: string
  quantity: string
  name: string
  amount: string
  subtype: string
  index: string
  rate: string
  maturity: string
}
export type DraftErrors = Partial<Record<Exclude<keyof Draft, 'kind'>, string>>
export type NewPosition = Omit<PricedPosition, 'id'> | Omit<ManualPosition, 'id'>
export type Validation = { ok: true; position: NewPosition } | { ok: false; errors: DraftErrors }

const B3_CODE = /^[A-Z0-9]{4}\d{1,2}$/
const US_CODE = /^[A-Z]{1,5}(-[A-Z])?$/
const FX_CODE = /^[A-Z]{3}$/
const CRYPTO_CODE = /^[a-z0-9-]{1,40}$/
const WHOLE: string[] = ['acao', 'fii', 'etf', 'bdr']

function symbolError(kind: PricedKind, s: string): string | null {
  if (!s) return 'informe o código'
  const market = marketOf(kind)
  if (market === 'b3') return B3_CODE.test(s) ? null : 'use o código da B3, como PETR4 ou HGLG11'
  if (market === 'us') return US_CODE.test(s) ? null : 'use o código dos EUA, como AAPL'
  if (market === 'crypto') return CRYPTO_CODE.test(s) ? null : 'use o código da cripto, como BTC'
  if (s === 'BRL') return 'o real já é a moeda da carteira'
  return FX_CODE.test(s) ? null : 'use o código da moeda, como USD ou EUR'
}

function normalizeSymbol(kind: PricedKind, raw: string): string {
  const t = raw.trim()
  if (kind === 'cripto') return t.toLowerCase()
  // O Yahoo escreve BRK-B; quem digita costuma usar BRK.B.
  return kind === 'exterior' ? t.toUpperCase().replace('.', '-') : t.toUpperCase()
}

export function validateDraft(d: Draft): Validation {
  const errors: DraftErrors = {}
  if (isPricedKind(d.kind)) {
    const symbol = normalizeSymbol(d.kind, d.symbol)
    const symbolProblem = symbolError(d.kind, symbol)
    if (symbolProblem) errors.symbol = symbolProblem
    const q = parseAmount(d.quantity)
    if (!q.ok) errors.quantity = d.quantity.trim() === '' ? 'informe a quantidade' : 'use apenas números positivos'
    else if (q.value <= 0) errors.quantity = 'informe uma quantidade maior que zero'
    else if (WHOLE.includes(d.kind) && !Number.isInteger(q.value)) errors.quantity = 'use número inteiro'
    if (!q.ok || Object.keys(errors).length > 0) return { ok: false, errors }
    return { ok: true, position: { kind: d.kind, symbol, quantity: q.value } }
  }

  const name = d.name.trim()
  if (!name) errors.name = 'informe o nome'
  else if (name.length > 60) errors.name = 'use até 60 letras'
  const a = parseAmount(d.amount)
  if (!a.ok) errors.amount = a.error
  else if (a.value <= 0) errors.amount = 'informe um valor maior que zero'
  const subtypes = SUBTYPES[d.kind]
  if (subtypes && !Object.hasOwn(subtypes, d.subtype)) errors.subtype = d.kind === 'previdencia' ? 'escolha o plano' : 'escolha o tipo de título'
  if (d.index && !Object.hasOwn(INDEXES, d.index)) errors.index = 'escolha o índice'
  const rate = d.rate.trim() === '' ? undefined : Number(d.rate.trim().replace(',', '.'))
  if (rate !== undefined && !(Number.isFinite(rate) && rate >= 0)) errors.rate = 'use uma taxa de zero ou mais'
  if (d.maturity && !isDate(d.maturity)) errors.maturity = 'data inválida'
  if (!a.ok || Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    position: {
      kind: d.kind,
      name,
      amount: a.value,
      ...(subtypes && { subtype: d.subtype }),
      ...(d.index && { index: d.index as RateIndex }),
      ...(rate !== undefined && { rate }),
      ...(d.maturity && { maturity: d.maturity }),
    },
  }
}

const text = (v: unknown, max: number) => typeof v === 'string' && v.trim() !== '' && v.length <= max
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

// O que vem do aparelho ou do banco passa pelas mesmas regras do formulário.
export function isPosition(x: unknown): x is Position {
  if (!x || typeof x !== 'object') return false
  const p = x as Record<string, unknown>
  if (typeof p.id !== 'string' || p.id === '' || typeof p.kind !== 'string') return false
  if (isPricedKind(p.kind)) {
    return (
      typeof p.symbol === 'string' &&
      symbolError(p.kind, p.symbol) === null &&
      positive(p.quantity) &&
      (!WHOLE.includes(p.kind) || Number.isInteger(p.quantity)) &&
      (p.name === undefined || text(p.name, 120))
    )
  }
  if (p.kind !== 'renda-fixa' && p.kind !== 'fundo' && p.kind !== 'previdencia') return false
  const subtypes = SUBTYPES[p.kind]
  return (
    text(p.name, 60) &&
    positive(p.amount) &&
    (p.subtype === undefined || (!!subtypes && typeof p.subtype === 'string' && Object.hasOwn(subtypes, p.subtype))) &&
    (p.index === undefined || (typeof p.index === 'string' && Object.hasOwn(INDEXES, p.index))) &&
    (p.rate === undefined || (typeof p.rate === 'number' && Number.isFinite(p.rate) && p.rate >= 0)) &&
    (p.maturity === undefined || (typeof p.maturity === 'string' && isDate(p.maturity)))
  )
}

export const readPositions = (data: unknown): Position[] => (Array.isArray(data) ? data.filter(isPosition) : [])

// Carteira da versão anterior: só BBAS3, B3SA3 e um valor de renda fixa.
export type Allocation = { fixedIncome: number; BBAS3: number; B3SA3: number }
export type LegacyPortfolio = {
  holdings: { symbol: string; quantity: number }[]
  fixedIncome: { amount: number; ratePctYear?: number; maturity?: string }
}
const LEGACY_NAMES: Record<string, string> = { BBAS3: 'Banco do Brasil', B3SA3: 'B3' }

// Ids fixos: dois aparelhos que migrarem a mesma carteira chegam às mesmas posições.
export function fromLegacy(old: LegacyPortfolio): Position[] {
  const stocks: Position[] = old.holdings
    .filter((h) => h.quantity > 0)
    .map((h) => ({
      id: `antigo-${h.symbol}`,
      kind: 'acao',
      symbol: h.symbol,
      quantity: h.quantity,
      ...(LEGACY_NAMES[h.symbol] && { name: LEGACY_NAMES[h.symbol] }),
    }))
  const { amount, ratePctYear, maturity } = old.fixedIncome
  if (!(amount > 0)) return stocks
  const hasRate = typeof ratePctYear === 'number' && Number.isFinite(ratePctYear) && ratePctYear >= 0
  return [
    ...stocks,
    {
      id: 'antigo-renda-fixa',
      kind: 'renda-fixa',
      name: 'Renda fixa',
      amount,
      ...(hasRate && { index: 'pre' as const, rate: ratePctYear }),
      ...(maturity && isDate(maturity) && { maturity }),
    },
  ]
}

// Meta de cada classe como fração da carteira; somam 1.
export type ClassTargets = ClassValues

function isTargets(x: unknown): x is ClassTargets {
  if (!x || typeof x !== 'object') return false
  const values = CLASSES.map((c) => (x as Record<string, unknown>)[c.id])
  if (!values.every((n) => typeof n === 'number' && n >= 0 && n <= 1)) return false
  return Math.abs((values as number[]).reduce((a, b) => a + b, 0) - 1) < 0.01
}

// Metas por classe; sem elas, a meta antiga vira renda fixa e ações.
export function resolveTargets(s: { classTargets?: unknown; targetAllocation?: Allocation }): ClassTargets | undefined {
  if (isTargets(s.classTargets)) return s.classTargets
  const t = s.targetAllocation
  if (!t || ![t.fixedIncome, t.BBAS3, t.B3SA3].every(Number.isFinite)) return undefined
  return { ...zeroClasses(), 'renda-fixa': t.fixedIncome, acoes: t.BBAS3 + t.B3SA3 }
}
