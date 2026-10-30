import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InvestmentsPage } from './InvestmentsPage'
import { loadPortfolio, saveQuotes, saveSettings } from '../data/storage'
import type { Point, PriceProvider, Quote } from '../data/prices'
import type { NewsItem, NewsSource } from '../data/news'

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

// Pregões à meia-noite de Brasília (03:00 UTC): 30 dias a partir de 01/08, subindo 10 centavos por dia.
const daily = Array.from({ length: 30 }, (_, i): Point => ({ t: new Date(Date.UTC(2026, 7, 1 + i, 3)).toISOString(), p: 20 + i * 0.1 }))
const withHistory =
  (calls: string[] = []) =>
  (): PriceProvider => ({
    getQuotes: async (symbols) => symbols.map((s) => quote(s, { updatedAt: '2026-09-01T15:00:00.000Z' })),
    getHistory: async (symbol) => {
      calls.push(symbol)
      return daily
    },
  })

const noNews: NewsSource = { fetchNews: async () => [] }
const newsWith = (items: NewsItem[]): NewsSource => ({ fetchNews: async () => items })

const item = (title: string, tone: NewsItem['tone']): NewsItem => ({
  id: title,
  title,
  link: null,
  source: 'Fonte',
  publishedAt: new Date().toISOString(),
  tags: ['BBAS3'],
  tone,
  reason: 'palavra-chave',
})

beforeEach(() => localStorage.clear())
const withToken = () => saveSettings({ brapiToken: 'tok' })

test('mostra preço e variação de BBAS3', async () => {
  withToken()
  render(<InvestmentsPage makePrices={okPrices()} news={noNews} />)
  const region = await screen.findByRole('region', { name: 'BBAS3' })
  expect(await within(region).findByText(/30,00/)).toBeInTheDocument()
  expect(within(region).getByText('+1,50%')).toBeInTheDocument()
})

test('com preços no servidor não aparece campo de token', async () => {
  const fromServer = (): PriceProvider => ({ getQuotes: async (symbols) => symbols.map((s) => quote(s)) })
  render(<InvestmentsPage makePrices={fromServer} news={noNews} serverPrices />)
  await screen.findByRole('region', { name: 'BBAS3' })
  expect(screen.queryByLabelText('Token da brapi')).toBeNull()
})

test('mostra "dado velho" quando stale é true', async () => {
  withToken()
  render(<InvestmentsPage makePrices={okPrices({ stale: true })} news={noNews} />)
  const region = await screen.findByRole('region', { name: 'BBAS3' })
  expect(await within(region).findByText('dado velho')).toBeInTheDocument()
})

test('sem token mostra campo para informar o token', async () => {
  render(<InvestmentsPage makePrices={okPrices()} news={noNews} />)
  expect(await screen.findByLabelText('Token da brapi')).toBeInTheDocument()
  expect(screen.getByText(/Informe o token/)).toBeInTheDocument()
})

test('API fora do ar mostra o último valor guardado marcado como velho', async () => {
  withToken()
  saveQuotes([quote('BBAS3', { price: 28 })])
  const down = (): PriceProvider => ({
    async getQuotes() {
      throw new Error('erro ao buscar preços (500)')
    },
  })
  render(<InvestmentsPage makePrices={down} news={noNews} />)
  const region = await screen.findByRole('region', { name: 'BBAS3' })
  expect(await within(region).findByText(/28,00/)).toBeInTheDocument()
  expect(within(region).getByText('dado velho')).toBeInTheDocument()
  expect(await screen.findByRole('alert')).toHaveTextContent('erro ao buscar preços')
})

test('quantidade inválida mostra mensagem e não salva', async () => {
  withToken()
  const user = userEvent.setup()
  render(<InvestmentsPage makePrices={okPrices()} news={noNews} />)
  await user.type(await screen.findByLabelText('Quantidade de BBAS3'), 'abc')
  await user.click(screen.getByRole('button', { name: 'Salvar carteira' }))
  expect(await screen.findByText('use apenas números positivos')).toBeInTheDocument()
  expect(loadPortfolio(localStorage).holdings).toEqual([])
})

test('quantidades válidas são salvas', async () => {
  withToken()
  const user = userEvent.setup()
  render(<InvestmentsPage makePrices={okPrices()} news={noNews} />)
  await user.type(await screen.findByLabelText('Quantidade de BBAS3'), '10')
  await user.type(screen.getByLabelText('Renda fixa (R$)'), '10.000,50')
  await user.click(screen.getByRole('button', { name: 'Salvar carteira' }))
  expect(loadPortfolio(localStorage)).toEqual({
    holdings: [{ symbol: 'BBAS3', quantity: 10 }],
    fixedIncome: { amount: 10000.5 },
  })
})

test('carteira vazia mostra convite para informar quantidades', async () => {
  withToken()
  render(<InvestmentsPage makePrices={okPrices()} news={noNews} />)
  expect(await screen.findByText(/Informe suas quantidades/)).toBeInTheDocument()
})

test('lista de notícias mostra o tom de cada item', async () => {
  withToken()
  render(<InvestmentsPage makePrices={okPrices()} news={newsWith([item('Banco tem lucro', 'positive')])} />)
  expect(await screen.findByText('Banco tem lucro')).toBeInTheDocument()
  expect(screen.getAllByText('tom positivo').length).toBeGreaterThan(0)
})

test('mostra o aviso "Sinal de apoio, não é previsão garantida."', async () => {
  withToken()
  render(<InvestmentsPage makePrices={okPrices()} news={noNews} />)
  expect(await screen.findByText('Sinal de apoio, não é previsão garantida.')).toBeInTheDocument()
})

test('cartão do ativo mostra o último mês do histórico diário, terminando no preço de agora', async () => {
  render(<InvestmentsPage makePrices={withHistory()} news={noNews} serverPrices />)
  const region = await screen.findByRole('region', { name: 'BBAS3' })
  const chart = await within(region).findByRole('img', { name: /Preço ajustado de BBAS3 no último mês/ })
  // 22 pregões: de 10/08 até a cotação de 01/09 (R$ 30,00), que entra como o último dia.
  expect(chart).toHaveAccessibleName(/de 10\/08 a 01\/09, entre R\$\s20,90 e R\$\s30,00/)
})

test('o motor e os cartões usam a mesma busca do histórico: uma por ativo', async () => {
  const calls: string[] = []
  render(<InvestmentsPage makePrices={withHistory(calls)} news={noNews} serverPrices />)
  const region = await screen.findByRole('region', { name: 'B3SA3' })
  await within(region).findByRole('img', { name: /no último mês/ })
  expect([...calls].sort()).toEqual(['B3SA3', 'BBAS3'])
})

test('sem histórico o cartão avisa no lugar do gráfico do mês', async () => {
  withToken()
  render(<InvestmentsPage makePrices={okPrices()} news={noNews} />)
  const region = await screen.findByRole('region', { name: 'BBAS3' })
  expect(await within(region).findByText('Sem histórico para o gráfico do mês.')).toBeInTheDocument()
})
