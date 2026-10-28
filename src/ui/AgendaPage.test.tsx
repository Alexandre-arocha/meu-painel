import { fireEvent, render, screen, within } from '@testing-library/react'
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

test('próximo mês mostra novembro de 2026', async () => {
  const user = userEvent.setup()
  render(<AgendaPage now={now} />)
  await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
  expect(screen.getByRole('heading', { name: 'novembro de 2026' })).toBeInTheDocument()
})

test('clicar num dia mostra o plano daquele dia', async () => {
  const user = userEvent.setup()
  render(<AgendaPage now={now} />)
  await user.click(screen.getByRole('button', { name: /^31 de outubro/ }))
  const plano = screen.getByRole('region', { name: 'Plano do dia' })
  expect(within(plano).getByRole('heading', { name: 'Plano de 31/10/2026' })).toBeInTheDocument()
  expect(within(plano).getByText('09:00–10:00')).toBeInTheDocument()
})

test('compromisso semanal aparece nas semanas seguintes', async () => {
  const user = userEvent.setup()
  render(<AgendaPage now={now} />)
  await user.type(screen.getByLabelText('Título'), 'Academia')
  fireEvent.change(screen.getByLabelText('Horário (opcional)'), { target: { value: '19:00' } })
  await user.click(within(screen.getByRole('group', { name: 'Repetir toda semana' })).getByLabelText('Qua'))
  await user.click(screen.getByRole('button', { name: 'Adicionar' }))
  expect(loadEvents()).toMatchObject([{ title: 'Academia', weekdays: [3] }])
  await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
  await user.click(screen.getByRole('button', { name: /^4 de novembro/ }))
  expect(within(screen.getByRole('region', { name: 'Plano do dia' })).getByText(/Academia/)).toBeInTheDocument()
})

test('duração inválida mostra erro', async () => {
  const user = userEvent.setup()
  render(<AgendaPage now={now} />)
  await user.type(screen.getByLabelText('Título'), 'Reunião')
  const duration = screen.getByLabelText('Duração (min)')
  await user.clear(duration)
  await user.type(duration, '2')
  await user.click(screen.getByRole('button', { name: 'Adicionar' }))
  expect(screen.getByText('duração entre 5 e 720 minutos')).toBeInTheDocument()
  expect(loadEvents()).toEqual([])
})

test('datas importantes mostram a contagem', async () => {
  const user = userEvent.setup()
  render(<AgendaPage now={now} />)
  await user.type(screen.getByLabelText('Título'), 'Prova PM')
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-11-08' } })
  await user.selectOptions(screen.getByLabelText('Tipo'), 'prova')
  await user.click(screen.getByRole('button', { name: 'Adicionar' }))
  expect(within(screen.getByRole('region', { name: 'Datas importantes' })).getByText('faltam 11 dias')).toBeInTheDocument()
})

test('adicionar compromisso funciona sem crypto.randomUUID (http no celular)', async () => {
  const desc = Object.getOwnPropertyDescriptor(crypto, 'randomUUID')
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
  try {
    const user = userEvent.setup()
    render(<AgendaPage now={now} />)
    await user.type(screen.getByLabelText('Título'), 'Dentista')
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(loadEvents()).toMatchObject([{ title: 'Dentista' }])
  } finally {
    if (desc) Object.defineProperty(crypto, 'randomUUID', desc)
    else delete (crypto as { randomUUID?: unknown }).randomUUID
  }
})

test('remover compromisso tira da lista', async () => {
  const user = userEvent.setup()
  render(<AgendaPage now={now} />)
  await user.type(screen.getByLabelText('Título'), 'Prova da PM')
  await user.click(screen.getByRole('button', { name: 'Adicionar' }))
  await user.click(screen.getByRole('button', { name: 'Remover Prova da PM' }))
  expect(loadEvents()).toEqual([])
})
