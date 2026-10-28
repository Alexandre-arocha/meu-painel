import { render, screen } from '@testing-library/react'
import { App } from './App'

const makePrices = () => ({
  async getQuotes() {
    throw new Error('token ausente')
  },
})
const news = { fetchNews: async () => [] }

test('App mostra o título "Meu painel" e o aviso de sinal de apoio', async () => {
  render(<App makePrices={makePrices} news={news} />)
  expect(screen.getByText('Meu painel')).toBeInTheDocument()
  expect(screen.getByText(/não é previsão garantida/i)).toBeInTheDocument()
  expect(await screen.findByRole('alert')).toBeInTheDocument()
})
