import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginPage } from './LoginPage'

test('senha errada mostra "senha incorreta"', async () => {
  const user = userEvent.setup()
  const fetchFn = (async () => new Response('{"error":"senha incorreta"}', { status: 401 })) as unknown as typeof fetch
  let entered = false
  render(<LoginPage onLogin={() => (entered = true)} fetchFn={fetchFn} />)
  await user.type(screen.getByLabelText('Senha'), 'errada')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  expect(await screen.findByText('senha incorreta')).toBeInTheDocument()
  expect(entered).toBe(false)
})
