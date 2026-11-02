import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HomePage } from './HomePage'
import { loadSnapshots, saveEvents, savePositions, saveSnapshots } from '../data/storage'
import type { Chart, Markets } from '../data/markets'
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
})
const prices = (quotes: Quote[]) => (): PriceProvider => ({ getQuotes: async () => quotes })
const noPrices = (): PriceProvider => ({
  getQuotes: async () => {
    throw new Error('token ausente')
  },
})
const chart = (price: number, changePct: number): Chart => ({ currency: null, price, changePct, updatedAt: null, name: null, points: [] })
// Ibovespa, dólar, S&P 500 e Bitcoin; cada teste troca a fonte que quiser.
const markets = (over: Partial<Markets> = {}): Markets => ({
  chart: async (symbol) => (symbol === '^BVSP' ? chart(131245.6, 0.85) : chart(5870.4, -0.32)),
  crypto: async () => [quote('crypto:bitcoin', 612345, 1.2)],
  cryptoHistory: async () => [],
  findCrypto: async () => null,
  fx: async () => [quote('fx:USD', 5.44, -0.4)],
  fxHistory: async () => [],
  cdi: async () => [],
  sgsLast: async () => [],
  ...over,
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

function renderHome(opts: { makePrices?: () => PriceProvider; news?: NewsSource; markets?: Markets } = {}) {
  return render(
    <HomePage makePrices={opts.makePrices ?? noPrices} markets={opts.markets ?? markets()} news={opts.news ?? feed([])} now={now} />,
  )
}

const bbas3 = { id: 'a', kind: 'acao' as const, symbol: 'BBAS3', quantity: 100, name: 'Banco do Brasil' }
const investments = () => screen.getByRole('region', { name: 'Investimentos' })
const calendar = () => screen.getByRole('region', { name: 'Calendário' })

test('as seções vêm na ordem do celular: investimentos, calendário e notícias', () => {
  renderHome()
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Investimentos', 'Calendário', 'Notícias'])
})

test('Início mostra a data, o patrimônio com a variação do dia, a divisão por classe e os maiores ativos', async () => {
  savePositions([
    bbas3,
    { id: 'b', kind: 'acao', symbol: 'B3SA3', quantity: 200, name: 'B3' },
    { id: 'c', kind: 'renda-fixa', name: 'CDB', amount: 10000, subtype: 'cdb' },
  ])
  renderHome({ makePrices: prices([quote('BBAS3', 16.46, -1.97), quote('B3SA3', 14.2, -3.34)]) })
  expect(screen.getByText('Quarta-feira, 28 de outubro')).toBeInTheDocument()
  expect(await screen.findByText('R$ 14.486,00')).toBeInTheDocument()
  // Ontem as ações valiam 1646 / 0,9803 + 2840 / 0,9666; a renda fixa não oscila.
  expect(screen.getByText('-R$ 131,21 (-0,90%) no dia')).toBeInTheDocument()
  const classes = within(screen.getByRole('list', { name: 'Divisão por classe' }))
  expect(classes.getByText('Ações')).toBeInTheDocument()
  expect(classes.getByText('31%')).toBeInTheDocument()
  expect(classes.getByText('69%')).toBeInTheDocument()
  // O maior primeiro: 200 x R$ 14,20 = R$ 2.840,00.
  const [first, second] = within(screen.getByRole('list', { name: 'Seus ativos' })).getAllByRole('listitem')
  expect(within(first).getByText('B3SA3')).toBeInTheDocument()
  expect(within(first).getByText('R$ 2.840,00')).toBeInTheDocument()
  expect(within(second).getByText('-1,97%')).toBeInTheDocument()
})

test('as cores da barra seguem a ordem das classes que você tem, sem pular cor da paleta', async () => {
  savePositions([
    { id: 'c', kind: 'renda-fixa', name: 'CDB', amount: 10000, subtype: 'cdb' },
    { id: 'b', kind: 'cripto', symbol: 'bitcoin', quantity: 0.01, name: 'Bitcoin' },
  ])
  renderHome()
  const classes = within(await screen.findByRole('list', { name: 'Divisão por classe' }))
  // Cripto é a 6ª classe, mas é a 2ª que você tem: fica com a 2ª cor, a vizinha validada da 1ª.
  expect(classes.getByText('Renda fixa').previousElementSibling?.getAttribute('style')).toContain('var(--viz-1)')
  expect(classes.getByText('Cripto').previousElementSibling?.getAttribute('style')).toContain('var(--viz-2)')
})

test('grava o patrimônio do dia só com todos os preços e mostra a curva a partir de dois dias', async () => {
  savePositions([bbas3])
  saveSnapshots({ '2026-10-27': 1500 })
  renderHome({ makePrices: prices([quote('BBAS3', 16.46, 1)]) })
  expect(await screen.findByRole('img', { name: /Evolução do patrimônio/ })).toBeInTheDocument()
  expect(loadSnapshots()).toEqual({ '2026-10-27': 1500, '2026-10-28': 1646 })
})

test('sem os preços, não grava o dia', async () => {
  savePositions([bbas3])
  renderHome()
  await screen.findByText('Informe o token da brapi em Editar carteira para ver os preços.')
  expect(loadSnapshots()).toEqual({})
})

test('com 1 ano de histórico, compara os seus ativos com o Ibovespa e o CDI', async () => {
  savePositions([bbas3])
  const year = Array.from({ length: 250 }, (_, i) => ({ t: new Date(Date.UTC(2026, 9, 27, 15) - (249 - i) * 86_400_000 * 1.47).toISOString(), p: 10 * 1.001 ** i }))
  const m = markets({
    chart: async (symbol) => ({ ...chart(10, 0), points: symbol === '^BVSP' ? year.map((x) => ({ ...x, p: x.p / 2 })) : symbol === 'BBAS3.SA' ? year : [] }),
    cdi: async () => year.map((x) => ({ t: x.t, p: 0.04 })),
  })
  renderHome({ makePrices: prices([quote('BBAS3', 16.46, 1)]), markets: m })
  const line = await screen.findByText(/^Em 1 ano:/)
  expect(line).toHaveTextContent(/seus ativos \+\d+,\d+% · Ibovespa \+\d+,\d+% · CDI \+\d+,\d+%/)
})

test('Início sem preço mostra traço e o motivo, sem quebrar', async () => {
  savePositions([bbas3])
  renderHome()
  expect(await screen.findByText('Informe o token da brapi em Editar carteira para ver os preços.')).toBeInTheDocument()
  // O patrimônio e o valor do ativo ficam com traço; a variação do dia não aparece.
  expect(within(investments()).getAllByText('—')).toHaveLength(2)
  expect(screen.queryByText(/no dia/)).toBeNull()
})

test('Início sem investimentos convida a cadastrar', () => {
  renderHome()
  expect(screen.getByRole('link', { name: 'Cadastrar investimentos' })).toHaveAttribute('href', '#/investimentos')
  expect(screen.queryByText('Patrimônio')).toBeNull()
})

test('a faixa de mercados mostra os quatro números e o traço só na fonte que falhou', async () => {
  renderHome({
    markets: markets({
      chart: async (symbol) => {
        if (symbol === '^BVSP') throw new Error('Yahoo fora do ar')
        return chart(5870.4, -0.32)
      },
    }),
  })
  const strip = screen.getByRole('list', { name: 'Mercados hoje' })
  const tile = (label: string) => within(within(strip).getByText(label).closest('li')!)
  expect(await tile('Ibovespa').findByText('—')).toBeInTheDocument()
  expect(tile('S&P 500').getByText('5.870')).toBeInTheDocument()
  expect(tile('S&P 500').getByText('-0,32%')).toBeInTheDocument()
  expect(tile('Dólar').getByText('R$ 5,44')).toBeInTheDocument()
  expect(tile('Bitcoin').getByText('R$ 612 mil')).toBeInTheDocument()
})

test('Início mostra o feed de notícias com filtro por tema', async () => {
  const user = userEvent.setup()
  renderHome({ news: feed([item('Ibovespa cai', ['Mercado']), item('Chip novo', ['Tecnologia'])]) })
  expect(await screen.findByText('Ibovespa cai')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Tecnologia' }))
  expect(screen.queryByText('Ibovespa cai')).toBeNull()
  expect(screen.getByText('Chip novo')).toBeInTheDocument()
})

test('a primeira notícia com foto vira a manchete do Início', async () => {
  renderHome({ news: feed([item('Sem foto', ['Mercado']), { ...item('Com foto', ['Mundo']), image: 'https://img.test/a.jpg' }]) })
  const lead = (await screen.findByText('Com foto')).closest('li')!
  expect(lead.parentElement!.firstElementChild).toBe(lead)
})

test('o Início não tem mais questão nem meta de estudo', () => {
  renderHome()
  expect(screen.queryByText('Questão do dia')).toBeNull()
  expect(screen.queryByText('Estudo hoje')).toBeNull()
})

test('Início mostra as próximas datas com a contagem', () => {
  saveEvents([{ id: '1', title: 'Prova PM', date: '2026-11-08', kind: 'prova' }])
  renderHome()
  expect(within(calendar()).getByText('Prova PM')).toBeInTheDocument()
  expect(within(calendar()).getByText('faltam 11 dias')).toBeInTheDocument()
})

test('o vencimento de um título aparece nas próximas datas e no dia dele', async () => {
  const user = userEvent.setup()
  savePositions([{ id: 'r', kind: 'renda-fixa', name: 'CDB Inter', amount: 5000, subtype: 'cdb', maturity: '2026-10-30' }])
  renderHome()
  expect(within(calendar()).getByText('faltam 2 dias')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^30 de outubro, 1 compromisso/ }))
  expect(within(calendar()).getByRole('heading', { name: 'Sexta-feira, 30 de outubro' })).toBeInTheDocument()
  // Uma vez no dia escolhido e outra nas próximas datas.
  expect(within(calendar()).getAllByText('Vence: CDB Inter')).toHaveLength(2)
})
