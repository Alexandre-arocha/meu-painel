import { useState, type FormEvent } from 'react'

export function LoginPage({ onLogin, fetchFn = fetch }: { onLogin: () => void; fetchFn?: typeof fetch }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetchFn('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        setPassword('')
        onLogin()
        return
      }
      setError(res.status === 401 ? 'senha incorreta' : `não foi possível entrar (${res.status})`)
    } catch {
      setError('sem conexão com o servidor')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page login">
      <section className="card" aria-label="Entrar">
        <h1>Meu painel</h1>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p className="err" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || !password}>
            Entrar
          </button>
        </form>
      </section>
    </main>
  )
}
