import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgendaPage } from './AgendaPage'
import { loadEvents, loadRoutine } from '../data/storage'
import { DEFAULT_ROUTINE } from '../domain/agenda'

const now = () => new Date(2026, 9, 28, 9, 0) // quarta-feira

beforeEach(() => localStorage.clear())

test('adicionar compromisso com horário entra na lista e empurra o estudo', async () => {
  const user = userEvent.setup()
  render(<AgendaPage now={now} />)
  await user.type(screen.getByLabelText('Título'), 'Dentista')
  fireEvent.change(screen.getByLabelText('Horário (opcional)'), { target: { value: '18:00' } })
  await user.click(screen.getByRole('button', { name: 'Adicionar' }))
  expect(loadEvents()).toMatchObject([{ title: 'Dentista', date: '2026-10-28', time: '18:00' }])
  expect(screen.getByText('19:00–20:00')).toBeInTheDocument()
})

test('título vazio mostra erro e não salva', async () => {
  const user = userEvent.setup()
  render(<AgendaPage now={now} />)
  await user.click(screen.getByRole('button', { name: 'Adicionar' }))
  expect(screen.getByText('informe o título')).toBeInTheDocument()
  expect(loadEvents()).toEqual([])
})

test('rotina com minutos inválidos mostra erro e não salva', async () => {
  const user = userEvent.setup()
  render(<AgendaPage now={now} />)
  const minutes = screen.getByLabelText('Minutos de estudo por dia')
  await user.clear(minutes)
  await user.type(minutes, 'abc')
  await user.click(screen.getByRole('button', { name: 'Salvar rotina' }))
  expect(screen.getByText('minutos de estudo entre 0 e 600')).toBeInTheDocument()
  expect(loadRoutine()).toEqual(DEFAULT_ROUTINE)
})

test('remover compromisso tira da lista', async () => {
  const user = userEvent.setup()
  render(<AgendaPage now={now} />)
  await user.type(screen.getByLabelText('Título'), 'Prova da PM')
  await user.click(screen.getByRole('button', { name: 'Adicionar' }))
  await user.click(screen.getByRole('button', { name: 'Remover Prova da PM' }))
  expect(loadEvents()).toEqual([])
})
