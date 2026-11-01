import {
  loadPositions,
  loadPrices,
  loadQuotes,
  loadSettings,
  loadTheme,
  savePositions,
  savePrices,
  saveQuotes,
  saveSettings,
  saveTheme,
} from './storage'
import { isSyncKey } from './syncKeys'

const LEGACY = 'painel:v1:portfolio'
const POSITIONS = 'painel:v1:positions'
const legacy = (portfolio: unknown) => localStorage.setItem(LEGACY, JSON.stringify({ v: 1, portfolio }))

beforeEach(() => localStorage.clear())

test('loadPositions migra a carteira antiga uma vez, grava a lista nova e deixa a antiga intacta', () => {
  legacy({
    holdings: [
      { symbol: 'BBAS3', quantity: 100 },
      { symbol: 'B3SA3', quantity: -5 },
    ],
    fixedIncome: { amount: 10000 },
  })
  const before = localStorage.getItem(LEGACY)
  const migrated = loadPositions()
  expect(migrated).toEqual([
    { id: 'antigo-BBAS3', kind: 'acao', symbol: 'BBAS3', quantity: 100, name: 'Banco do Brasil' },
    { id: 'antigo-renda-fixa', kind: 'renda-fixa', name: 'Renda fixa', amount: 10000 },
  ])
  expect(JSON.parse(localStorage.getItem(POSITIONS)!)).toEqual({ v: 1, positions: migrated })
  expect(localStorage.getItem(LEGACY)).toBe(before)
  // Depois da migração, a lista nova manda, mesmo vazia.
  savePositions([])
  expect(loadPositions()).toEqual([])
})

test('sem carteira, ou com a antiga corrompida, a lista começa vazia e nada é gravado', () => {
  expect(loadPositions()).toEqual([])
  localStorage.setItem(LEGACY, '{nao e json')
  expect(loadPositions()).toEqual([])
  expect(localStorage.getItem(POSITIONS)).toBeNull()
})

test('loadPositions descarta posição inválida e não migra por cima de uma versão desconhecida', () => {
  const ok = { id: 'a', kind: 'acao', symbol: 'PETR4', quantity: 1 }
  localStorage.setItem(POSITIONS, JSON.stringify({ v: 1, positions: [ok, { id: 'b', kind: 'acao', symbol: 'PETR4', quantity: -1 }] }))
  expect(loadPositions()).toEqual([ok])
  legacy({ holdings: [{ symbol: 'BBAS3', quantity: 1 }], fixedIncome: { amount: 0 } })
  localStorage.setItem(POSITIONS, JSON.stringify({ v: 2, positions: [] }))
  expect(loadPositions()).toEqual([])
  expect(JSON.parse(localStorage.getItem(POSITIONS)!).v).toBe(2)
})

test('a lista nova vai para o banco e a carteira antiga continua indo', () => {
  expect(isSyncKey(POSITIONS)).toBe(true)
  expect(isSyncKey(LEGACY)).toBe(true)
  expect(isSyncKey('painel:v1:prices')).toBe(false)
})

test('savePrices e loadPrices guardam o histórico de cada ativo e o dia da busca; o inválido sai', () => {
  expect(loadPrices()).toEqual({ series: {}, fetched: {} })
  const cache = { series: { 'b3:BBAS3': [{ t: '2026-10-28T13:00:00.000Z', p: 16.4 }] }, fetched: { 'b3:BBAS3': '2026-10-29' } }
  savePrices(cache)
  expect(loadPrices()).toEqual(cache)
  localStorage.setItem(
    'painel:v1:prices',
    JSON.stringify({
      series: { 'b3:X': [{ t: 1, p: 'a' }], 'b3:Y': [{ t: '2026-10-28T13:00:00.000Z', p: 2 }, null] },
      fetched: { 'b3:X': 5, 'b3:Y': '2026-10-29' },
    }),
  )
  expect(loadPrices()).toEqual({ series: { 'b3:Y': [{ t: '2026-10-28T13:00:00.000Z', p: 2 }] }, fetched: { 'b3:Y': '2026-10-29' } })
  localStorage.setItem('painel:v1:prices', '{{')
  expect(loadPrices()).toEqual({ series: {}, fetched: {} })
})

test('loadTheme começa no preto e lembra o tema salvo', () => {
  expect(loadTheme()).toBe('dark')
  saveTheme('light')
  expect(loadTheme()).toBe('light')
  localStorage.setItem('painel:v1:theme', '"roxo"')
  expect(loadTheme()).toBe('dark')
})

test('saveQuotes e loadQuotes guardam a última cotação', () => {
  const q = [{ symbol: 'b3:BBAS3', price: 28, changePct: 0.5, updatedAt: '2026-10-28T13:00:00Z', stale: false }]
  saveQuotes(q)
  expect(loadQuotes()).toEqual(q)
})

test('loadQuotes devolve lista vazia se estiver corrompido ou ausente', () => {
  expect(loadQuotes()).toEqual([])
  localStorage.setItem('painel:v1:lastQuotes', '{{')
  expect(loadQuotes()).toEqual([])
})

test('configurações: salvar e carregar o token, a meta antiga e as metas por classe', () => {
  const classTargets = { 'renda-fixa': 0.5, acoes: 0.5, fiis: 0, etfs: 0, exterior: 0, cripto: 0, moedas: 0, fundos: 0 }
  saveSettings({ brapiToken: 'abc', targetAllocation: { fixedIncome: 0.5, BBAS3: 0.25, B3SA3: 0.25 }, classTargets })
  expect(loadSettings()).toEqual({
    brapiToken: 'abc',
    targetAllocation: { fixedIncome: 0.5, BBAS3: 0.25, B3SA3: 0.25 },
    classTargets,
  })
})

test('configurações corrompidas devolvem objeto vazio', () => {
  localStorage.setItem('painel:v1:settings', 'xx')
  expect(loadSettings()).toEqual({})
})
