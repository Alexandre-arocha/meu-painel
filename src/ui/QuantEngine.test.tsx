import type { ComponentProps } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuantEngine } from './QuantEngine'
import type { Point } from '../data/prices'
import type { Portfolio } from '../domain/portfolio'

// Pregões à meia-noite de Brasília (03:00 UTC), como a brapi manda.
const days = (values: number[]): Point[] => values.map((p, i) => ({ t: new Date(Date.UTC(2026, 7, 1 + i, 3)).toISOString(), p }))
// BBAS3 cai nos primeiros 20 pregões e sobe 1% ao dia nos 20 seguintes; B3SA3 só oscila.
const bbas3 = days(Array.from({ length: 40 }, (_, i) => (i < 20 ? 20 - i * 0.2 : 16 * 1.01 ** (i - 20))))
const b3sa3 = days(Array.from({ length: 40 }, (_, i) => 14 + (i % 2 === 0 ? 0.2 : -0.2)))
const ready = (series: Record<string, Point[]>) => ({ series, error: null, loading: false })

const empty: Portfolio = { holdings: [], fixedIncome: { amount: 0 } }
const carteira: Portfolio = {
  holdings: [
    { symbol: 'BBAS3', quantity: 100 },
    { symbol: 'B3SA3', quantity: 200 },
  ],
  fixedIncome: { amount: 10000 },
}
const meta = { fixedIncome: 0.6, BBAS3: 0.2, B3SA3: 0.2 }

function renderEngine(over: Partial<ComponentProps<typeof QuantEngine>> = {}) {
  return render(
    <div>
      <QuantEngine history={ready({ BBAS3: bbas3, B3SA3: b3sa3 })} portfolio={empty} quotes={[]} {...over} />
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

test('trocar o ativo mostra o gráfico de B3SA3', async () => {
  const user = userEvent.setup()
  renderEngine()
  await screen.findByRole('img', { name: /Preço ajustado de BBAS3/ })
  await user.click(screen.getByRole('button', { name: 'B3SA3' }))
  expect(screen.getByRole('img', { name: /Preço ajustado de B3SA3/ })).toBeInTheDocument()
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
  const { unmount } = renderEngine()
  expect(await screen.findByText('Preencha a carteira abaixo para ver o risco.')).toBeInTheDocument()
  unmount()
  renderEngine({ portfolio: carteira })
  const risk = screen.getByRole('region', { name: 'Risco da carteira' })
  expect(await within(risk).findByText('Correlação BBAS3 e B3SA3')).toBeInTheDocument()
  expect(within(risk).getByText('Queda possível num dia ruim (1 em 20)')).toBeInTheDocument()
})

test('simulador divide o aporte pela meta e mostra erro em valor inválido', async () => {
  const user = userEvent.setup()
  renderEngine({ portfolio: carteira, target: meta })
  const sim = screen.getByRole('region', { name: 'Simulador de aportes' })
  expect(await within(sim).findAllByText(/ações ·/)).toHaveLength(2)
  const input = within(sim).getByLabelText('Quanto vai aportar (R$)')
  await user.clear(input)
  await user.type(input, 'abc')
  expect(within(sim).getByText('Informe um aporte maior que zero.')).toBeInTheDocument()
  expect(within(sim).queryAllByText(/ações ·/)).toHaveLength(0)
})

test('simulador sem meta pede para definir a meta', async () => {
  renderEngine({ portfolio: carteira })
  expect(await screen.findByText('Defina a meta abaixo para dividir o aporte.')).toBeInTheDocument()
})

test('enquanto o histórico carrega, avisa que está buscando', () => {
  renderEngine({ history: { series: {}, error: null, loading: true } })
  expect(screen.getByText('Buscando o histórico…')).toBeInTheDocument()
})

test('histórico curto mostra aviso em vez de números', () => {
  renderEngine({ history: ready({ BBAS3: days([10, 11, 12]), B3SA3: days([10, 11, 12]) }) })
  expect(screen.getAllByText(/Histórico curto demais/).length).toBeGreaterThan(0)
  expect(screen.queryByText('RSI 14 dias')).toBeNull()
})

test('sem histórico disponível mostra o motivo', () => {
  renderEngine({ history: { series: {}, error: 'Histórico indisponível.', loading: false } })
  expect(screen.getByText('Histórico indisponível.')).toBeInTheDocument()
})

test('a cotação ao vivo entra como o último dia do gráfico e dos números', async () => {
  const quotes = [{ symbol: 'BBAS3', price: 25, changePct: 0, updatedAt: '2026-09-10T15:00:00.000Z', stale: false }]
  renderEngine({ quotes })
  const engine = screen.getByRole('region', { name: 'Motor quantitativo' })
  await within(engine).findByRole('img', { name: /Preço ajustado de BBAS3/ })
  expect(within(engine).getByText('01/08')).toBeInTheDocument()
  expect(within(engine).getByText('10/09')).toBeInTheDocument()
  // O quadro Preço e o topo da escala do gráfico.
  expect(within(engine).getAllByText('R$ 25,00')).toHaveLength(2)
})
