import { tradingDay } from '../domain/quant'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const money = (n: number) => brl.format(n)

export const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2).replace('.', ',')}%`

// Fração como porcentagem sem sinal: 0.2843 vira "28,4%".
export const ratio = (f: number) => `${(f * 100).toFixed(1).replace('.', ',')}%`

export const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

// Dia e mês do pregão, como "30/10".
export function dayMonth(iso: string): string {
  const d = tradingDay(iso)
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`
}

export const dayTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

const longFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

// "quinta-feira, 29 de outubro" com a primeira letra maiúscula.
export function longDate(d: Date): string {
  const text = longFmt.format(d)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const two = (n: number) => String(n).padStart(2, '0')

// Data local no formato AAAA-MM-DD (a agenda e a meta diária usam o dia do aparelho, não UTC).
export const localDate = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`

export function ago(iso: string | null, now: Date): string {
  if (!iso) return 'sem data'
  const min = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`
}
