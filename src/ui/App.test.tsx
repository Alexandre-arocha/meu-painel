import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { loadTheme, setWriteListener } from '../data/storage'

const makePrices = () => ({
  async getQuotes() {
    throw new Error('token ausente')
  },
})
const news = { fetchNews: async () => [] }

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
  setWriteListener(null)
})

function authApi(loggedIn: boolean) {
  const calls: string[] = []
  const fetchFn = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    if (url === '/api/session') return new Response(null, { status: loggedIn ? 204 : 401 })
    if (url === '/api/login') loggedIn = true
    if (url === '/api/logout') loggedIn = false
    if (url === '/api/data' && method === 'GET') return new Response(JSON.stringify({ items: {} }), { status: 200 })
    return new Response(null, { status: 204 })
  }) as unknown as typeof fetch
  return { fetchFn, calls }
}

test('App com auth e sem sessão mostra a entrada', async () => {
  render(<App auth fetchFn={authApi(false).fetchFn} makePrices={makePrices} news={news} generalNews={news} />)
  expect(await screen.findByLabelText('Senha')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Início' })).toBeNull()
})

test('entrar sincroniza e mostra o Início', async () => {
  const user = userEvent.setup()
  const api = authApi(false)
  render(<App auth fetchFn={api.fetchFn} makePrices={makePrices} news={news} generalNews={news} />)
  await user.type(await screen.findByLabelText('Senha'), 'qualquer')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  expect(await screen.findByRole('link', { name: 'Início' })).toBeInTheDocument()
  expect(api.calls).toContain('GET /api/data')
})

test('Sair volta para a entrada', async () => {
  const user = userEvent.setup()
  render(<App auth fetchFn={authApi(true).fetchFn} makePrices={makePrices} news={news} generalNews={news} />)
  await user.click(await screen.findByRole('button', { name: 'Sair' }))
  expect(await screen.findByLabelText('Senha')).toBeInTheDocument()
})

test('App abre no Início com o título', () => {
  render(<App makePrices={makePrices} news={news} generalNews={news} />)
  expect(screen.getByText('Meu painel')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
})

test('botão de tema troca o preto pelo branco e lembra a escolha', async () => {
  const user = userEvent.setup()
  render(<App makePrices={makePrices} news={news} generalNews={news} />)
  expect(document.documentElement.dataset.theme).toBe('dark')
  await user.click(screen.getByRole('button', { name: 'Mudar para o tema claro' }))
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(loadTheme()).toBe('light')
  expect(screen.getByRole('button', { name: 'Mudar para o tema escuro' })).toBeInTheDocument()
})

test('navegar para Investimentos mostra o aviso de sinal de apoio', async () => {
  const user = userEvent.setup()
  render(<App makePrices={makePrices} news={news} generalNews={news} />)
  await user.click(screen.getByRole('link', { name: 'Investimentos' }))
  expect(await screen.findByText(/não é previsão garantida/i)).toBeInTheDocument()
  expect(await screen.findByRole('alert')).toBeInTheDocument()
})

test('navegar para Agenda mostra o plano de hoje', async () => {
  const user = userEvent.setup()
  render(<App makePrices={makePrices} news={news} generalNews={news} />)
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
  render(<App makePrices={makePrices} news={news} generalNews={news} />)
  await user.click(screen.getByRole('link', { name: 'Estudos' }))
  expect(await screen.findByRole('heading', { name: 'Questão' })).toBeInTheDocument()
})
