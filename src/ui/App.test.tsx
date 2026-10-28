import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

const makePrices = () => ({
  async getQuotes() {
    throw new Error('token ausente')
  },
})
const news = { fetchNews: async () => [] }

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
})

test('App abre no Início com o título', () => {
  render(<App makePrices={makePrices} news={news} />)
  expect(screen.getByText('Meu painel')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
})

test('navegar para Investimentos mostra o aviso de sinal de apoio', async () => {
  const user = userEvent.setup()
  render(<App makePrices={makePrices} news={news} />)
  await user.click(screen.getByRole('link', { name: 'Investimentos' }))
  expect(await screen.findByText(/não é previsão garantida/i)).toBeInTheDocument()
  expect(await screen.findByRole('alert')).toBeInTheDocument()
})

test('navegar para Agenda mostra o plano de hoje', async () => {
  const user = userEvent.setup()
  render(<App makePrices={makePrices} news={news} />)
  await user.click(screen.getByRole('link', { name: 'Agenda' }))
  expect(await screen.findByRole('heading', { name: 'Hoje, montado a partir da sua rotina' })).toBeInTheDocument()
})

test('navegar para Notícias mostra os filtros de tema', async () => {
  const user = userEvent.setup()
  render(<App makePrices={makePrices} news={news} generalNews={news} />)
  await user.click(screen.getByRole('link', { name: 'Notícias' }))
  expect(await screen.findByRole('button', { name: 'Concursos' })).toBeInTheDocument()
})

test('navegar para Estudos mostra a questão', async () => {
  const user = userEvent.setup()
  render(<App makePrices={makePrices} news={news} />)
  await user.click(screen.getByRole('link', { name: 'Estudos' }))
  expect(await screen.findByRole('heading', { name: 'Questão' })).toBeInTheDocument()
})
