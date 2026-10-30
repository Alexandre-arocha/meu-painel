import { loadPortfolio, loadQuotes, loadSettings, loadTheme, savePortfolio, saveQuotes, saveSettings, saveTheme } from './storage'

test('loadTheme começa no preto e lembra o tema salvo', () => {
  localStorage.clear()
  expect(loadTheme()).toBe('dark')
  saveTheme('light')
  expect(loadTheme()).toBe('light')
  localStorage.setItem('painel:v1:theme', '"roxo"')
  expect(loadTheme()).toBe('dark')
})

test('saveQuotes e loadQuotes guardam a última cotação', () => {
  const q = [{ symbol: 'BBAS3', price: 28, changePct: 0.5, updatedAt: '2026-10-28T13:00:00Z', stale: false, intraday: [] }]
  saveQuotes(q)
  expect(loadQuotes()).toEqual(q)
})

test('loadQuotes devolve lista vazia se estiver corrompido ou ausente', () => {
  expect(loadQuotes()).toEqual([])
  localStorage.setItem('painel:v1:lastQuotes', '{{')
  expect(loadQuotes()).toEqual([])
})
import type { Portfolio } from '../domain/portfolio'

const KEY = 'painel:v1:portfolio'
const empty: Portfolio = { holdings: [], fixedIncome: { amount: 0 } }

beforeEach(() => localStorage.clear())

test('salvar e carregar devolve a mesma carteira', () => {
  const p: Portfolio = {
    holdings: [{ symbol: 'BBAS3', quantity: 100 }],
    fixedIncome: { amount: 10000, ratePctYear: 12, maturity: '2027-12-01' },
  }
  savePortfolio(p)
  expect(loadPortfolio()).toEqual(p)
})

test('JSON corrompido devolve carteira vazia', () => {
  localStorage.setItem(KEY, '{nao e json')
  expect(loadPortfolio()).toEqual(empty)
})

test('chave ausente devolve carteira vazia', () => {
  expect(loadPortfolio()).toEqual(empty)
})

test('versão diferente devolve carteira vazia', () => {
  localStorage.setItem(KEY, JSON.stringify({ v: 99, portfolio: { holdings: [], fixedIncome: { amount: 5 } } }))
  expect(loadPortfolio()).toEqual(empty)
})

test('quantidade negativa guardada à mão é descartada ao carregar', () => {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      v: 1,
      portfolio: {
        holdings: [
          { symbol: 'BBAS3', quantity: -5 },
          { symbol: 'B3SA3', quantity: 7 },
        ],
        fixedIncome: { amount: 100 },
      },
    }),
  )
  expect(loadPortfolio().holdings).toEqual([{ symbol: 'B3SA3', quantity: 7 }])
})

test('configurações: salvar e carregar o token e a divisão desejada', () => {
  saveSettings({ brapiToken: 'abc', targetAllocation: { fixedIncome: 0.5, BBAS3: 0.25, B3SA3: 0.25 } })
  expect(loadSettings()).toEqual({
    brapiToken: 'abc',
    targetAllocation: { fixedIncome: 0.5, BBAS3: 0.25, B3SA3: 0.25 },
  })
})

test('configurações corrompidas devolvem objeto vazio', () => {
  localStorage.setItem('painel:v1:settings', 'xx')
  expect(loadSettings()).toEqual({})
})
