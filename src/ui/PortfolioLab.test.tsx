import type { ComponentProps } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Point } from '../data/prices'
import type { Position } from '../domain/portfolio'
import { PortfolioLab } from './PortfolioLab'

// 300 pregões seguidos, terminando em 30/10/2026; os dois ativos oscilam em ciclos diferentes e sobem devagar.
const walk = (start: number, drift: number, cycle: number, swing: number): Point[] =>
  Array.from({ length: 300 }, (_, i) => ({
    t: new Date(Date.UTC(2026, 9, 30, 15) - (299 - i) * 86_400_000 * 1.45).toISOString(),
    p: start * (1 + drift) ** i * (1 + swing * Math.sin(i / cycle)),
  }))
const series = { 'b3:BBAS3': walk(20, 0.0005, 2, 0.02), 'b3:B3SA3': walk(14, 0.0003, 5, 0.01) }
const ready = (s: Record<string, Point[]>) => ({ series: s, error: null, loading: false })
const quote = (symbol: string, price: number) => ({ symbol, price, changePct: 0, updatedAt: '2026-10-30T15:00:00.000Z', stale: false })
const quotes = [quote('b3:BBAS3', 20), quote('b3:B3SA3', 15)]
const carteira: Position[] = [
  { id: '1', kind: 'acao', symbol: 'BBAS3', quantity: 100, name: 'Banco do Brasil' },
  { id: '2', kind: 'acao', symbol: 'B3SA3', quantity: 200, name: 'B3' },
  { id: '3', kind: 'renda-fixa', name: 'CDB', amount: 10000, subtype: 'cdb', index: 'cdi', rate: 100 },
]
const benchmarks = {
  ibov: [],
  cdi: walk(1, 0, 1, 0).map((x) => ({ t: x.t, p: 0.05 })),
  selic: [{ t: '2026-10-30T12:00:00.000Z', p: 13 }],
  ipca: [{ t: '2026-10-01T12:00:00.000Z', p: 0.4 }],
}

function renderLab(over: Partial<ComponentProps<typeof PortfolioLab>> = {}) {
  return render(
    <div>
      <PortfolioLab history={ready(series)} benchmarks={benchmarks} positions={carteira} quotes={quotes} snapshots={{}} {...over} />
    </div>,
  )
}

test('risco mostra volatilidade, VaR, CVaR, maior queda, a parte de cada ativo e o mapa de correlação', () => {
  renderLab()
  const risk = within(screen.getByRole('region', { name: 'Risco da carteira' }))
  expect(risk.getByText('Valor da carteira').nextSibling).toHaveTextContent('R$ 15.000,00')
  for (const label of ['Volatilidade ao ano', 'Queda possível num dia ruim (1 em 20)', 'Média dos 5% piores dias', 'Maior queda da carteira de hoje']) {
    expect(risk.getByText(label)).toBeInTheDocument()
  }
  expect(risk.getByText('Parte de BBAS3 no risco')).toBeInTheDocument()
  const map = within(risk.getByRole('table', { name: 'Correlação entre os ativos' }))
  // A diagonal vale 1 e está em laranja; o número está na célula, então a cor não é a única informação.
  const cells = map.getAllByText('1,00')
  expect(cells).toHaveLength(2)
  expect(cells[0].getAttribute('style')).toContain('var(--viz-2)')
})

test('risco pede a carteira quando ela está vazia e espera os preços', () => {
  const { unmount } = renderLab({ positions: [] })
  expect(screen.getByText('Cadastre seus investimentos para ver o risco.')).toBeInTheDocument()
  unmount()
  renderLab({ quotes: [], history: ready({}) })
  expect(screen.getAllByText('Os cálculos aparecem quando o histórico carregar.').length).toBeGreaterThan(0)
})

test('menor risco compara os pesos de hoje com os do sorteio e marca a sua carteira na nuvem', () => {
  renderLab()
  const card = within(screen.getByRole('region', { name: 'Carteira de menor risco' }))
  const table = within(card.getByRole('table', { name: 'Pesos de cada carteira' }))
  expect(table.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Ativo', 'Hoje', 'Menor risco', 'Melhor retorno por risco'])
  // Hoje: R$ 2.000 em BBAS3 e R$ 3.000 em B3SA3.
  const row = within(table.getByRole('rowheader', { name: 'BBAS3' }).closest('tr')!)
  expect(row.getAllByRole('cell')[0]).toHaveTextContent('40%')
  expect(table.getByRole('rowheader', { name: 'Risco ao ano' })).toBeInTheDocument()
  expect(table.getByRole('rowheader', { name: 'Retorno ao ano' })).toBeInTheDocument()
  expect(card.getByRole('img', { name: /Risco e retorno de 400 carteiras sorteadas/ })).toBeInTheDocument()
  expect(card.getByText(/estudo do passado/)).toBeInTheDocument()
})

test('com um ativo só, o menor risco explica que precisa de dois', () => {
  renderLab({ positions: [carteira[0], carteira[2]] })
  expect(screen.getByText('A comparação de pesos precisa de pelo menos dois ativos com cotação.')).toBeInTheDocument()
})

test('projeção mostra os cenários de 1, 5 e 10 anos, diz as taxas usadas e reage ao aporte', async () => {
  const user = userEvent.setup()
  renderLab()
  const card = within(screen.getByRole('region', { name: 'Projeção com aportes' }))
  const table = within(card.getByRole('table', { name: 'Cenários da projeção' }))
  expect(table.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Em', 'Ruim', 'Médio', 'Bom'])
  expect(table.getAllByRole('rowheader').map((c) => c.textContent)).toEqual(['1 ano', '5 anos', '10 anos'])
  expect(card.getByRole('img', { name: /Projeção do patrimônio em 10 anos/ })).toBeInTheDocument()
  expect(card.getByText(/antes do imposto de renda/)).toBeInTheDocument()
  expect(card.getByText(/Renda fixa, fundos e previdência: 13,4% ao ano/)).toBeInTheDocument()
  const before = table.getByRole('rowheader', { name: '10 anos' }).nextSibling?.textContent
  const input = card.getByLabelText('Aporte por mês (R$)')
  await user.clear(input)
  await user.type(input, '5000')
  expect(card.getByRole('rowheader', { name: '10 anos' }).nextSibling?.textContent).not.toBe(before)
  await user.clear(input)
  await user.type(input, 'abc')
  expect(card.getByText('Informe um aporte válido.')).toBeInTheDocument()
  expect(card.queryByRole('table')).toBeNull()
})

test('sem o índice do título, a projeção avisa em vez de inventar a taxa', () => {
  renderLab({ benchmarks: { ibov: [], cdi: [], selic: [], ipca: [] } })
  expect(screen.getByText('Os índices do Banco Central ainda não carregaram.')).toBeInTheDocument()
})

test('com histórico curto, a projeção não extrapola', () => {
  const short = { 'b3:BBAS3': series['b3:BBAS3'].slice(-60), 'b3:B3SA3': series['b3:B3SA3'].slice(-60) }
  renderLab({ history: ready(short) })
  expect(screen.getByText(/precisa de pelo menos 200 pregões/)).toBeInTheDocument()
})

test('evolução mostra o gráfico a partir de dois dias e explica quando ainda não há', () => {
  const { unmount } = renderLab()
  expect(screen.getByText(/A evolução começa agora/)).toBeInTheDocument()
  unmount()
  renderLab({ snapshots: { '2026-10-29': 1000, '2026-10-30': 1100 } })
  const card = within(screen.getByRole('region', { name: 'Evolução do patrimônio' }))
  expect(card.getByRole('img', { name: /Patrimônio de 29\/10\/26 a 30\/10\/26/ })).toBeInTheDocument()
  expect(card.getByText('Desde 29/10/26').closest('.row')).toHaveTextContent('+10,00%')
})
