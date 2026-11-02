import { useState } from 'react'
import type { Point, Quote } from '../data/prices'
import { isPriced, labelOf, parseAmount, priceKey, type ManualPosition, type Position } from '../domain/portfolio'
import {
  annualRates,
  calibrate,
  candidate,
  fixedRate,
  monteCarlo,
  portfolioDaily,
  riskContribution,
  searchPortfolios,
  type Candidate,
  type Rates,
  type Snapshots,
} from '../domain/portfolioLab'
import { alignByDay, correlation, dailyReturns, lastMonths, portfolioRisk } from '../domain/quant'
import { money, pct, ratio, shortMoney } from './format'
import { ChartTable, LineChart } from './LineChart'
import type { Benchmarks } from './useBenchmarks'
import type { HistoryState } from './useHistory'

const WAIT = 'Os cálculos aparecem quando o histórico carregar.'
const MIN_RETURNS = 21 // cerca de um mês de pregões
const MIN_CALIBRATION = 200 // menos que isso, a média do passado diz pouco para extrapolar anos
const CLOUD_SIZE = 400 // quantas das carteiras sorteadas aparecem no gráfico
const HORIZONS = [
  { months: 12, label: '1 ano' },
  { months: 60, label: '5 anos' },
  { months: 120, label: '10 anos' },
]

type Held = { key: string; label: string; points: Point[]; value: number }
type Props = { history: HistoryState; benchmarks: Benchmarks; positions: Position[]; quotes: Quote[]; snapshots: Snapshots }

const percent = (n: number) => `${Math.round(n * 100)}%`
const twoDecimals = (n: number) => n.toFixed(2).replace('.', ',')
const brDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(2, 4)}`

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="row">
      <span>{label}</span>
      <span className={tone ? `num ${tone}` : 'num'}>{value}</span>
    </div>
  )
}

// Laranja quando andam juntos, azul quando andam ao contrário, cinza perto de zero. O número fica na célula.
function heatColor(c: number): string {
  const hue = c >= 0 ? 'var(--viz-2)' : 'var(--viz-1)'
  return `color-mix(in srgb, ${hue} ${Math.round(Math.abs(c) * 60)}%, var(--card2))`
}

function CorrelationMap({ held, returns }: { held: Held[]; returns: number[][] }) {
  return (
    <div className="table-wrap">
      <table className="heat" aria-label="Correlação entre os ativos">
        <thead>
          <tr>
            <td />
            {held.map((h) => (
              <th key={h.key} scope="col">
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {held.map((row, i) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              {held.map((col, j) => {
                const c = correlation(returns[i], returns[j])
                return (
                  <td key={col.key} className="num" style={c == null ? undefined : { background: heatColor(c) }}>
                    {c == null ? '—' : twoDecimals(c)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Uma linha sem comprimento e de ponta redonda vira um ponto redondo, mesmo com o gráfico esticado na largura.
function RiskCloud({ cloud, marks }: { cloud: Candidate[]; marks: { label: string; color: string; point: Candidate }[] }) {
  const all = [...cloud, ...marks.map((m) => m.point)]
  const [xs, ys] = [all.map((c) => c.vol), all.map((c) => c.ret)]
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const left = (v: number) => ((v - minX) / (maxX - minX || 1)) * 100
  const top = (v: number) => (1 - (v - minY) / (maxY - minY || 1)) * 100
  return (
    <figure className="chart-fig">
      <div className="chart-plot">
        <div className="chart-box cloud">
          <svg className="chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Risco e retorno de ${cloud.length} carteiras sorteadas, com a sua marcada; os valores estão na tabela`}>
            <path d={cloud.map((c) => `M${left(c.vol).toFixed(2)} ${top(c.ret).toFixed(2)}h0`).join('')} stroke="var(--bd)" strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {marks.map((m) => (
            <span key={m.label} className="chart-dot" title={`${m.label}: risco ${ratio(m.point.vol)}, retorno ${ratio(m.point.ret)}`} style={{ left: `${left(m.point.vol)}%`, top: `${top(m.point.ret)}%`, background: m.color, pointerEvents: 'auto' }} />
          ))}
        </div>
        <div className="chart-y" aria-hidden="true">
          <span>{ratio(maxY)}</span>
          <span>Retorno ao ano</span>
          <span>{ratio(minY)}</span>
        </div>
        <div className="chart-x" aria-hidden="true">
          <span>{ratio(minX)}</span>
          <span>Risco ao ano</span>
          <span>{ratio(maxX)}</span>
        </div>
      </div>
      <p className="legend-line">
        {marks.map((m) => (
          <span key={m.label}>
            <i className="swatch" style={{ background: m.color }} />
            {m.label}
          </span>
        ))}
      </p>
    </figure>
  )
}

function MinRiskCard({ held, returns, rates }: { held: Held[]; returns: number[][]; rates: Rates }) {
  const total = held.reduce((a, h) => a + h.value, 0)
  const search = searchPortfolios(returns, rates.cdi ?? 0)
  const today = candidate(returns, held.map((h) => h.value / total))
  const columns = [today, search.minRisk, search.bestSharpe]
  const marks = [
    { label: 'Sua carteira', color: 'var(--viz-1)', point: today },
    { label: 'Menor risco', color: 'var(--viz-2)', point: search.minRisk },
    { label: 'Melhor retorno por risco', color: 'var(--viz-3)', point: search.bestSharpe },
  ]
  return (
    <>
      <RiskCloud cloud={search.cloud.slice(0, CLOUD_SIZE)} marks={marks} />
      <div className="table-wrap">
        <table className="results" aria-label="Pesos de cada carteira">
          <thead>
            <tr>
              <th scope="col">Ativo</th>
              <th scope="col">Hoje</th>
              <th scope="col">Menor risco</th>
              <th scope="col">Melhor retorno por risco</th>
            </tr>
          </thead>
          <tbody>
            {held.map((h, i) => (
              <tr key={h.key}>
                <th scope="row">{h.label}</th>
                {columns.map((c, j) => (
                  <td key={j} className="num">
                    {percent(c.weights[i])}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">Risco ao ano</th>
              {columns.map((c, j) => (
                <td key={j} className="num">
                  {ratio(c.vol)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Retorno ao ano</th>
              {columns.map((c, j) => (
                <td key={j} className="num">
                  {ratio(c.ret)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}

function ProjectionBody({ positions, held, rates, amountValue }: { positions: Position[]; held: Held[]; rates: Rates; amountValue: number }) {
  const manual = positions.filter((p): p is ManualPosition => !isPriced(p))
  const safe = manual.reduce((a, p) => a + p.amount, 0)
  const risky = held.reduce((a, h) => a + h.value, 0)
  const safeRates = manual.map((p) => fixedRate(p, rates))
  if (safeRates.includes(null)) return <p className="muted">Os índices do Banco Central ainda não carregaram.</p>
  const safeYear = safe > 0 ? manual.reduce((a, p, i) => a + p.amount * (safeRates[i] as number), 0) / safe : 0
  // A parte com cotação usa todo o histórico em comum dos ativos, com os pesos de hoje.
  const daily = held.length === 0 ? [] : portfolioDaily(alignByDay(held.map((h) => h.points)).map(dailyReturns), held.map((h) => h.value / risky))
  if (held.length > 0 && daily.length < MIN_CALIBRATION) {
    return <p className="muted">A projeção precisa de pelo menos {MIN_CALIBRATION} pregões de histórico dos ativos com cotação.</p>
  }
  const { monthlyMean, monthlySd } = held.length === 0 ? { monthlyMean: 0, monthlySd: 0 } : calibrate(daily)
  const projection = monteCarlo({
    risky,
    safe,
    contribution: amountValue,
    riskyShare: risky / (risky + safe),
    monthlyMean,
    monthlySd,
    safeMonthly: (1 + safeYear) ** (1 / 12) - 1,
    months: 120,
  })
  const lines = [
    { label: 'Bom (90%)', values: projection.p90, color: 'var(--viz-3)' },
    { label: 'Médio (50%)', values: projection.p50, color: 'var(--viz-1)' },
    { label: 'Ruim (10%)', values: projection.p10, color: 'var(--viz-2)' },
  ]
  const dates = projection.p50.map((_, m) => (m === 0 ? 'Hoje' : `Mês ${m}`))
  return (
    <>
      <LineChart label="Projeção do patrimônio em 10 anos, nos cenários ruim, médio e bom" dates={dates} format={shortMoney} series={lines} />
      <p className="legend-line">
        {lines.map((s) => (
          <span key={s.label}>
            <i className="swatch" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </p>
      <div className="table-wrap">
        <table className="results" aria-label="Cenários da projeção">
          <thead>
            <tr>
              <th scope="col">Em</th>
              <th scope="col">Ruim</th>
              <th scope="col">Médio</th>
              <th scope="col">Bom</th>
            </tr>
          </thead>
          <tbody>
            {HORIZONS.map((h) => (
              <tr key={h.months}>
                <th scope="row">{h.label}</th>
                <td className="num">{shortMoney(projection.p10[h.months])}</td>
                <td className="num">{shortMoney(projection.p50[h.months])}</td>
                <td className="num">{shortMoney(projection.p90[h.months])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        {held.length > 0 && <>Ativos com cotação: {ratio(Math.exp(monthlyMean * 12) - 1)} ao ano, como no histórico guardado, sorteando as oscilações. </>}
        {safe > 0 && <>Renda fixa, fundos e previdência: {ratio(safeYear)} ao ano, pelos índices de hoje; sem índice informado, rendem o CDI. </>}
        O aporte se divide como a carteira de hoje.
      </p>
    </>
  )
}

function ProjectionCard({ positions, held, rates }: { positions: Position[]; held: Held[]; rates: Rates }) {
  const [amountText, setAmountText] = useState('500')
  const amount = parseAmount(amountText)
  const error = amount.ok ? null : 'Informe um aporte válido.'
  return (
    <section className="card wide" aria-label="Projeção com aportes">
      <h2>Projeção com aportes</h2>
      <div className="field">
        <label htmlFor="proj-aporte">Aporte por mês (R$)</label>
        <input id="proj-aporte" inputMode="decimal" value={amountText} aria-invalid={error ? true : undefined} aria-describedby={error ? 'proj-aporte-err' : undefined} onChange={(e) => setAmountText(e.target.value)} />
        {error && (
          <p className="err" id="proj-aporte-err">
            {error}
          </p>
        )}
      </div>
      {positions.length === 0 && <p className="muted">Cadastre seus investimentos para ver a projeção.</p>}
      {positions.length > 0 && !held.every((h) => h.value > 0) && <p className="muted">{WAIT}</p>}
      {positions.length > 0 && held.every((h) => h.value > 0) && amount.ok && <ProjectionBody positions={positions} held={held} rates={rates} amountValue={amount.value} />}
      <p className="muted">Sorteio de 2000 caminhos a partir do passado, antes do imposto de renda. O passado pode não se repetir: é estudo, não é promessa nem recomendação.</p>
    </section>
  )
}

// Os cartões da carteira inteira: risco, menor risco, projeção e evolução. Descrevem o passado; não recomendam.
export function PortfolioLab({ history, benchmarks, positions, quotes, snapshots }: Props) {
  const rates = annualRates(benchmarks)
  const held: Held[] = positions.filter(isPriced).map((p) => {
    const key = priceKey(p)
    const points = history.series[key] ?? []
    const price = quotes.find((q) => q.symbol === key)?.price ?? points[points.length - 1]?.p ?? 0
    return { key, label: labelOf(p), points, value: p.quantity * price }
  })
  const manual = positions.reduce((a, p) => a + (isPriced(p) ? 0 : p.amount), 0)
  const returns = alignByDay(held.map((h) => lastMonths(h.points, 12))).map(dailyReturns)
  const riskReady = held.every((h) => h.value > 0) && (held.length === 0 || returns[0].length >= MIN_RETURNS)
  const risk = portfolioRisk(held.map((h, i) => ({ value: h.value, returns: returns[i] })), manual)
  const shares = riskContribution(returns, held.map((h) => h.value / risk.total))
  const days = Object.entries(snapshots).sort(([a], [b]) => a.localeCompare(b))
  const evolution = [{ label: 'Patrimônio', values: days.map(([, v]) => v), color: 'var(--viz-1)' }]
  const evolutionDates = days.map(([d]) => brDay(d))
  const growth = days.length > 1 ? days[days.length - 1][1] / days[0][1] - 1 : 0

  function riskBody() {
    if (positions.length === 0) return <p className="muted">Cadastre seus investimentos para ver o risco.</p>
    if (!riskReady) return <p className="muted">{WAIT}</p>
    return (
      <>
        <Row label="Valor da carteira" value={money(risk.total)} />
        <Row label="Volatilidade ao ano" value={ratio(risk.annualVol)} />
        <Row label="Queda possível num dia ruim (1 em 20)" value={money(risk.var95)} tone="dn" />
        <Row label="Média dos 5% piores dias" value={money(risk.cvar95)} tone="dn" />
        <Row label="Maior queda da carteira de hoje" value={pct(risk.maxDrawdown * 100)} tone="dn" />
        {held.map((h, i) => (
          <Row key={h.key} label={`Parte de ${h.label} no risco`} value={percent(shares[i])} />
        ))}
        {held.length > 1 && (
          <>
            <h3 className="sub">Correlação</h3>
            <CorrelationMap held={held} returns={returns} />
          </>
        )}
      </>
    )
  }

  function minRiskBody() {
    if (held.length < 2) return <p className="muted">A comparação de pesos precisa de pelo menos dois ativos com cotação.</p>
    if (!riskReady) return <p className="muted">{WAIT}</p>
    return <MinRiskCard held={held} returns={returns} rates={rates} />
  }

  return (
    <>
      <section className="card wide" aria-label="Risco da carteira">
        <h2>Risco da carteira</h2>
        {riskBody()}
        <p className="muted">
          Estimativa com até 1 ano de histórico e a carteira de hoje; renda fixa, fundos e previdência entram sem oscilação. Correlação perto de 1 quer dizer que
          os dois ativos sobem e caem juntos; perto de -1, ao contrário. Não é recomendação.
        </p>
      </section>

      <section className="card wide" aria-label="Carteira de menor risco">
        <h2>Carteira de menor risco</h2>
        {minRiskBody()}
        <p className="muted">
          Sorteio de 5000 divisões entre os ativos com cotação, só com pesos positivos; a renda fixa fica de fora, porque sem oscilação ela sempre ganharia. É
          estudo do passado, antes de impostos e custos. Não é recomendação de compra ou venda.
        </p>
      </section>

      <ProjectionCard positions={positions} held={held} rates={rates} />

      <section className="card wide" aria-label="Evolução do patrimônio">
        <h2>Evolução do patrimônio</h2>
        {days.length < 2 ? (
          <p className="muted">A evolução começa agora: cada dia em que o app abre com todos os preços carregados vira um ponto, aqui e nos seus outros aparelhos.</p>
        ) : (
          <>
            <LineChart label={`Patrimônio de ${evolutionDates[0]} a ${evolutionDates[days.length - 1]}`} dates={evolutionDates} format={money} series={evolution} />
            <div className="row">
              <span>Desde {evolutionDates[0]}</span>
              <span className={`num ${growth >= 0 ? 'up' : 'dn'}`}>{pct(growth * 100)}</span>
            </div>
            <ChartTable dates={evolutionDates} format={money} series={evolution} />
            <p className="muted">Inclui os aportes e as retiradas: subir aqui não é só rendimento. Dias em que o app não abriu não têm ponto.</p>
          </>
        )}
      </section>
    </>
  )
}
