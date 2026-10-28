import { setWriteListener } from './data/storage'
import { SYNC_KEYS, isSyncKey } from './data/syncKeys'

// Sincronização do app publicado: o banco guarda a cópia de cada chave de SYNC_KEYS.
// Vale a última gravação; sem rede, a chave fica pendente e vai quando a conexão voltar.
const PENDING_KEY = 'painel:v1:pendingSync'

// Com o app publicado o token da brapi mora no servidor: nunca sobe para o banco.
function valueToSend(key: string, raw: string): unknown {
  const value = JSON.parse(raw)
  if (key === 'painel:v1:settings' && value && typeof value === 'object') {
    const copy = { ...(value as Record<string, unknown>) }
    delete copy.brapiToken
    return copy
  }
  return value
}

// Devolve as chaves que vieram do banco (lista vazia: banco ainda vazio).
export async function pullAll(fetchFn: typeof fetch, store: Storage): Promise<string[]> {
  const res = await fetchFn('/api/data')
  if (!res.ok) throw new Error(`sincronização: ${res.status}`)
  const { items } = (await res.json()) as { items?: Record<string, unknown> }
  const keys = Object.keys(items ?? {}).filter(isSyncKey)
  // setItem direto: o que veio do banco não precisa voltar para o banco.
  for (const key of keys) store.setItem(key, JSON.stringify(items![key]))
  return keys
}

export function createSync(fetchFn: typeof fetch, store: Storage) {
  const readPending = (): string[] => {
    try {
      const v: unknown = JSON.parse(store.getItem(PENDING_KEY) ?? '[]')
      return Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string' && isSyncKey(k)) : []
    } catch {
      return []
    }
  }
  const writePending = (keys: string[]) => {
    try {
      store.setItem(PENDING_KEY, JSON.stringify(keys))
    } catch {
      // sem espaço: a chave volta para a fila na próxima gravação
    }
  }
  const drop = (key: string) => writePending(readPending().filter((k) => k !== key))

  function queue(key: string) {
    if (!isSyncKey(key)) return
    const pending = readPending()
    if (!pending.includes(key)) writePending([...pending, key])
  }

  async function flush() {
    for (const key of readPending()) {
      const raw = store.getItem(key)
      if (raw === null) {
        drop(key)
        continue
      }
      let value: unknown
      try {
        value = valueToSend(key, raw)
      } catch {
        drop(key) // valor local corrompido: não há o que enviar
        continue
      }
      try {
        const res = await fetchFn('/api/data', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key, value }),
        })
        if (res.ok) drop(key)
      } catch {
        // sem rede: continua pendente
      }
    }
  }

  // Sobe as chaves que existem no aparelho mas ainda não estão no banco.
  const queueMissing = (inBank: string[]) =>
    SYNC_KEYS.filter((k) => !inBank.includes(k) && store.getItem(k) !== null).forEach(queue)

  return { queue, flush, queueMissing }
}

export async function startSync(fetchFn: typeof fetch, store: Storage, events: EventTarget = window): Promise<void> {
  const sync = createSync(fetchFn, store)
  setWriteListener((key) => {
    sync.queue(key)
    void sync.flush()
  })
  events.addEventListener('online', () => void sync.flush())
  await sync.flush() // primeiro o que ficou pendente de antes, para o banco não sobrescrever
  sync.queueMissing(await pullAll(fetchFn, store)) // banco vazio ou incompleto recebe o que só este aparelho tem
  await sync.flush()
}
