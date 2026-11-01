import type { ComponentProps } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuantEngine } from './QuantEngine'
import type { NewsItem } from '../data/news'
import type { Point } from '../data/prices'
import { zeroClasses, type Position } from '../domain/portfolio'

// Pregões à meia-noite de Brasília (03:00 UTC), como a brapi manda.
const days = (values: number[]): Point[] => values.map((p, i) => ({ t: new Date(Date.UTC(2026, 7, 1 + i, 3)).toISOString(), p }))
// BBAS3 cai nos primeiros 20 pregões e sobe 1% ao dia nos 20 seguintes; B3SA3 só oscila.
const bbas3 = days(Array.from({ length: 40 }, (_, i) => (i < 20 ? 20 - i * 0.2 : 16 * 1.01 ** (i - 20))))
const b3sa3 = days(Array.from({ length: 40 }, (_, i) => 14 + (i % 2 === 0 ? 0.2 : -0.2)))
const bitcoin = days(Array.from({ length: 40 }, (_, i) => 400000 + i * 1000))
const ready = (series: Record<string, Point[]>) => ({ series, error: null, loading: false })
const series = { 'b3:BBAS3': bbas3, 'b3:B3SA3': b3sa3 }

const carteira: Position[] = [
  { id: '1', kind: 'acao', symbol: 'BBAS3', quantity: 100, name: 'Banco do Brasil' },
  { id: '2', kind: 'acao', symbol: 'B3SA3', quantity: 200, name: 'B3' },
  { id: '3', kind: 'renda-fixa', name: 'CDB', amount: 10000, subtype: 'cdb' },
]
const meta = { ...zeroClasses(), 'renda-fixa': 0.6, acoes: 0.4 }

function renderEngine(over: Partial<ComponentProps<typeof QuantEngine>> = {}) {
  return render(
    <div>
      <QuantEngine history={ready(series)} positions={carteira} quotes={[]} {...over} />
    </div>,
  )
}

test('mostra o gráfico e os indicadores do ativo a partir do histórico', async () => {
  renderEngine()
  const engine = screen.getByRole('region', { name: 'Motor quantitativo' })
  expect(await within(engine).findByRole('img', { name: /Preço ajustado de BBAS3/ })).toBeInTheDocument()
  const tiles = within(engine).getByRole('group', { name: 'Indicadores' })
  expect(within(tiles).getByText('RSI 14 dias')).toBeInTheDocument()
  expect(within(tiles).getByText('Volatilidade ao ano')).toBeInTheDocument()
  expect(within(tiles).getByText('Maior queda')).toBeInTheDocument()
  expect(within(tiles).getByText('Acima')).toBeInTheDocument()
  expect(within(engine).getByText('Como ler os números')).toBeInTheDocument()
})

test('os botões listam todos os ativos com cotação, inclusive cripto', async () => {
  const user = userEvent.setup()
  const comCripto: Position[] = [...carteira, { id: '4', kind: 'cripto', symbol: 'bitcoin', quantity: 0.1, name: 'Bitcoin' }]
  renderEngine({ positions: comCripto, history: ready({ ...series, 'crypto:bitcoin': bitcoin }) })
  const chips = screen.getByRole('group', { name: 'Ativo' })
  expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['BBAS3', 'B3SA3', 'Bitcoin'])
  await user.click(within(chips).getByRole('button', { name: 'B3SA3' }))
  expect(screen.getByRole('img', { name: /Preço ajustado de B3SA3/ })).toBeInTheDocument()
  await user.click(within(chips).getByRole('button', { name: 'Bitcoin' }))
  expect(screen.getByRole('img', { name: /Preço ajustado de Bitcoin/ })).toBeInTheDocument()
})

test('sem ativo com cotação, o motor pede para cadastrar um', () => {
  renderEngine({ positions: [carteira[2]] })
  expect(screen.getByText(/Cadastre um investimento com cotação/)).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Ativo' })).toBeNull()
})

test('teste de estratégia mostra o resultado contra comprar e segurar', async () => {
  renderEngine()
  const bt = screen.getByRole('region', { name: 'Teste de estratégia' })
  expect(await within(bt).findByText('Estratégia')).toBeInTheDocument()
  expect(within(bt).getByText('Comprar e segurar')).toBeInTheDocument()
  expect(within(bt).getByText('Trocas de posição')).toBeInTheDocument()
  expect(within(bt).getByText(/Não é recomendação/)).toBeInTheDocument()
})

test('risco da carteira aparece com a carteira e pede a carteira quando ela está vazia', async () => {
  const { unmount } = renderEngine({ positions: [] })
  expect(await screen.findByText('Cadastre seus investimentos para ver o risco.')).toBeInTheDocument()
  unmount()
  renderEngine()
  const risk = screen.getByRole('region', { name: 'Risco da carteira' })
  // A correlação é entre os dois maiores ativos: B3SA3 (cerca de R$ 2.760) e BBAS3 (cerca de R$ 1.930).
  expect(await within(risk).findByText('Correlação B3SA3 e BBAS3')).toBeInTheDocument()
  expect(within(risk).getByText('Queda possível num dia ruim (1 em 20)')).toBeInTheDocument()
})

test('simulador divide o aporte pela meta de cada classe e mostra erro em valor inválido', async () => {
  const user = userEvent.setup()
  renderEngine({ targets: meta })
  const sim = screen.getByRole('region', { name: 'Simulador de aportes' })
  // A renda fixa já passou da meta: os R$ 1.000 vão todos para ações.
  expect(within(sim).getByText('Ações').nextSibling).toHaveTextContent(/R\$\s1\.000,00/)
  expect(within(sim).getByText('Renda fixa').nextSibling).toHaveTextContent(/R\$\s0,00/)
  const input = within(sim).getByLabelText('Quanto vai aportar (R$)')
  await user.clear(input)
  await user.type(input, 'abc')
  expect(within(sim).getByText('Informe um aporte maior que zero.')).toBeInTheDocument()
  expect(within(sim).queryByText('Ações')).toBeNull()
})

test('simulador sem meta pede para definir as metas', () => {
  renderEngine()
  expect(screen.getByText('Defina as metas por classe abaixo para dividir o aporte.')).toBeInTheDocument()
})

test('enquanto o histórico carrega, avisa que está buscando', () => {
  renderEngine({ history: { series: {}, error: null, loading: true } })
  expect(screen.getByText('Buscando o histórico…')).toBeInTheDocument()
})

test('histórico curto mostra aviso em vez de números', () => {
  renderEngine({ history: ready({ 'b3:BBAS3': days([10, 11, 12]), 'b3:B3SA3': days([10, 11, 12]) }) })
  expect(screen.getAllByText(/Histórico curto demais/).length).toBeGreaterThan(0)
  expect(screen.queryByText('RSI 14 dias')).toBeNull()
})

test('sem histórico disponível mostra o motivo', () => {
  renderEngine({ history: { series: {}, error: 'Histórico indisponível.', loading: false } })
  expect(screen.getByText('Histórico indisponível.')).toBeInTheDocument()
})

test('a cotação ao vivo entra como o último dia do gráfico e dos números', async () => {
  const quotes = [{ symbol: 'b3:BBAS3', price: 25, changePct: 0, updatedAt: '2026-09-10T15:00:00.000Z', stale: false }]
  renderEngine({ quotes })
  const engine = screen.getByRole('region', { name: 'Motor quantitativo' })
  await within(engine).findByRole('img', { name: /Preço ajustado de BBAS3/ })
  expect(within(engine).getByText('01/08')).toBeInTheDocument()
  expect(within(engine).getByText('10/09')).toBeInTheDocument()
  // O quadro Preço e o topo da escala do gráfico.
  expect(within(engine).getAllByText('R$ 25,00')).toHaveLength(2)
})

test('o sinal das notícias do ativo aparece no motor', () => {
  const now = new Date('2026-09-09T15:00:00Z')
  const news: NewsItem[] = [
    { id: 'n1', title: 'BB tem lucro recorde', link: null, source: 'g1', publishedAt: '2026-09-09T13:00:00Z', tags: ['b3:BBAS3'], tone: 'positive', reason: 'lucro' },
  ]
  renderEngine({ news, now })
  const engine = screen.getByRole('region', { name: 'Motor quantitativo' })
  expect(within(engine).getByText(/Sinal das notícias/)).toHaveTextContent('mais positivo')
})
