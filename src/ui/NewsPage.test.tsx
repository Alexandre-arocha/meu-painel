import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewsPage } from './NewsPage'
import type { NewsItem } from '../data/news'
import { saveNews } from '../data/storage'

beforeEach(() => localStorage.clear())

const item = (title: string, tag: string, link: string | null = null): NewsItem => ({
  id: title,
  title,
  link,
  source: 'Fonte',
  publishedAt: new Date().toISOString(),
  tags: [tag],
  tone: 'neutral',
  reason: '',
})

test('filtro por tema mostra só as notícias daquele tema', async () => {
  const user = userEvent.setup()
  const news = { fetchNews: async () => [item('Ibovespa fecha em alta', 'Mercado'), item('Edital publicado', 'Concursos')] }
  render(<NewsPage news={news} />)
  expect(await screen.findByText('Ibovespa fecha em alta')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Concursos' }))
  expect(screen.getByText('Edital publicado')).toBeInTheDocument()
  expect(screen.queryByText('Ibovespa fecha em alta')).toBeNull()
  expect(screen.getByRole('button', { name: 'Concursos' })).toHaveAttribute('aria-pressed', 'true')
})

test('título da notícia abre o link em nova aba', async () => {
  const news = { fetchNews: async () => [item('Ibovespa fecha em alta', 'Mercado', 'https://exemplo.com/n')] }
  render(<NewsPage news={news} />)
  const a = await screen.findByRole('link', { name: 'Ibovespa fecha em alta' })
  expect(a).toHaveAttribute('href', 'https://exemplo.com/n')
  expect(a).toHaveAttribute('target', '_blank')
  expect(a.getAttribute('rel')).toContain('noopener')
})

test('notícia com link perigoso aparece sem link', async () => {
  const news = { fetchNews: async () => [item('Golpe', 'Mercado', 'javascript:alert(1)')] }
  render(<NewsPage news={news} />)
  expect(await screen.findByText('Golpe')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Golpe' })).toBeNull()
})

test('filtro Carteira mostra só notícias que citam BB ou B3', async () => {
  const user = userEvent.setup()
  const news = {
    fetchNews: async () => [item('Banco do Brasil anuncia dividendos', 'Mercado'), item('Edital publicado', 'Concursos')],
  }
  render(<NewsPage news={news} />)
  await screen.findByText('Edital publicado')
  await user.click(screen.getByRole('button', { name: 'Carteira' }))
  expect(screen.getByText('Banco do Brasil anuncia dividendos')).toBeInTheDocument()
  expect(screen.queryByText('Edital publicado')).toBeNull()
})

test('Atualizar busca de novo e mostra a hora', async () => {
  const user = userEvent.setup()
  let calls = 0
  const news = {
    fetchNews: async () => {
      calls++
      return [item('Ibovespa fecha em alta', 'Mercado')]
    },
  }
  render(<NewsPage news={news} />)
  expect(await screen.findByText(/Atualizado às/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Atualizar' }))
  await screen.findByText(/Atualizado às/)
  expect(calls).toBe(2)
})

test('sem conexão mostra as notícias salvas com aviso', async () => {
  saveNews({ at: '2026-10-28T12:00:00.000Z', items: [item('Notícia salva', 'Mercado')] })
  const news = {
    fetchNews: async (): Promise<NewsItem[]> => {
      throw new Error('rede')
    },
  }
  render(<NewsPage news={news} />)
  expect(await screen.findByText('Notícia salva')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent(/notícias salvas/)
})

test('falha ao buscar mostra mensagem', async () => {
  const news = {
    fetchNews: async (): Promise<NewsItem[]> => {
      throw new Error('rede')
    },
  }
  render(<NewsPage news={news} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as notícias.')
})
