import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewsPage } from './NewsPage'
import type { NewsItem } from '../data/news'
import { loadTranslations, saveNews } from '../data/storage'
import type { Translator } from '../data/translate'

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
  const news = { fetchNews: async () => [item('Ibovespa fecha em alta', 'Mercado'), item('Chip novo', 'Tecnologia')] }
  render(<NewsPage news={news} />)
  expect(await screen.findByText('Ibovespa fecha em alta')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Tecnologia' }))
  expect(screen.getByText('Chip novo')).toBeInTheDocument()
  expect(screen.queryByText('Ibovespa fecha em alta')).toBeNull()
  expect(screen.getByRole('button', { name: 'Tecnologia' })).toHaveAttribute('aria-pressed', 'true')
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

test('filtro Seus ativos mostra só notícias que citam BB ou B3', async () => {
  const user = userEvent.setup()
  const news = {
    fetchNews: async () => [item('Banco do Brasil anuncia dividendos', 'Mercado'), item('Chip novo', 'Tecnologia')],
  }
  render(<NewsPage news={news} />)
  await screen.findByText('Chip novo')
  await user.click(screen.getByRole('button', { name: 'Seus ativos' }))
  expect(screen.getByText('Banco do Brasil anuncia dividendos')).toBeInTheDocument()
  expect(screen.queryByText('Chip novo')).toBeNull()
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

test('notícia estrangeira aparece traduzida, com a fonte e a língua de origem', async () => {
  const translate: Translator = async (texts) => texts.map(() => 'Mercados sobem no mundo')
  const news = { fetchNews: async () => [{ ...item('Markets rally worldwide', 'Mundo'), source: 'BBC', lang: 'en' }] }
  render(<NewsPage news={news} translate={translate} />)
  expect(await screen.findByText('Mercados sobem no mundo')).toBeInTheDocument()
  expect(screen.getByText(/BBC · traduzido do inglês/)).toBeInTheDocument()
  expect(loadTranslations()).toEqual({ 'Markets rally worldwide': 'Mercados sobem no mundo' })
})

test('sem tradução, a notícia estrangeira aparece no original com a língua', async () => {
  const translate: Translator = async () => {
    throw new Error('sem chave')
  }
  const news = { fetchNews: async () => [{ ...item('Markets rally worldwide', 'Mundo'), lang: 'en' }] }
  render(<NewsPage news={news} translate={translate} />)
  expect(await screen.findByText('Markets rally worldwide')).toBeInTheDocument()
  expect(await screen.findByText(/em inglês/)).toBeInTheDocument()
})

test('notícia com foto mostra a imagem decorativa, que some se não carregar', async () => {
  const news = { fetchNews: async () => [{ ...item('Com foto', 'Mundo'), image: 'https://img.test/a.jpg' }] }
  const { container } = render(<NewsPage news={news} />)
  await screen.findByText('Com foto')
  const img = container.querySelector('img') as HTMLImageElement
  expect(img).toHaveAttribute('src', 'https://img.test/a.jpg')
  expect(img).toHaveAttribute('alt', '')
  expect(img).toHaveAttribute('loading', 'lazy')
  expect(img).toHaveAttribute('referrerpolicy', 'no-referrer')
  fireEvent.error(img)
  expect(container.querySelector('img')).toBeNull()
})

test('a página Notícias mostra cartões, 20 por vez, e Mostrar mais traz o resto', async () => {
  const user = userEvent.setup()
  const many = Array.from({ length: 25 }, (_, i) => item(`Notícia ${i}`, 'Mundo'))
  const { container } = render(<NewsPage news={{ fetchNews: async () => many }} />)
  await screen.findByText('Notícia 0')
  expect(container.querySelector('.news.cards')).not.toBeNull()
  expect(container.querySelectorAll('.news li')).toHaveLength(20)
  await user.click(screen.getByRole('button', { name: 'Mostrar mais' }))
  expect(container.querySelectorAll('.news li')).toHaveLength(25)
  expect(screen.queryByRole('button', { name: 'Mostrar mais' })).toBeNull()
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
