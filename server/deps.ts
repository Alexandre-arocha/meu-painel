import type { Deps } from './api.js'
import { createKv } from './kv.js'

// Segredos vêm só das variáveis de ambiente da Vercel (cadastradas pelo dono).
export function deps(): Deps {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  return {
    env: { APP_PASSWORD: process.env.APP_PASSWORD, BRAPI_TOKEN: process.env.BRAPI_TOKEN, DATABASE_URL: databaseUrl },
    kv: databaseUrl ? () => createKv(databaseUrl) : undefined,
  }
}
