import { neon } from '@neondatabase/serverless'
import type { Kv } from './api.js'

// Tabela única chave → JSON, criada na primeira chamada de cada instância da função.
export function createKv(databaseUrl: string): Kv {
  const sql = neon(databaseUrl)
  let ready: Promise<unknown> | null = null
  const ensureTable = () =>
    (ready ??= sql`create table if not exists painel_kv (key text primary key, value jsonb not null, updated_at timestamptz not null default now())`)
  return {
    async all() {
      await ensureTable()
      const rows = (await sql`select key, value from painel_kv`) as { key: string; value: unknown }[]
      return Object.fromEntries(rows.map((r) => [r.key, r.value]))
    },
    async put(key, value) {
      await ensureTable()
      await sql`insert into painel_kv (key, value, updated_at) values (${key}, ${JSON.stringify(value)}::jsonb, now())
        on conflict (key) do update set value = excluded.value, updated_at = now()`
    },
  }
}
