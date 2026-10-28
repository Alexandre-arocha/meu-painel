import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewsPage } from './NewsPage'
import type { NewsItem } from '../data/news'

const item = (title: string, tag: string): NewsItem => ({
  id: title,
  title,
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

test('falha ao buscar mostra mensagem', async () => {
  const news = {
    fetchNews: async (): Promise<NewsItem[]> => {
      throw new Error('rede')
    },
  }
  render(<NewsPage news={news} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as notícias.')
})
