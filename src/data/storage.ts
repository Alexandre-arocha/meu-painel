import type { Allocation, Holding, Portfolio } from '../domain/portfolio'
import type { Quote } from './prices'
import { parseQuestions, type Attempt, type Question } from '../domain/study'

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

// Navegador privado ou sem espaço pode recusar a gravação: devolve false em vez de quebrar a tela.
function write(store: Storage, key: string, data: unknown): boolean {
  try {
    store.setItem(key, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function savePortfolio(p: Portfolio, store: Storage = localStorage): boolean {
  return write(store, PORTFOLIO_KEY, { v: VERSION, portfolio: p })
}

const QUOTES_KEY = 'painel:v1:lastQuotes'

export function saveQuotes(quotes: Quote[], store: Storage = localStorage): boolean {
  return write(store, QUOTES_KEY, quotes)
}

export function loadQuotes(store: Storage = localStorage): Quote[] {
  const data = readJson(store, QUOTES_KEY)
  return Array.isArray(data) ? (data as Quote[]) : []
}

export function loadSettings(store: Storage = localStorage): Settings {
  const data = readJson(store, SETTINGS_KEY)
  return data && typeof data === 'object' ? (data as Settings) : {}
}

export function saveSettings(s: Settings, store: Storage = localStorage): boolean {
  return write(store, SETTINGS_KEY, s)
}

const ATTEMPTS_KEY = 'painel:v1:attempts'
const QUESTIONS_KEY = 'painel:v1:questions'

export function loadAttempts(store: Storage = localStorage): Attempt[] {
  const data = readJson(store, ATTEMPTS_KEY)
  if (!Array.isArray(data)) return []
  return data.filter(
    (a): a is Attempt =>
      !!a && typeof a.questionId === 'string' && typeof a.correct === 'boolean' && typeof a.at === 'string',
  )
}

export function saveAttempts(attempts: Attempt[], store: Storage = localStorage): boolean {
  return write(store, ATTEMPTS_KEY, attempts)
}

export function loadCustomQuestions(store: Storage = localStorage): Question[] {
  const data = readJson(store, QUESTIONS_KEY)
  if (!Array.isArray(data)) return []
  const r = parseQuestions(JSON.stringify(data))
  return r.ok ? r.questions : []
}

export function saveCustomQuestions(questions: Question[], store: Storage = localStorage): boolean {
  return write(store, QUESTIONS_KEY, questions)
}
