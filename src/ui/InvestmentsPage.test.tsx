import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { InvestmentsPage } from './InvestmentsPage'
import type { Markets } from '../data/markets'
import type { NewsSource } from '../data/news'
import type { Point, PriceProvider, Quote } from '../data/prices'
import { loadPositions, loadSettings, savePositions, saveQuotes, saveSettings } from '../data/storage'
import type { Position } from '../domain/portfolio'

const quote = (symbol: string, over: Partial<Quote> = {}): Quote => ({
  symbol,
  price: 30,
  changePct: 1.5,
  updatedAt: new Date().toISOString(),
  stale: false,
  ...over,
})

const okPrices =
  (over: Partial<Quote> = {}) =>
  (token?: string): PriceProvider => ({
    async getQuotes(symbols) {
      if (!token) throw new Error('token ausente')
      return symbols.map((s) => quote(s, over))
    },
  })

// Pregões de agosto às 10:00 de Brasília, subindo 10 centavos por dia.
const daily = Array.from({ length: 30 }, (_, i): Point => ({ t: new Date(Date.UTC(2026, 7, 1 + i, 13)).toISOString(), p: 20 + i * 0.1 }))
function markets(calls: string[] = []): Markets {
  return {
    chart: async (symbol, range) => {
      calls.push(`${symbol} ${range}`)
      return { currency: 'BRL', price: 22.9, changePct: 0.4, updatedAt: null, name: 'Petróleo Brasileiro S.A. - Petrobras', points: daily }
    },
    crypto: async () => [],
    cryptoHistory: async () => [],
    findCrypto: async () => null,
    fx: async () => [],
    fxHistory: async () => [],
    cdi: async () => [],
    sgsLast: async () => [],
  }
}

const noNews: NewsSource = { fetchNews: async () => [] }
const bbas3: Position = { id: 'a', kind: 'acao', symbol: 'BBAS3', quantity: 100, name: 'Banco do Brasil' }
const withToken = () => saveSettings({ brapiToken: 'tok' })
const renderPage = (over: Partial<ComponentProps<typeof InvestmentsPage>> = {}) =>
  render(<InvestmentsPage makePrices={okPrices()} markets={markets()} news={noNews} {...over} />)

beforeEach(() => localStorage.clear())

test('a carteira antiga migra e aparece com o preço e a variação do dia', async () => {
  withToken()
  localStorage.setItem('painel:v1:portfolio', JSON.stringify({ v: 1, portfolio: { holdings: [{ symbol: 'BBAS3', quantity: 100 }], fixedIncome: { amount: 10000 } } }))
  renderPage()
  const stocks = await screen.findByRole('list', { name: 'Ações' })
  expect(within(stocks).getByText('BBAS3')).toBeInTheDocument()
  expect(await within(stocks).findByText(/R\$\s3\.000,00/)).toBeInTheDocument()
  expect(within(stocks).getByText('+1,50%')).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Renda fixa' })).getByText(/R\$\s10\.000,00/)).toBeInTheDocument()
})

test('com preços no servidor não aparece campo de token', async () => {
  savePositions([bbas3])
  const fromServer = (): PriceProvider => ({ getQuotes: async (symbols) => symbols.map((s) => quote(s)) })
  renderPage({ makePrices: fromServer, serverPrices: true })
  await screen.findByText('+1,50%')
  expect(screen.queryByLabelText('Token da brapi')).toBeNull()
})

test('cotação velha aparece como "dado velho"', async () => {
  withToken()
  savePositions([bbas3])
  renderPage({ makePrices: okPrices({ stale: true }) })
  expect(await screen.findByText('dado velho')).toBeInTheDocument()
})

test('sem token avisa para informar o token da brapi', async () => {
  savePositions([bbas3])
  renderPage()
  expect(await screen.findByRole('alert')).toHaveTextContent('Informe o token da brapi para ver os preços da B3.')
  expect(screen.getByLabelText('Token da brapi')).toBeInTheDocument()
})

test('API fora do ar mostra o último valor guardado marcado como velho', async () => {
  withToken()
  savePositions([bbas3])
  saveQuotes([quote('b3:BBAS3', { price: 28 })])
  const down = (): PriceProvider => ({
    async getQuotes() {
      throw new Error('erro ao buscar preços (500)')
    },
  })
  renderPage({ makePrices: down })
  const stocks = await screen.findByRole('list', { name: 'Ações' })
  expect(await within(stocks).findByText(/R\$\s2\.800,00/)).toBeInTheDocument()
  expect(within(stocks).getByText('dado velho')).toBeInTheDocument()
  expect(await screen.findByRole('alert')).toHaveTextContent('erro ao buscar preços')
})

test('adicionar um investimento confere o código e grava a lista nova', async () => {
  withToken()
  const calls: string[] = []
  const user = userEvent.setup()
  renderPage({ markets: markets(calls) })
  const card = screen.getByRole('region', { name: 'Seus investimentos' })
  await user.type(within(card).getByLabelText('Código'), 'PETR4')
  await user.type(within(card).getByLabelText('Quantidade'), '10')
  await user.click(within(card).getByRole('button', { name: 'Adicionar' }))
  expect(await within(card).findByText('Petróleo Brasileiro · 10 ações')).toBeInTheDocument()
  expect(loadPositions()).toEqual([{ id: expect.any(String), kind: 'acao', symbol: 'PETR4', quantity: 10, name: 'Petróleo Brasileiro' }])
  expect(calls).toContain('PETR4.SA 5d')
})

test('metas por classe: soma errada mostra o erro; soma certa grava', async () => {
  withToken()
  const user = userEvent.setup()
  renderPage()
  const card = screen.getByRole('region', { name: 'Divisão da carteira' })
  await user.click(within(card).getByText('Metas por classe'))
  await user.type(within(card).getByLabelText('Meta Renda fixa (%)'), '60')
  await user.type(within(card).getByLabelText('Meta Ações (%)'), '30')
  await user.click(within(card).getByRole('button', { name: 'Salvar metas' }))
  expect(within(card).getByText('as metas devem somar 100% (agora somam 90%)')).toBeInTheDocument()
  await user.clear(within(card).getByLabelText('Meta Ações (%)'))
  await user.type(within(card).getByLabelText('Meta Ações (%)'), '40')
  await user.click(within(card).getByRole('button', { name: 'Salvar metas' }))
  expect(loadSettings().classTargets).toEqual({ 'renda-fixa': 0.6, acoes: 0.4, fiis: 0, etfs: 0, exterior: 0, cripto: 0, moedas: 0, fundos: 0 })
})

test('o motor usa uma busca só do histórico de 5 anos por ativo', async () => {
  withToken()
  savePositions([bbas3])
  const calls: string[] = []
  renderPage({ markets: markets(calls) })
  expect(await screen.findByRole('img', { name: /Preço ajustado de BBAS3/ })).toBeInTheDocument()
  // O Ibovespa entra uma vez, como régua do motor.
  expect(calls.filter((c) => c.endsWith('5y')).sort()).toEqual(['BBAS3.SA 5y', '^BVSP 5y'])
})

test('mostra o aviso "Sinal de apoio, não é previsão garantida."', () => {
  renderPage()
  expect(screen.getByText('Sinal de apoio, não é previsão garantida.')).toBeInTheDocument()
})
