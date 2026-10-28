const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const money = (n: number) => brl.format(n)

export const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2).replace('.', ',')}%`

export const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

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
