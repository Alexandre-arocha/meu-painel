import { render, screen } from '@testing-library/react'
import { HomePage } from './HomePage'
import { saveEvents, saveNews } from '../data/storage'
import type { NewsItem } from '../data/news'

const now = () => new Date(2026, 9, 28, 9, 0) // quarta-feira

beforeEach(() => localStorage.clear())

const item = (title: string, link: string | null): NewsItem => ({
  id: title,
  title,
  link,
  source: 'Fonte',
  publishedAt: null,
  tags: ['Mercado'],
  tone: 'neutral',
  reason: '',
})

test('Início mostra a próxima data importante com a contagem', () => {
  saveEvents([{ id: '1', title: 'Prova PM', date: '2026-11-08', kind: 'prova' }])
  render(<HomePage now={now} />)
  expect(screen.getByText('Prova PM · faltam 11 dias')).toBeInTheDocument()
})

test('Início mostra até três manchetes salvas com link', () => {
  saveNews({
    at: '2026-10-28T12:00:00.000Z',
    items: [
      item('Ibovespa sobe', 'https://exemplo.com/1'),
      item('Selic mantida', null),
      item('Edital publicado', 'https://exemplo.com/3'),
      item('Quarta notícia', null),
    ],
  })
  render(<HomePage now={now} />)
  expect(screen.getByRole('link', { name: 'Ibovespa sobe' })).toHaveAttribute('href', 'https://exemplo.com/1')
  expect(screen.getByText('Selic mantida')).toBeInTheDocument()
  expect(screen.queryByText('Quarta notícia')).toBeNull()
})

test('Início sem notícias salvas convida a abrir o feed', () => {
  render(<HomePage now={now} />)
  expect(screen.getByText(/Abra a aba Notícias/)).toBeInTheDocument()
})
