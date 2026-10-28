import { createSync, pullAll, startSync } from './sync'
import { savePortfolio, saveRoutine, setWriteListener } from './data/storage'
import { DEFAULT_ROUTINE } from './domain/agenda'

type Call = { url: string; method: string; body?: unknown }

function fakeApi(items: Record<string, unknown> = {}, opts: { offline?: boolean } = {}) {
  const calls: Call[] = []
  const fetchFn = (async (url: string, init?: RequestInit) => {
    if (opts.offline) throw new TypeError('Failed to fetch')
    const method = init?.method ?? 'GET'
    calls.push({ url: String(url), method, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'GET') return new Response(JSON.stringify({ items }), { status: 200 })
    return new Response(null, { status: 204 })
  }) as unknown as typeof fetch
  return { calls, fetchFn }
}
const putKeys = (calls: Call[]) => calls.filter((c) => c.method === 'PUT').map((c) => (c.body as { key: string }).key)

beforeEach(() => {
  localStorage.clear()
  setWriteListener(null)
})

test('listener recebe a chave gravada e não é chamado se a gravação falha', () => {
  const keys: string[] = []
  setWriteListener((k) => keys.push(k))
  saveRoutine(DEFAULT_ROUTINE)
  const full = { getItem: () => null, setItem: () => { throw new Error('cheio') } } as unknown as Storage
  saveRoutine(DEFAULT_ROUTINE, full)
  expect(keys).toEqual(['painel:v1:routine'])
})

test('pullAll grava os valores do banco', async () => {
  const api = fakeApi({ 'painel:v1:events': [{ id: '1' }], 'outra:chave': 1 })
  expect(await pullAll(api.fetchFn, localStorage)).toBe('pulled')
  expect(JSON.parse(localStorage.getItem('painel:v1:events')!)).toEqual([{ id: '1' }])
  expect(localStorage.getItem('outra:chave')).toBeNull()
})

test('pullAll com banco vazio não mexe nos dados locais', async () => {
  localStorage.setItem('painel:v1:events', '[{"id":"local"}]')
  expect(await pullAll(fakeApi({}).fetchFn, localStorage)).toBe('empty')
  expect(localStorage.getItem('painel:v1:events')).toBe('[{"id":"local"}]')
})

test('flush envia o valor atual e limpa a pendência', async () => {
  const api = fakeApi()
  const sync = createSync(api.fetchFn, localStorage)
  localStorage.setItem('painel:v1:routine', '{"studyMinutes":90}')
  sync.queue('painel:v1:routine')
  await sync.flush()
  expect(api.calls).toEqual([{ url: '/api/data', method: 'PUT', body: { key: 'painel:v1:routine', value: { studyMinutes: 90 } } }])
  expect(localStorage.getItem('painel:v1:pendingSync')).toBe('[]')
})

test('sem rede a pendência fica guardada', async () => {
  const sync = createSync(fakeApi({}, { offline: true }).fetchFn, localStorage)
  localStorage.setItem('painel:v1:routine', '{}')
  sync.queue('painel:v1:routine')
  await sync.flush()
  expect(JSON.parse(localStorage.getItem('painel:v1:pendingSync')!)).toEqual(['painel:v1:routine'])
})

test('settings sobe sem brapiToken', async () => {
  const api = fakeApi()
  const sync = createSync(api.fetchFn, localStorage)
  const target = { fixedIncome: 1, BBAS3: 0, B3SA3: 0 }
  localStorage.setItem('painel:v1:settings', JSON.stringify({ brapiToken: 'valor-de-teste', targetAllocation: target }))
  sync.queue('painel:v1:settings')
  await sync.flush()
  expect(api.calls[0].body).toEqual({ key: 'painel:v1:settings', value: { targetAllocation: target } })
})

test('chave fora da lista não é enviada', async () => {
  const api = fakeApi()
  const sync = createSync(api.fetchFn, localStorage)
  localStorage.setItem('painel:v1:lastNews', '{}')
  sync.queue('painel:v1:lastNews')
  await sync.flush()
  expect(api.calls).toEqual([])
})

test('startSync com banco vazio envia os dados locais e depois cada gravação', async () => {
  localStorage.setItem('painel:v1:events', '[{"id":"local"}]')
  const api = fakeApi({})
  await startSync(api.fetchFn, localStorage, new EventTarget())
  expect(putKeys(api.calls)).toEqual(['painel:v1:events'])
  savePortfolio({ holdings: [], fixedIncome: { amount: 5 } })
  await new Promise((r) => setTimeout(r, 0))
  expect(putKeys(api.calls)).toContain('painel:v1:portfolio')
})
