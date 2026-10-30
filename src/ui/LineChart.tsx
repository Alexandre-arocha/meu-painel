type Series = { values: (number | null)[]; color: string }

// Linhas num SVG que estica na largura, sem eixos: serve para ler a forma, não o valor exato.
export function LineChart({ series, label, height = 160 }: { series: Series[]; label: string; height?: number }) {
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null))
  const n = Math.max(0, ...series.map((s) => s.values.length))
  if (all.length < 2 || n < 2) return null
  const min = Math.min(...all)
  const span = Math.max(...all) - min || 1
  const points = (values: (number | null)[]) =>
    values
      .map((v, i) => (v == null ? null : `${((i / (n - 1)) * 300).toFixed(1)},${(height - 6 - ((v - min) / span) * (height - 12)).toFixed(1)}`))
      .filter(Boolean)
      .join(' ')
  return (
    <svg className="chart" style={{ height }} viewBox={`0 0 300 ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {series.map((s, i) => (
        <polyline key={i} points={points(s.values)} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}
