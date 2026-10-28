import type { Allocation, Holding, Portfolio } from '../domain/portfolio'
import type { Quote } from './prices'
import type { NewsItem } from './news'
import { parseQuestions, type Attempt, type Question } from '../domain/study'
import { DEFAULT_ROUTINE, EVENT_KINDS, isDate, isTime, type AgendaEvent, type Routine } from '../domain/agenda'

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

let writeListener: ((key: string) => void) | null = null

// A sincronização (app publicado) escuta cada gravação para enviá-la ao banco.
export function setWriteListener(fn: ((key: string) => void) | null): void {
  writeListener = fn
}

// Navegador privado ou sem espaço pode recusar a gravação: devolve false em vez de quebrar a tela.
function write(store: Storage, key: string, data: unknown): boolean {
  try {
    store.setItem(key, JSON.stringify(data))
    writeListener?.(key)
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

const EVENTS_KEY = 'painel:v1:events'
const ROUTINE_KEY = 'painel:v1:routine'

export function loadEvents(store: Storage = localStorage): AgendaEvent[] {
  const data = readJson(store, EVENTS_KEY)
  if (!Array.isArray(data)) return []
  return data.filter(
    (e): e is AgendaEvent =>
      !!e &&
      typeof e.id === 'string' &&
      typeof e.title === 'string' &&
      e.title.trim() !== '' &&
      typeof e.date === 'string' &&
      isDate(e.date) &&
      (e.time === undefined || (typeof e.time === 'string' && isTime(e.time))) &&
      (e.durationMin === undefined || (Number.isInteger(e.durationMin) && e.durationMin >= 5 && e.durationMin <= 720)) &&
      (e.weekdays === undefined ||
        (Array.isArray(e.weekdays) &&
          e.weekdays.length > 0 &&
          e.weekdays.every((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))) &&
      EVENT_KINDS.includes(e.kind),
  )
}

export function saveEvents(events: AgendaEvent[], store: Storage = localStorage): boolean {
  return write(store, EVENTS_KEY, events)
}

export function loadRoutine(store: Storage = localStorage): Routine {
  const r = readJson(store, ROUTINE_KEY) as Partial<Routine> | null
  const valid =
    !!r &&
    typeof r.workStart === 'string' &&
    isTime(r.workStart) &&
    typeof r.workEnd === 'string' &&
    isTime(r.workEnd) &&
    Array.isArray(r.workDays) &&
    r.workDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    Number.isInteger(r.studyMinutes) &&
    (r.studyMinutes as number) >= 0 &&
    (r.studyMinutes as number) <= 600
  if (!valid) return { ...DEFAULT_ROUTINE, workDays: [...DEFAULT_ROUTINE.workDays] }
  return { workStart: r.workStart!, workEnd: r.workEnd!, workDays: r.workDays!, studyMinutes: r.studyMinutes! }
}

export function saveRoutine(routine: Routine, store: Storage = localStorage): boolean {
  return write(store, ROUTINE_KEY, routine)
}

const NEWS_KEY = 'painel:v1:lastNews'
const MAX_NEWS = 50
const TONES = ['positive', 'neutral', 'negative']

export type NewsCache = { at: string; items: NewsItem[] }

export function saveNews(cache: NewsCache, store: Storage = localStorage): boolean {
  return write(store, NEWS_KEY, { at: cache.at, items: cache.items.slice(0, MAX_NEWS) })
}

export function loadNews(store: Storage = localStorage): NewsCache | null {
  const d = readJson(store, NEWS_KEY) as Partial<NewsCache> | null
  if (!d || typeof d.at !== 'string' || !Array.isArray(d.items)) return null
  const items = d.items.filter(
    (i): i is NewsItem =>
      !!i &&
      typeof i.id === 'string' &&
      typeof i.title === 'string' &&
      i.title.trim() !== '' &&
      (i.link === null || typeof i.link === 'string') &&
      typeof i.source === 'string' &&
      (i.publishedAt === null || typeof i.publishedAt === 'string') &&
      Array.isArray(i.tags) &&
      i.tags.every((t) => typeof t === 'string') &&
      TONES.includes(i.tone) &&
      typeof i.reason === 'string',
  )
  return { at: d.at, items }
}
