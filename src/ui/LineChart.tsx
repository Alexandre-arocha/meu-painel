import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

type Series = { label: string; values: (number | null)[]; color: string }
type Data = { series: Series[]; dates: string[]; format: (v: number) => string }

const W = 300 // largura do viewBox; o SVG estica na largura do cartão
const PAD = 6 // folga para a linha de 2px não cortar no topo e no fundo
const GAP = 10 // distância entre a linha vertical e o quadro do dia

const shown = (format: (v: number) => string, v: number | null | undefined) => (v == null ? '—' : format(v))
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

// Linhas com escala (primeiro e último dia, maior e menor valor) e leitura de cada dia pelo cursor, pelo toque ou pelas setas.
export function LineChart({ series, dates, format, label, height = 160 }: Data & { label: string; height?: number }) {
  const [active, setActive] = useState<number | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null))
  const n = Math.max(0, ...series.map((s) => s.values.length))
  // Encosta o quadro do dia ao lado da linha vertical, sem deixar que ele passe da borda do gráfico.
  useLayoutEffect(() => {
    const tip = tipRef.current
    const box = tip?.parentElement
    if (!tip || !box || active == null) return
    const at = active / (n - 1)
    const cross = at * box.clientWidth
    const want = at > 0.5 ? cross - GAP - tip.offsetWidth : cross + GAP
    tip.style.left = `${clamp(want, 0, Math.max(box.clientWidth - tip.offsetWidth, 0))}px`
  })
  if (all.length < 2 || n < 2) return null

  const min = Math.min(...all)
  const max = Math.max(...all)
  const span = max - min || 1
  const x = (i: number) => (i / (n - 1)) * W
  const y = (v: number) => height - PAD - ((v - min) / span) * (height - 2 * PAD)
  const points = (values: (number | null)[]) =>
    values
      .map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      .join(' ')
  const day = active ?? n - 1
  const left = (x(day) / W) * 100

  function pick(e: PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    if (box.width > 0) setActive(Math.round(clamp((e.clientX - box.left) / box.width, 0, 1) * (n - 1)))
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, (i: number) => number> = {
      ArrowLeft: (i) => i - 1,
      ArrowDown: (i) => i - 1,
      ArrowRight: (i) => i + 1,
      ArrowUp: (i) => i + 1,
      Home: () => 0,
      End: () => n - 1,
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    // Parte do dia mais recente, para duas teclas seguidas andarem dois dias.
    setActive((i) => clamp(move(i ?? n - 1), 0, n - 1))
  }

  return (
    <figure className="chart-fig">
      <div className="chart-plot">
        <div className="chart-box" style={{ height }}>
          <svg
            className="chart"
            viewBox={`0 0 ${W} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${label}, de ${dates[0]} a ${dates[n - 1]}, entre ${format(min)} e ${format(max)}`}
          >
            <line className="chart-grid" x1="0" x2={W} y1={PAD} y2={PAD} vectorEffect="non-scaling-stroke" />
            <line className="chart-grid" x1="0" x2={W} y1={height - PAD} y2={height - PAD} vectorEffect="non-scaling-stroke" />
            {/* A primeira série fica por cima das outras. */}
            {[...series].reverse().map((s) => (
              <polyline
                key={s.label}
                points={points(s.values)}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {active != null && <line className="chart-cross" x1={x(day)} x2={x(day)} y1="0" y2={height} vectorEffect="non-scaling-stroke" />}
          </svg>
          {active != null &&
            series.map((s) => {
              const v = s.values[day]
              return v == null ? null : (
                <span key={s.label} className="chart-dot" style={{ left: `${left}%`, top: `${(y(v) / height) * 100}%`, background: s.color }} />
              )
            })}
          {active != null && (
            <div ref={tipRef} className="chart-tip" aria-hidden="true">
              <span className="muted">{dates[day]}</span>
              {series.map((s) => (
                <span key={s.label} className="chart-tip-row">
                  <i className="swatch" style={{ background: s.color }} />
                  <b className="num">{shown(format, s.values[day])}</b>
                  <span className="muted">{s.label}</span>
                </span>
              ))}
            </div>
          )}
          <div
            className="chart-hit"
            role="slider"
            tabIndex={0}
            aria-label={`${label}, dia a dia`}
            aria-valuemin={0}
            aria-valuemax={n - 1}
            aria-valuenow={day}
            aria-valuetext={`${dates[day]}: ${series.map((s) => `${s.label} ${shown(format, s.values[day])}`).join(', ')}`}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(day)}
            onBlur={() => setActive(null)}
            onKeyDown={onKey}
          />
        </div>
        <div className="chart-y" aria-hidden="true">
          <span>{format(max)}</span>
          <span>{format(min)}</span>
        </div>
        <div className="chart-x" aria-hidden="true">
          <span>{dates[0]}</span>
          <span>{dates[n - 1]}</span>
        </div>
      </div>
    </figure>
  )
}

// Os mesmos dados do gráfico numa tabela, do dia mais novo para o mais antigo. Só monta as linhas quando abre.
export function ChartTable({ series, dates, format }: Data) {
  const [open, setOpen] = useState(false)
  return (
    <details className="more-info" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Ver os dados em tabela</summary>
      {open && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Dia</th>
                {series.map((s) => (
                  <th key={s.label} scope="col">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((_, k) => dates.length - 1 - k).map((i) => (
                <tr key={i}>
                  <th scope="row">{dates[i]}</th>
                  {series.map((s) => (
                    <td key={s.label} className="num">
                      {shown(format, s.values[i])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  )
}
