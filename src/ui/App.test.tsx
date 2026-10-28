import { render, screen } from '@testing-library/react'
import { App } from './App'

test('App mostra o título "Meu painel" e o aviso de sinal de apoio', () => {
  render(<App />)
  expect(screen.getByText('Meu painel')).toBeInTheDocument()
  expect(screen.getByText(/não é previsão garantida/i)).toBeInTheDocument()
})
