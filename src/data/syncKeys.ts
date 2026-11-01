// Chaves do localStorage que vão para o banco. Caches de preço e de notícia ficam só no aparelho.
// A carteira antiga (portfolio) continua: uma versão velha do app em outro aparelho ainda grava nela.
export const SYNC_KEYS = [
  'painel:v1:positions',
  'painel:v1:portfolio',
  'painel:v1:settings',
  'painel:v1:events',
  'painel:v1:routine',
] as const

export const isSyncKey = (key: string): boolean => (SYNC_KEYS as readonly string[]).includes(key)
