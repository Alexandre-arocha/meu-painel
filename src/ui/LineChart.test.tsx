import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChartTable, LineChart } from './LineChart'

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
const props = {
  label: 'Preço de teste',
  dates: ['01/10', '02/10', '03/10'],
  format: brl,
  series: [
    { label: 'Preço', color: 'red', values: [10, 12, 11] },
    { label: 'Média', color: 'blue', values: [null, 11, 11.5] },
  ],
}

afterEach(() => vi.restoreAllMocks())

test('mostra a escala: o primeiro e o último dia, o maior e o menor valor', () => {
  render(<LineChart {...props} />)
  expect(screen.getByRole('img', { name: 'Preço de teste, de 01/10 a 03/10, entre R$ 10,00 e R$ 12,00' })).toBeInTheDocument()
  for (const text of ['01/10', '03/10', 'R$ 12,00', 'R$ 10,00']) expect(screen.getByText(text)).toBeInTheDocument()
})

test('pelo teclado, as setas mostram os valores de cada dia', async () => {
  const user = userEvent.setup()
  const { container } = render(<LineChart {...props} />)
  const day = screen.getByRole('slider', { name: /Preço de teste/ })
  await user.tab()
  expect(day).toHaveFocus()
  expect(day).toHaveAttribute('aria-valuetext', '03/10: Preço R$ 11,00, Média R$ 11,50')
  const tip = container.querySelector('.chart-tip') as HTMLElement
  expect(within(tip).getByText('R$ 11,50')).toBeInTheDocument()
  await user.keyboard('{ArrowLeft}')
  expect(day).toHaveAttribute('aria-valuetext', '02/10: Preço R$ 12,00, Média R$ 11,00')
  await user.keyboard('{Home}')
  expect(day).toHaveAttribute('aria-valuetext', '01/10: Preço R$ 10,00, Média —')
  await user.keyboard('{End}')
  expect(day).toHaveAttribute('aria-valuetext', '03/10: Preço R$ 11,00, Média R$ 11,50')
})

test('duas setas no mesmo instante andam dois dias', () => {
  render(<LineChart {...props} />)
  const day = screen.getByRole('slider', { name: /Preço de teste/ })
  act(() => day.focus())
  act(() => {
    day.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    day.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
  })
  expect(day).toHaveAttribute('aria-valuetext', '01/10: Preço R$ 10,00, Média —')
})

test('o quadro do dia não passa da borda de um gráfico estreito', async () => {
  // Celular: gráfico de 251 px e quadro de 209 px, como no navegador.
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(251)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(209)
  const user = userEvent.setup()
  const { container } = render(<LineChart {...props} />)
  await user.tab()
  await user.keyboard('{ArrowLeft}')
  // No dia do meio o quadro não cabe ao lado da linha; ele encosta na borda direita (251 - 209).
  expect((container.querySelector('.chart-tip') as HTMLElement).style.left).toBe('42px')
})

test('o cursor sobre o gráfico mostra o dia mais perto e some ao sair', () => {
  const { container } = render(<LineChart {...props} />)
  const day = screen.getByRole('slider', { name: /Preço de teste/ })
  day.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 160, right: 300, bottom: 160, x: 0, y: 0, toJSON: () => ({}) })
  fireEvent.pointerMove(day, { clientX: 140 })
  expect(day).toHaveAttribute('aria-valuetext', '02/10: Preço R$ 12,00, Média R$ 11,00')
  expect(container.querySelector('.chart-tip')).not.toBeNull()
  fireEvent.pointerLeave(day)
  expect(container.querySelector('.chart-tip')).toBeNull()
})

test('a tabela mostra todos os dias, do mais novo para o mais antigo', () => {
  const { container } = render(<ChartTable series={props.series} dates={props.dates} format={props.format} />)
  const details = container.querySelector('details') as HTMLDetailsElement
  details.open = true
  fireEvent(details, new Event('toggle'))
  const rows = within(screen.getByRole('table')).getAllByRole('row')
  expect(rows.map((r) => r.textContent)).toEqual(['DiaPreçoMédia', '03/10R$ 11,00R$ 11,50', '02/10R$ 12,00R$ 11,00', '01/10R$ 10,00—'])
})
