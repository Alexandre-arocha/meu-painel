import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StudyPage } from './StudyPage'
import { loadAttempts } from '../data/storage'

// rand 0 escolhe sempre a primeira questão do banco: roteamento no modelo OSI (resposta "B) Rede")
const first = () => 0

beforeEach(() => localStorage.clear())

test('responder certo mostra "Correto" e grava a tentativa', async () => {
  const user = userEvent.setup()
  render(<StudyPage rand={first} />)
  await user.click(screen.getByRole('button', { name: 'B) Rede' }))
  expect(screen.getByText('Correto.')).toBeInTheDocument()
  expect(loadAttempts()).toMatchObject([{ questionId: 't-redes-1', correct: true }])
})

test('responder errado mostra a resposta certa e coloca no caderno de erros', async () => {
  const user = userEvent.setup()
  render(<StudyPage rand={first} />)
  await user.click(screen.getByRole('button', { name: 'A) Enlace' }))
  expect(screen.getByText('Errado. Resposta certa: B) Rede.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Caderno de erros (1)' })).toBeInTheDocument()
})

test('importar texto inválido mostra erro', async () => {
  const user = userEvent.setup()
  render(<StudyPage rand={first} />)
  await user.click(screen.getByLabelText('Questões em JSON'))
  await user.paste('abc')
  await user.click(screen.getByRole('button', { name: 'Importar' }))
  expect(screen.getByText('JSON inválido')).toBeInTheDocument()
})

test('importar questões válidas adiciona a matéria no filtro', async () => {
  const user = userEvent.setup()
  render(<StudyPage rand={first} />)
  await user.click(screen.getByLabelText('Questões em JSON'))
  await user.paste(
    JSON.stringify([{ id: 'x1', subject: 'Matéria nova', statement: 'Quanto é 1+1?', options: ['1', '2'], answer: 1 }]),
  )
  await user.click(screen.getByRole('button', { name: 'Importar' }))
  expect(screen.getByText('1 questão importada.')).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Matéria nova' })).toBeInTheDocument()
})
