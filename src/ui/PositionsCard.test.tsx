import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Lookup } from '../data/markets'
import type { Quote } from '../data/prices'
import type { Position, PricedKind } from '../domain/portfolio'
import { PositionsCard } from './PositionsCard'

const quotes: Quote[] = [{ symbol: 'b3:PETR4', price: 30, changePct: 1.5, updatedAt: '2026-10-28T14:00:00.000Z', stale: false }]
const petr4: Position = { id: 'p1', kind: 'acao', symbol: 'PETR4', quantity: 100, name: 'Petrobras' }

function setup(initial: Position[] = [], answer: (kind: PricedKind, symbol: string) => Lookup = (_, symbol) => ({ ok: true, symbol })) {
  const saved = vi.fn()
  const lookup = vi.fn(async (kind: PricedKind, symbol: string) => answer(kind, symbol))
  function Harness() {
    const [positions, setPositions] = useState(initial)
    return (
      <PositionsCard
        positions={positions}
        quotes={quotes}
        lookup={lookup}
        onSave={(next) => {
          saved(next)
          setPositions(next)
        }}
      />
    )
  }
  render(<Harness />)
  return { saved, lookup, user: userEvent.setup(), card: screen.getByRole('region', { name: 'Seus investimentos' }) }
}

test('adiciona uma ação depois de conferir o código e mostra no grupo Ações com o valor e a variação', async () => {
  const { saved, lookup, user, card } = setup([], () => ({ ok: true, symbol: 'PETR4', name: 'Petrobras' }))
  expect(within(card).getByText(/Nenhum investimento ainda/)).toBeInTheDocument()
  await user.type(within(card).getByLabelText('Código'), 'petr4')
  await user.type(within(card).getByLabelText('Quantidade'), '100')
  await user.click(within(card).getByRole('button', { name: 'Adicionar' }))
  const group = await within(card).findByRole('list', { name: 'Ações' })
  expect(within(group).getByText('PETR4')).toBeInTheDocument()
  expect(within(group).getByText('Petrobras · 100 ações')).toBeInTheDocument()
  expect(within(group).getByText(/R\$\s3\.000,00/)).toBeInTheDocument()
  expect(within(group).getByText('+1,50%')).toBeInTheDocument()
  expect(lookup).toHaveBeenCalledWith('acao', 'PETR4')
  expect(saved).toHaveBeenLastCalledWith([{ id: expect.any(String), kind: 'acao', symbol: 'PETR4', quantity: 100, name: 'Petrobras' }])
  expect(within(card).getByLabelText('Código')).toHaveValue('')
})

test('erro de validação aparece no campo sem consultar; código que não existe mostra o motivo e não salva', async () => {
  const { saved, lookup, user, card } = setup([], () => ({ ok: false, error: 'código não encontrado na B3' }))
  await user.type(within(card).getByLabelText('Código'), 'PETR4')
  await user.type(within(card).getByLabelText('Quantidade'), '1,5')
  await user.click(within(card).getByRole('button', { name: 'Adicionar' }))
  expect(within(card).getByText('use número inteiro')).toBeInTheDocument()
  expect(lookup).not.toHaveBeenCalled()
  await user.clear(within(card).getByLabelText('Quantidade'))
  await user.type(within(card).getByLabelText('Quantidade'), '10')
  await user.click(within(card).getByRole('button', { name: 'Adicionar' }))
  expect(await within(card).findByText('código não encontrado na B3')).toBeInTheDocument()
  expect(within(card).getByLabelText('Código')).toHaveAttribute('aria-invalid', 'true')
  expect(saved).not.toHaveBeenCalled()
})

test('renda fixa mostra os campos do título e salva sem consultar', async () => {
  const { saved, lookup, user, card } = setup()
  await user.selectOptions(within(card).getByLabelText('Tipo'), 'renda-fixa')
  expect(within(card).queryByLabelText('Código')).toBeNull()
  await user.type(within(card).getByLabelText('Nome'), 'CDB Banco X')
  await user.type(within(card).getByLabelText('Valor (R$)'), '10.000')
  expect(within(card).getByLabelText('Tipo de título')).toHaveValue('cdb')
  await user.selectOptions(within(card).getByLabelText('Índice'), 'cdi')
  await user.type(within(card).getByLabelText('Taxa (% do CDI)'), '110')
  fireEvent.change(within(card).getByLabelText('Vencimento'), { target: { value: '2027-12-15' } })
  await user.click(within(card).getByRole('button', { name: 'Adicionar' }))
  expect(saved).toHaveBeenLastCalledWith([
    { id: expect.any(String), kind: 'renda-fixa', name: 'CDB Banco X', amount: 10000, subtype: 'cdb', index: 'cdi', rate: 110, maturity: '2027-12-15' },
  ])
  expect(lookup).not.toHaveBeenCalled()
  const group = within(card).getByRole('list', { name: 'Renda fixa' })
  expect(within(group).getByText('CDB · 110% do CDI · vence 12/2027')).toBeInTheDocument()
  expect(within(group).getByText(/R\$\s10\.000,00/)).toBeInTheDocument()
})

test('cripto aceita fração e guarda o id da CoinGecko com o nome', async () => {
  const { saved, lookup, user, card } = setup([], () => ({ ok: true, symbol: 'bitcoin', name: 'Bitcoin' }))
  await user.selectOptions(within(card).getByLabelText('Tipo'), 'cripto')
  await user.type(within(card).getByLabelText('Código'), 'BTC')
  await user.type(within(card).getByLabelText('Quantidade'), '0,5')
  await user.click(within(card).getByRole('button', { name: 'Adicionar' }))
  expect(await within(card).findByRole('list', { name: 'Cripto' })).toHaveTextContent('Bitcoin')
  expect(lookup).toHaveBeenCalledWith('cripto', 'btc')
  expect(saved).toHaveBeenLastCalledWith([{ id: expect.any(String), kind: 'cripto', symbol: 'bitcoin', quantity: 0.5, name: 'Bitcoin' }])
})

test('classe com ativo ainda sem preço mostra traço no total, em vez de zero', () => {
  const { card } = setup([{ id: 'v', kind: 'acao', symbol: 'VALE3', quantity: 10 }])
  expect(within(card).getByRole('heading', { name: 'Ações' }).nextSibling).toHaveTextContent('—')
})

test('não deixa cadastrar o mesmo ativo duas vezes', async () => {
  const { saved, user, card } = setup([petr4])
  await user.type(within(card).getByLabelText('Código'), 'PETR4')
  await user.type(within(card).getByLabelText('Quantidade'), '5')
  await user.click(within(card).getByRole('button', { name: 'Adicionar' }))
  expect(await within(card).findByText('esse ativo já está na carteira; edite a quantidade')).toBeInTheDocument()
  expect(saved).not.toHaveBeenCalled()
})

test('editar muda a quantidade sem consultar de novo; remover pede confirmação', async () => {
  const { saved, lookup, user, card } = setup([petr4])
  await user.click(within(card).getByRole('button', { name: 'Editar PETR4' }))
  const qty = within(card).getByLabelText('Quantidade')
  expect(qty).toHaveValue('100')
  expect(qty).toHaveFocus()
  await user.clear(qty)
  await user.type(qty, '150')
  await user.click(within(card).getByRole('button', { name: 'Salvar alterações' }))
  expect(saved).toHaveBeenLastCalledWith([{ ...petr4, quantity: 150 }])
  expect(lookup).not.toHaveBeenCalled()

  await user.click(within(card).getByRole('button', { name: 'Remover PETR4' }))
  const ask = within(card).getByRole('group', { name: 'Remover PETR4?' })
  await user.click(within(ask).getByRole('button', { name: 'Cancelar' }))
  expect(within(card).getByText('PETR4')).toBeInTheDocument()
  await user.click(within(card).getByRole('button', { name: 'Remover PETR4' }))
  await user.click(within(within(card).getByRole('group', { name: 'Remover PETR4?' })).getByRole('button', { name: 'Remover' }))
  expect(saved).toHaveBeenLastCalledWith([])
  expect(within(card).getByText(/Nenhum investimento ainda/)).toBeInTheDocument()
})
