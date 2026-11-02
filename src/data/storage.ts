import { fromLegacy, readPositions, type Allocation, type ClassTargets, type LegacyPortfolio, type Position } from '../domain/portfolio'
import type { Point, Quote } from './prices'
import { safeImage, type NewsItem } from './news'
import { DEFAULT_ROUTINE, EVENT_KINDS, isDate, isTime, type AgendaEvent, type Routine } from '../domain/agenda'

const PORTFOLIO_KEY = 'painel:v1:portfolio'
const POSITIONS_KEY = 'painel:v1:positions'
const SETTINGS_KEY = 'painel:v1:settings'
const VERSION = 1
const TICKERS = ['BBAS3', 'B3SA3']

// targetAllocation é a meta da versão anterior; classTargets, a meta por classe.
export type Settings = { brapiToken?: string; targetAllocation?: Allocation; classTargets?: ClassTargets }

function readJson(store: Storage, key: string): unknown {
  try {
    const raw = store.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

// Carteira da versão anterior. Só é lida para a migração e nunca é apagada: uma versão velha do app em outro aparelho ainda usa.
function loadLegacy(store: Storage): LegacyPortfolio | null {
  const data = readJson(store, PORTFOLIO_KEY) as { v?: number; portfolio?: Partial<LegacyPortfolio> } | null
  if (!data || data.v !== VERSION || !data.portfolio) return null
  const holdings = (Array.isArray(data.portfolio.holdings) ? data.portfolio.holdings : []).filter(
    (h) => !!h && TICKERS.includes(h.symbol) && Number.isInteger(h.quantity) && h.quantity >= 0,
  )
  const fi = data.portfolio.fixedIncome
  const amount = fi && Number.isFinite(fi.amount) && fi.amount >= 0 ? fi.amount : 0
  return { holdings, fixedIncome: { ...fi, amount } }
}

// Sem a lista nova, migra a carteira antiga uma vez. Uma versão desconhecida da lista nunca é sobrescrita.
export function loadPositions(store: Storage = localStorage): Position[] {
  const data = readJson(store, POSITIONS_KEY) as { v?: number; positions?: unknown } | null
  if (data !== null) return data.v === VERSION ? readPositions(data.positions) : []
  const old = loadLegacy(store)
  const migrated = old ? fromLegacy(old) : []
  if (migrated.length > 0) savePositions(migrated, store)
  return migrated
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

export function savePositions(positions: Position[], store: Storage = localStorage): boolean {
  return write(store, POSITIONS_KEY, { v: VERSION, positions })
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

const THEME_KEY = 'painel:v1:theme'
export type Theme = 'dark' | 'light'

// Preferência deste aparelho: fica fora da sincronização. O padrão é o preto.
export function loadTheme(store: Storage = localStorage): Theme {
  return readJson(store, THEME_KEY) === 'light' ? 'light' : 'dark'
}

export function saveTheme(theme: Theme, store: Storage = localStorage): boolean {
  return write(store, THEME_KEY, theme)
}

const PRICES_KEY = 'painel:v1:prices'
// series: fechamentos diários por chave de preço ("b3:PETR4"); fetched: o dia da última busca de cada uma.
export type PricesCache = { series: Record<string, Point[]>; fetched: Record<string, string> }

const isPoint = (x: unknown): x is Point => !!x && typeof (x as Point).t === 'string' && Number.isFinite((x as Point).p)

// Histórico guardado só neste aparelho: cada busca junta dias novos ao que já existe, então ele só cresce.
export const loadPrices = (store: Storage = localStorage): PricesCache => readCache(store, PRICES_KEY)

function readCache(store: Storage, key: string): PricesCache {
  const d = readJson(store, key) as Partial<PricesCache> | null
  const series: PricesCache['series'] = {}
  for (const [key, points] of Object.entries(d?.series ?? {})) {
    const valid = Array.isArray(points) ? points.filter(isPoint) : []
    if (valid.length > 0) series[key] = valid
  }
  const fetched = Object.fromEntries(Object.entries(d?.fetched ?? {}).filter(([, day]) => typeof day === 'string'))
  return { series, fetched }
}

export function savePrices(cache: PricesCache, store: Storage = localStorage): boolean {
  return write(store, PRICES_KEY, cache)
}

const BENCHMARKS_KEY = 'painel:v1:benchmarks'

// Ibovespa e CDI, no mesmo formato do histórico e também só neste aparelho.
export const loadBenchmarks = (store: Storage = localStorage): PricesCache => readCache(store, BENCHMARKS_KEY)
export const saveBenchmarks = (cache: PricesCache, store: Storage = localStorage): boolean => write(store, BENCHMARKS_KEY, cache)

const EVENTS_KEY = 'painel:v1:events'
const ROUTINE_KEY = 'painel:v1:routine'

export function loadEvents(store: Storage = localStorage): AgendaEvent[] {
  const data = readJson(store, EVENTS_KEY)
  if (!Array.isArray(data)) return []
  // O tipo "estudo" saiu do app; compromissos antigos desse tipo continuam como pessoais.
  return data.map((e) => (e?.kind === 'estudo' ? { ...e, kind: 'pessoal' } : e)).filter(
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
    r.workDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  if (!valid) return { ...DEFAULT_ROUTINE, workDays: [...DEFAULT_ROUTINE.workDays] }
  return { workStart: r.workStart!, workEnd: r.workEnd!, workDays: r.workDays! }
}

export function saveRoutine(routine: Routine, store: Storage = localStorage): boolean {
  return write(store, ROUTINE_KEY, routine)
}

const TRANSLATIONS_KEY = 'painel:v1:translations'
const MAX_TRANSLATIONS = 1000

// Traduções das manchetes: só neste aparelho. Passando de 1000, saem as mais antigas (as primeiras gravadas).
export function loadTranslations(store: Storage = localStorage): Record<string, string> {
  const d = readJson(store, TRANSLATIONS_KEY)
  if (!d || typeof d !== 'object' || Array.isArray(d)) return {}
  return Object.fromEntries(Object.entries(d).filter(([, v]) => typeof v === 'string'))
}

export function saveTranslations(map: Record<string, string>, store: Storage = localStorage): boolean {
  return write(store, TRANSLATIONS_KEY, Object.fromEntries(Object.entries(map).slice(-MAX_TRANSLATIONS)))
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
  const items = d.items
    .filter(
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
        typeof i.reason === 'string' &&
        (i.lang === undefined || typeof i.lang === 'string') &&
        (i.original === undefined || typeof i.original === 'string'),
    )
    .map(({ image, ...rest }) => {
      const safe = safeImage(image)
      return safe ? { ...rest, image: safe } : rest
    })
  return { at: d.at, items }
}
