import type { Allocation, Holding, Portfolio } from '../domain/portfolio'

const PORTFOLIO_KEY = 'painel:v1:portfolio'
const SETTINGS_KEY = 'painel:v1:settings'
const VERSION = 1
const TICKERS = ['BBAS3', 'B3SA3']

export type Settings = { brapiToken?: string; targetAllocation?: Allocation }

const emptyPortfolio = (): Portfolio => ({ holdings: [], fixedIncome: { amount: 0 } })

function readJson(store: Storage, key: string): unknown {
  try {
    const raw = store.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

export function loadPortfolio(store: Storage = localStorage): Portfolio {
  const data = readJson(store, PORTFOLIO_KEY) as { v?: number; portfolio?: Partial<Portfolio> } | null
  if (!data || data.v !== VERSION || !data.portfolio) return emptyPortfolio()
  const holdings = (Array.isArray(data.portfolio.holdings) ? data.portfolio.holdings : []).filter(
    (h): h is Holding =>
      !!h && TICKERS.includes(h.symbol) && Number.isInteger(h.quantity) && h.quantity >= 0,
  )
  const fi = data.portfolio.fixedIncome
  const amount = fi && Number.isFinite(fi.amount) && fi.amount >= 0 ? fi.amount : 0
  return { holdings, fixedIncome: { ...fi, amount } }
}

export function savePortfolio(p: Portfolio, store: Storage = localStorage): void {
  store.setItem(PORTFOLIO_KEY, JSON.stringify({ v: VERSION, portfolio: p }))
}

export function loadSettings(store: Storage = localStorage): Settings {
  const data = readJson(store, SETTINGS_KEY)
  return data && typeof data === 'object' ? (data as Settings) : {}
}

export function saveSettings(s: Settings, store: Storage = localStorage): void {
  store.setItem(SETTINGS_KEY, JSON.stringify(s))
}
