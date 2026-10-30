import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HomePage } from './HomePage'
import { loadAttempts, saveEvents, savePortfolio } from '../data/storage'
import type { NewsItem, NewsSource } from '../data/news'
import type { PriceProvider, Quote } from '../data/prices'

const now = () => new Date(2026, 9, 28, 9, 0) // quarta-feira

beforeEach(() => localStorage.clear())

const quote = (symbol: string, price: number, changePct: number): Quote => ({
  symbol,
  price,
  changePct,
  updatedAt: '2026-10-28T12:00:00Z',
  stale: false,
  intraday: [],
})
const prices = (quotes: Quote[]) => (): PriceProvider => ({ getQuotes: async () => quotes })
const noPrices = (): PriceProvider => ({
  getQuotes: async () => {
    throw new Error('token ausente')
  },
})
const item = (title: string, tags: string[]): NewsItem => ({
  id: title,
  title,
  link: null,
  source: 'Fonte',
  publishedAt: null,
  tags,
  tone: 'neutral',
  reason: '',
})
const feed = (items: NewsItem[]): NewsSource => ({ fetchNews: async () => items })

function renderHome(opts: { makePrices?: () => PriceProvider; news?: NewsSource } = {}) {
  return render(<HomePage makePrices={opts.makePrices ?? noPrices} news={opts.news ?? feed([])} now={now} rand={() => 0} />)
}

test('Início mostra a data, os preços e o total da carteira', async () => {
  savePortfolio({
    holdings: [
      { symbol: 'BBAS3', quantity: 100 },
      { symbol: 'B3SA3', quantity: 200 },
    ],
    fixedIncome: { amount: 10000 },
  })
  renderHome({ makePrices: prices([quote('BBAS3', 16.46, -1.97), quote('B3SA3', 14.2, -3.34)]) })
  expect(screen.getByText('Quarta-feira, 28 de outubro')).toBeInTheDocument()
  expect(await screen.findByText('R$ 16,46')).toBeInTheDocument()
  expect(screen.getByText('R$ 14,20')).toBeInTheDocument()
  expect(screen.getByText('R$ 14.486,00')).toBeInTheDocument()
})

test('Início sem preço mostra traço e o motivo, sem quebrar', async () => {
  renderHome()
  expect(await screen.findByText('Informe o token da brapi em Editar carteira para ver os preços.')).toBeInTheDocument()
  expect(screen.getAllByText('—')).toHaveLength(2)
})

test('Início mostra o feed de notícias com filtro por tema', async () => {
  const user = userEvent.setup()
  renderHome({ news: feed([item('Ibovespa cai', ['Mercado']), item('Edital de TI', ['Concursos'])]) })
  expect(await screen.findByText('Ibovespa cai')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Concursos' }))
  expect(screen.queryByText('Ibovespa cai')).toBeNull()
  expect(screen.getByText('Edital de TI')).toBeInTheDocument()
})

test('responder a questão do dia grava a tentativa e conta na meta', async () => {
  const user = userEvent.setup()
  renderHome()
  expect(screen.getByText('0 de 20')).toBeInTheDocument()
  await user.click(screen.getAllByRole('button', { name: /^[A-J]\) / })[0])
  expect(screen.getByText(/^(Correto\.|Errado\.)/)).toBeInTheDocument()
  expect(loadAttempts(localStorage)).toHaveLength(1)
  expect(screen.getByText('1 de 20')).toBeInTheDocument()
})

test('Início mostra a próxima data importante com a contagem', () => {
  saveEvents([{ id: '1', title: 'Prova PM', date: '2026-11-08', kind: 'prova' }])
  renderHome()
  expect(screen.getByText('Prova PM · faltam 11 dias')).toBeInTheDocument()
})
