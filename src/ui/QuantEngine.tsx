import { useState } from 'react'
import type { NewsItem } from '../data/news'
import type { Quote } from '../data/prices'
import { CLASSES, isPriced, labelOf, parseAmount, priceKey, totals, type ClassTargets, type Position } from '../domain/portfolio'
import {
  alignPoints,
  annualVol,
  backtest,
  beta,
  bollingerPosition,
  bollingerSignal,
  cdiIndex,
  correlation,
  dailyReturns,
  hasMonths,
  indexTo100,
  lastMonths,
  macd,
  maCrossSignal,
  maxDrawdown,
  momentumSignal,
  projectFixedIncome,
  rsi,
  rsiSignal,
  sharpe,
  sma,
  sortino,
  splitByClass,
  withLivePrice,
} from '../domain/quant'
import { computeSignal } from '../domain/signal'
import { dayMonth, dayMonthYear, money, pct, ratio } from './format'
import { ChartTable, LineChart } from './LineChart'
import type { Benchmarks } from './useBenchmarks'
import type { HistoryState } from './useHistory'

const MIN_POINTS = 22 // média de 21 dias + 1 pregão
const TRADE_COST = 0.001 // 0,1% a cada troca de posição
const PERIODS = [
  { months: 3, label: '3 meses', fast: 9, slow: 21 },
  { months: 12, label: '1 ano', fast: 50, slow: 200 },
  { months: 60, label: '5 anos', fast: 50, slow: 200 },
]
// Cores que quem tem daltonismo também separa, nos dois temas; "comprar e segurar" fica em cinza, como referência.
const COLOR = { price: 'var(--viz-1)', fast: 'var(--viz-2)', slow: 'var(--viz-3)', hold: 'var(--mut)' }
const SHORT = 'Histórico curto demais para os cálculos (precisa de 22 pregões).'
const WAIT = 'Os cálculos aparecem quando o histórico carregar.'
const NO_ASSET = 'Cadastre um investimento com cotação (ação, FII, ETF, BDR, exterior, cripto ou moeda) para ver o gráfico e os indicadores.'
const EXPLAIN: [string, string][] = [
  ['Preço ajustado', 'Cada preço antigo é reduzido pelos proventos pagos depois dele, como dividendos e JCP. Assim o retorno conta o que o acionista recebeu. Ativos de fora aparecem em reais, pelo dólar de cada dia.'],
  ['Retorno', 'Quanto o preço ajustado subiu ou caiu desde o primeiro dia do gráfico.'],
  ['Volatilidade ao ano', 'O tamanho das oscilações de um dia para o outro, levado para um ano. Quanto maior, mais o preço sobe e desce.'],
  ['Maior queda', 'A pior queda de um topo até um fundo no período.'],
  ['RSI 14 dias', 'Vai de 0 a 100. Acima de 70, o preço subiu rápido nos últimos 14 pregões. Abaixo de 30, caiu rápido.'],
  ['Preço x média', 'Mostra se o preço de agora está acima ou abaixo da média longa: 21 pregões (cerca de um mês) em 3 meses; 200 pregões em 1 ano e em 5 anos.'],
  ['MACD x sinal', 'Diferença entre as médias exponenciais de 12 e 26 dias. Acima do sinal, a média de 9 dias dessa diferença, o movimento recente ganha força.'],
  ['Bollinger', 'Onde o preço está entre as bandas de 2 desvios em torno da média de 20 dias: 0% na banda de baixo, 100% na de cima. Pode passar dos dois lados.'],
  ['Sharpe', 'Quanto o ativo rendeu acima do CDI para cada unidade de oscilação, ao ano. Quanto maior, melhor foi a troca entre retorno e risco.'],
  ['Sortino', 'Como o Sharpe, mas só as quedas contam como risco.'],
  ['Beta', 'Quanto o ativo costuma andar a cada 1% do Ibovespa. Beta 1,5: 1,5% em média.'],
  ['Correlação com o Ibovespa', 'De -1 a 1. Perto de 1, o ativo e o índice sobem e caem juntos.'],
]
function macdText(line: number | null, signal: number | null): string {
  if (line == null || signal == null) return '—'
  return line > signal ? 'Acima' : 'Abaixo'
}

const signalClass = { 'mais positivo': 'up', 'mais negativo': 'dn', neutro: 'mut', 'sem dados': 'mut' } as const

type Props = {
  history: HistoryState
  benchmarks?: Benchmarks
  positions: Position[]
  quotes: Quote[]
  targets?: ClassTargets
  news?: NewsItem[]
  now?: Date
}

const last = (xs: number[]) => xs[xs.length - 1]
const NO_BENCHMARKS: Benchmarks = { ibov: [], cdi: [], selic: [], ipca: [] }
const list = new Intl.ListFormat('pt-BR')
const twoDecimals = (n: number | null) => (n == null ? '—' : n.toFixed(2).replace('.', ','))

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'dn' }) {
  return (
    <div className="metric">
      <span className="muted">{label}</span>
      <b className={tone ? `num ${tone}` : 'num'}>{value}</b>
    </div>
  )
}

function ResultRow({ label, color, change }: { label: string; color: string; change: number }) {
  return (
    <div className="row">
      <span>
        <i className="swatch" style={{ background: color }} />
        {label}
      </span>
      <span className={`num ${change >= 0 ? 'up' : 'dn'}`}>{pct(change * 100)}</span>
    </div>
  )
}

// Motor quantitativo: indicadores, comparação, teste de estratégia e simulador de aportes. Descreve o passado; não recomenda.
export function QuantEngine({ history, benchmarks = NO_BENCHMARKS, positions, quotes, targets, news = [], now = new Date() }: Props) {
  const [picked, setPicked] = useState<string | null>(null)
  const [months, setMonths] = useState(3)
  const [amountText, setAmountText] = useState('1000')
  const [rateText, setRateText] = useState('')
  const { series, error, loading } = history

  const assets = [...new Map(positions.filter(isPriced).map((p) => [priceKey(p), labelOf(p)])).entries()].map(([key, label]) => ({ key, label }))
  const asset = assets.find((a) => a.key === picked) ?? assets[0]
  const key = asset?.key ?? ''
  const quoteOf = (k: string) => quotes.find((q) => q.symbol === k)
  // Os últimos 3 meses, terminando na cotação ao vivo, para o gráfico e os números baterem com o preço de agora.
  const merged = Object.fromEntries(assets.map((a) => [a.key, withLivePrice(lastMonths(series[a.key] ?? [], 3), quoteOf(a.key))]))
  const closes = (k: string) => (merged[k] ?? []).map((p) => p.p)
  const priceOf = (k: string): number | undefined => last(closes(k)) ?? quoteOf(k)?.price
  const prices = Object.fromEntries(
    assets.flatMap((a) => {
      const p = priceOf(a.key)
      return p === undefined ? [] : [[a.key, p] as const]
    }),
  )
  const sums = totals(positions, prices)

  function statusText(): string {
    if (loading) return 'Buscando o histórico…'
    return error ?? SHORT
  }

  // Os indicadores usam todo o histórico guardado, e o período só corta o que aparece: a média de 200 dias já vem pronta em 1 ano.
  const full = withLivePrice(series[key] ?? [], quoteOf(key))
  const fullValues = full.map((p) => p.p)
  const periods = PERIODS.filter((p) => p.months === 3 || hasMonths(full, p.months))
  const period = periods.find((p) => p.months === months) ?? periods[periods.length - 1]
  const recent = lastMonths(full, period.months)
  const values = recent.map((p) => p.p)
  const tail = <T,>(xs: T[]) => xs.slice(xs.length - values.length)
  const dateOf = period.months > 3 ? dayMonthYear : dayMonth
  const dates = recent.map((p) => dateOf(p.t))
  const enough = values.length >= MIN_POINTS
  const slow = tail(sma(fullValues, period.slow))
  const lastSlow = slow[slow.length - 1]
  const price = priceOf(key) ?? 0
  const change = enough ? last(values) / values[0] - 1 : 0
  const drawdown = maxDrawdown(values)
  const strength = rsi(fullValues)
  const macdNow = macd(fullValues)
  const [macdLine, macdSignal] = [macdNow.line[full.length - 1], macdNow.signal[full.length - 1]]
  const bandPosition = bollingerPosition(fullValues)
  const lines = [
    { label: 'Preço ajustado', values, color: COLOR.price },
    { label: `Média ${period.fast} dias`, values: tail(sma(fullValues, period.fast)), color: COLOR.fast },
    { label: `Média ${period.slow} dias`, values: slow, color: COLOR.slow },
  ]

  // Contra as réguas: o CDI acumulado nos dias do ativo e o Ibovespa nos dias em comum.
  const returns = dailyReturns(values)
  const cdiNow = cdiIndex(recent, benchmarks.cdi)
  const riskFree = cdiNow && dailyReturns(cdiNow)
  const [withIbov, ibov] = alignPoints([recent, benchmarks.ibov])
  const hasIbov = withIbov.length >= MIN_POINTS
  const ibovReturns = dailyReturns(ibov.map((p) => p.p))
  const assetReturns = dailyReturns(withIbov.map((p) => p.p))
  const base = hasIbov ? withIbov : recent
  const baseCdi = cdiIndex(base, benchmarks.cdi)
  const comparison = [
    { label: asset?.label ?? '', values: indexTo100(base.map((p) => p.p)), color: 'var(--viz-1)' },
    ...(hasIbov ? [{ label: 'Ibovespa', values: indexTo100(ibov.map((p) => p.p)), color: 'var(--viz-2)' }] : []),
    ...(baseCdi ? [{ label: 'CDI', values: indexTo100(baseCdi), color: 'var(--viz-3)' }] : []),
  ]
  const compareDates = base.map((p) => dateOf(p.t))
  const missing = [...(hasIbov ? [] : ['Ibovespa']), ...(baseCdi ? [] : ['CDI'])]
  const baseHundred = (v: number) => v.toFixed(1).replace('.', ',')

  // Os sinais também saem de todo o histórico; o teste só começa no primeiro dia do período, com R$ 1.
  const tests = [
    { label: `Médias ${period.fast} e ${period.slow}`, signal: maCrossSignal(fullValues, period.fast, period.slow), color: 'var(--viz-1)' },
    { label: 'RSI 30 e 70', signal: rsiSignal(fullValues), color: 'var(--viz-2)' },
    { label: 'Bollinger', signal: bollingerSignal(fullValues), color: 'var(--viz-3)' },
    { label: 'Momento de 3 meses', signal: momentumSignal(fullValues), color: 'var(--viz-4)' },
  ].map(({ signal, ...s }) => ({ ...s, result: backtest(values, tail(signal), TRADE_COST) }))
  const results = [
    ...tests.map((s) => ({ label: s.label, values: s.result.strategy, color: s.color, trades: s.result.trades as number | null })),
    { label: 'Comprar e segurar', values: tests[0].result.hold, color: COLOR.hold, trades: null },
  ]
  const growth = (v: number) => pct((v - 1) * 100)
  // Só a B3 e os EUA têm busca de notícias por ativo.
  const hasNews = key.startsWith('b3:') || key.startsWith('us:')
  const signal = computeSignal(news.filter((i) => i.tags.includes(key)), quoteOf(key), now)

  const missingPrice = sums.missing.length > 0

  const amount = parseAmount(amountText)
  const amountValue = amount.ok ? amount.value : 0
  const amountError = amountValue > 0 ? null : 'Informe um aporte maior que zero.'
  const rate = rateText.trim() === '' ? null : Number(rateText.replace(',', '.'))
  const rateError = rate === null || (Number.isFinite(rate) && rate >= 0) ? null : 'Informe uma taxa de zero ou mais.'

  function simulatorBody() {
    if (!targets) return <p className="muted">Defina as metas por classe abaixo para dividir o aporte.</p>
    if (amountError) return null
    if (missingPrice) return <p className="muted">{WAIT}</p>
    const split = splitByClass(amountValue, sums.byClass, targets)
    return (
      <>
        {CLASSES.filter((c) => targets[c.id] > 0).map((c) => (
          <div className="row" key={c.id}>
            <span>{c.label}</span>
            <span className="num">{money(split[c.id])}</span>
          </div>
        ))}
        {rate !== null && !rateError && (
          <div className="row">
            <span>Renda fixa em 12 meses a {rateText.trim()}%</span>
            <span className="num">{money(projectFixedIncome(sums.byClass['renda-fixa'] + split['renda-fixa'], rate))}</span>
          </div>
        )}
      </>
    )
  }

  function engineBody() {
    if (!asset) return <p className="muted">{NO_ASSET}</p>
    if (!enough) return <p className="muted">{statusText()}</p>
    return (
      <>
        {error && <p className="muted">{error} Mostrando o histórico guardado.</p>}
        <LineChart label={`Preço ajustado de ${asset.label} e médias de ${period.fast} e ${period.slow} dias em ${period.label}`} dates={dates} format={money} series={lines} />
        <p className="legend-line">
          {lines.map((s) => (
            <span key={s.label}>
              <i className="swatch" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </p>
        <div className="metrics quant-tiles" role="group" aria-label="Indicadores">
          <Tile label="Preço" value={money(price)} />
          <Tile label={`Retorno em ${period.label}`} value={pct(change * 100)} tone={change >= 0 ? 'up' : 'dn'} />
          <Tile label="Volatilidade ao ano" value={ratio(annualVol(values))} />
          <Tile label="Maior queda" value={pct(drawdown * 100)} tone={drawdown < 0 ? 'dn' : undefined} />
          <Tile label="RSI 14 dias" value={strength == null ? '—' : strength.toFixed(0)} />
          <Tile label={`Preço x média ${period.slow}`} value={lastSlow != null && price > lastSlow ? 'Acima' : 'Abaixo'} />
          <Tile label="MACD x sinal" value={macdText(macdLine, macdSignal)} />
          <Tile label="Bollinger" value={bandPosition == null ? '—' : `${Math.round(bandPosition * 100)}%`} />
          <Tile label="Sharpe" value={twoDecimals(riskFree && sharpe(returns, riskFree))} />
          <Tile label="Sortino" value={twoDecimals(riskFree && sortino(returns, riskFree))} />
          <Tile label="Beta" value={twoDecimals(hasIbov ? beta(assetReturns, ibovReturns) : null)} />
          <Tile label="Correlação com o Ibovespa" value={twoDecimals(hasIbov ? correlation(assetReturns, ibovReturns) : null)} />
        </div>
        {hasNews && (
          <p className="signal">
            Sinal das notícias: <span className={`pill ${signalClass[signal.label]}`}>{signal.label}</span>
            {signal.agreesWithPrice !== null && (
              <span className="muted"> {signal.agreesWithPrice ? 'O preço do dia está na mesma direção.' : 'O preço do dia está na direção oposta.'}</span>
            )}
          </p>
        )}
        <details className="more-info">
          <summary>Como ler os números</summary>
          <dl>
            {EXPLAIN.map(([term, text]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        </details>
        <ChartTable dates={dates} format={money} series={lines} />
      </>
    )
  }

  return (
    <>
      <section className="card wide" aria-label="Motor quantitativo">
        <div className="card-head">
          <h2>Motor quantitativo</h2>
          {assets.length > 0 && (
            <div className="chips" role="group" aria-label="Ativo">
              {assets.map((a) => (
                <button key={a.key} type="button" className="chip" aria-pressed={a.key === key} onClick={() => setPicked(a.key)}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {assets.length > 0 && periods.length > 1 && (
          <div className="chips" role="group" aria-label="Período">
            {periods.map((p) => (
              <button key={p.months} type="button" className="chip" aria-pressed={p === period} onClick={() => setMonths(p.months)}>
                {p.label}
              </button>
            ))}
          </div>
        )}
        {engineBody()}
      </section>

      <section className="card wide" aria-label="Comparação">
        <h2>Comparação</h2>
        {asset && enough ? (
          <>
            {missing.length > 0 && (
              <p className="muted">
                {list.format(missing)} {missing.length > 1 ? 'indisponíveis' : 'indisponível'} agora.
              </p>
            )}
            {missing.length < 2 && (
              <>
                <LineChart label={`${list.format(comparison.map((s) => s.label))} em base 100, ${period.label}`} dates={compareDates} format={baseHundred} series={comparison} />
                {comparison.map((s) => (
                  <ResultRow key={s.label} label={s.label} color={s.color} change={last(s.values) / 100 - 1} />
                ))}
                <ChartTable dates={compareDates} format={baseHundred} series={comparison} />
              </>
            )}
          </>
        ) : (
          <p className="muted">{asset ? WAIT : 'A comparação aparece quando houver um ativo com cotação.'}</p>
        )}
        <p className="muted">Tudo começa em 100 no primeiro dia em comum, para comparar quanto cada um rendeu no período.</p>
      </section>

      <section className="card wide" aria-label="Teste de estratégia">
        <h2>Teste de estratégia</h2>
        {asset && enough ? (
          <>
            <LineChart label={`Resultado das estratégias em ${asset.label}, ${period.label}`} dates={dates} format={growth} series={results} />
            <div className="table-wrap">
              <table className="results" aria-label={`Estratégias em ${asset.label}, ${period.label}`}>
                <thead>
                  <tr>
                    <th scope="col">Estratégia</th>
                    <th scope="col">Retorno</th>
                    <th scope="col">Maior queda</th>
                    <th scope="col">Trocas</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((s) => {
                    const gain = last(s.values) - 1
                    return (
                      <tr key={s.label}>
                        <th scope="row">
                          <i className="swatch" style={{ background: s.color }} />
                          {s.label}
                        </th>
                        <td className={`num ${gain >= 0 ? 'up' : 'dn'}`}>{pct(gain * 100)}</td>
                        <td className="num">{pct(maxDrawdown(s.values) * 100)}</td>
                        <td className="num">{s.trades ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ChartTable dates={dates} format={growth} series={results} />
          </>
        ) : (
          <p className="muted">{asset ? WAIT : 'O teste aparece quando houver um ativo com cotação.'}</p>
        )}
        <p className="muted">
          Cada troca de posição paga 0,1% de custo; fora do ativo, o dinheiro fica parado, sem render CDI. Mostra o que teria acontecido no passado. Não é
          recomendação de compra ou venda.
        </p>
      </section>

      <section className="card" aria-label="Simulador de aportes">
        <h2>Simulador de aportes</h2>
        <div className="two">
          <div className="field">
            <label htmlFor="sim-aporte">Quanto vai aportar (R$)</label>
            <input
              id="sim-aporte"
              inputMode="decimal"
              value={amountText}
              aria-invalid={amountError ? true : undefined}
              aria-describedby={amountError ? 'sim-aporte-err' : undefined}
              onChange={(e) => setAmountText(e.target.value)}
            />
            {amountError && (
              <p className="err" id="sim-aporte-err">
                {amountError}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="sim-taxa">Renda fixa ao ano (%)</label>
            <input
              id="sim-taxa"
              inputMode="decimal"
              value={rateText}
              placeholder="11"
              aria-invalid={rateError ? true : undefined}
              aria-describedby={rateError ? 'sim-taxa-err' : undefined}
              onChange={(e) => setRateText(e.target.value)}
            />
            {rateError && (
              <p className="err" id="sim-taxa-err">
                {rateError}
              </p>
            )}
          </div>
        </div>
        {simulatorBody()}
        <p className="muted">
          Divide o aporte pelo que falta para cada classe chegar à meta; dentro da classe, a escolha do ativo é sua. A projeção da renda fixa não desconta o
          imposto de renda. Conta, não recomendação.
        </p>
      </section>
    </>
  )
}
