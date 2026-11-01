import { useState } from 'react'
import type { NewsItem } from '../data/news'
import type { Quote } from '../data/prices'
import { CLASSES, isPriced, labelOf, parseAmount, priceKey, totals, type ClassTargets, type Position } from '../domain/portfolio'
import {
  alignByDay,
  annualVol,
  correlation,
  dailyReturns,
  lastMonths,
  maCrossBacktest,
  maxDrawdown,
  portfolioRisk,
  projectFixedIncome,
  rsi,
  sma,
  splitByClass,
  withLivePrice,
} from '../domain/quant'
import { computeSignal } from '../domain/signal'
import { dayMonth, money, pct, ratio } from './format'
import { ChartTable, LineChart } from './LineChart'
import type { HistoryState } from './useHistory'

const MIN_POINTS = 22 // média de 21 dias + 1 pregão
// Cores que quem tem daltonismo também separa, nos dois temas; "comprar e segurar" fica em cinza, como referência.
const COLOR = { price: 'var(--viz-1)', fast: 'var(--viz-2)', slow: 'var(--viz-3)', strategy: 'var(--viz-1)', hold: 'var(--mut)' }
const SHORT = 'Histórico curto demais para os cálculos (precisa de 22 pregões).'
const WAIT = 'Os cálculos aparecem quando o histórico carregar.'
const NO_ASSET = 'Cadastre um investimento com cotação (ação, FII, ETF, BDR, exterior, cripto ou moeda) para ver o gráfico e os indicadores.'
const EXPLAIN: [string, string][] = [
  ['Preço ajustado', 'Cada preço antigo é reduzido pelos proventos pagos depois dele, como dividendos e JCP. Assim o retorno conta o que o acionista recebeu. Ativos de fora aparecem em reais, pelo dólar de cada dia.'],
  ['Retorno em 3 meses', 'Quanto o preço ajustado subiu ou caiu desde o primeiro dia do gráfico.'],
  ['Volatilidade ao ano', 'O tamanho das oscilações de um dia para o outro, levado para um ano. Quanto maior, mais o preço sobe e desce.'],
  ['Maior queda', 'A pior queda de um topo até um fundo no período.'],
  ['RSI 14 dias', 'Vai de 0 a 100. Acima de 70, o preço subiu rápido nos últimos 14 pregões. Abaixo de 30, caiu rápido.'],
  ['Preço x média 21', 'Mostra se o preço de agora está acima ou abaixo da média dos últimos 21 pregões, cerca de um mês.'],
]
const signalClass = { 'mais positivo': 'up', 'mais negativo': 'dn', neutro: 'mut', 'sem dados': 'mut' } as const

type Props = {
  history: HistoryState
  positions: Position[]
  quotes: Quote[]
  targets?: ClassTargets
  news?: NewsItem[]
  now?: Date
}

const last = (xs: number[]) => xs[xs.length - 1]

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

// Motor quantitativo: indicadores, teste de estratégia, risco e simulador de aportes. Descreve o passado; não recomenda.
export function QuantEngine({ history, positions, quotes, targets, news = [], now = new Date() }: Props) {
  const [picked, setPicked] = useState<string | null>(null)
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

  const values = closes(key)
  const dates = (merged[key] ?? []).map((p) => dayMonth(p.t))
  const enough = values.length >= MIN_POINTS
  const slow = sma(values, 21)
  const lastSlow = slow[slow.length - 1]
  const price = priceOf(key) ?? 0
  const change = enough ? last(values) / values[0] - 1 : 0
  const drawdown = maxDrawdown(values)
  const strength = rsi(values)
  const bt = maCrossBacktest(values)
  const lines = [
    { label: 'Preço ajustado', values, color: COLOR.price },
    { label: 'Média 9 dias', values: sma(values, 9), color: COLOR.fast },
    { label: 'Média 21 dias', values: slow, color: COLOR.slow },
  ]
  const results = [
    { label: 'Estratégia', values: bt.strategy, color: COLOR.strategy },
    { label: 'Comprar e segurar', values: bt.hold, color: COLOR.hold },
  ]
  const growth = (v: number) => pct((v - 1) * 100)
  // Só a B3 e os EUA têm busca de notícias por ativo.
  const hasNews = key.startsWith('b3:') || key.startsWith('us:')
  const signal = computeSignal(news.filter((i) => i.tags.includes(key)), quoteOf(key), now)

  const held = positions
    .filter(isPriced)
    .map((p) => ({ key: priceKey(p), label: labelOf(p), value: p.quantity * (priceOf(priceKey(p)) ?? 0) }))
    .filter((h) => h.value > 0)
  const heldCloses = alignByDay(held.map((h) => merged[h.key] ?? []))
  const stocks = held.map((h, i) => ({ value: h.value, returns: dailyReturns(heldCloses[i]) }))
  const manual = positions.reduce((a, p) => a + (isPriced(p) ? 0 : p.amount), 0)
  const missingPrice = sums.missing.length > 0
  const riskReady = !missingPrice && stocks.every((x) => x.returns.length >= MIN_POINTS - 1)
  const risk = portfolioRisk(stocks, manual)
  const [first, second] = [...held].sort((a, b) => b.value - a.value)
  const pair = first && second ? alignByDay([merged[first.key] ?? [], merged[second.key] ?? []]) : null
  const corr = pair ? correlation(dailyReturns(pair[0]), dailyReturns(pair[1])) : null

  const amount = parseAmount(amountText)
  const amountValue = amount.ok ? amount.value : 0
  const amountError = amountValue > 0 ? null : 'Informe um aporte maior que zero.'
  const rate = rateText.trim() === '' ? null : Number(rateText.replace(',', '.'))
  const rateError = rate === null || (Number.isFinite(rate) && rate >= 0) ? null : 'Informe uma taxa de zero ou mais.'

  function riskBody() {
    if (positions.length === 0) return <p className="muted">Cadastre seus investimentos para ver o risco.</p>
    if (!riskReady) return <p className="muted">{WAIT}</p>
    return (
      <>
        <div className="row">
          <span>Valor da carteira</span>
          <span className="num">{money(risk.total)}</span>
        </div>
        <div className="row">
          <span>Volatilidade ao ano</span>
          <span className="num">{ratio(risk.annualVol)}</span>
        </div>
        {first && second && (
          <div className="row">
            <span>
              Correlação {first.label} e {second.label}
            </span>
            <span className="num">{corr == null ? '—' : corr.toFixed(2).replace('.', ',')}</span>
          </div>
        )}
        <div className="row">
          <span>Queda possível num dia ruim (1 em 20)</span>
          <span className="num dn">{money(risk.var95)}</span>
        </div>
      </>
    )
  }

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
        <LineChart label={`Preço ajustado de ${asset.label} e médias de 9 e 21 dias nos últimos 3 meses`} dates={dates} format={money} series={lines} />
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
          <Tile label="Retorno em 3 meses" value={pct(change * 100)} tone={change >= 0 ? 'up' : 'dn'} />
          <Tile label="Volatilidade ao ano" value={ratio(annualVol(values))} />
          <Tile label="Maior queda" value={pct(drawdown * 100)} tone={drawdown < 0 ? 'dn' : undefined} />
          <Tile label="RSI 14 dias" value={strength == null ? '—' : strength.toFixed(0)} />
          <Tile label="Preço x média 21" value={lastSlow != null && price > lastSlow ? 'Acima' : 'Abaixo'} />
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
        {engineBody()}
      </section>

      <section className="card" aria-label="Teste de estratégia">
        <h2>Teste de estratégia</h2>
        {asset && <p className="muted">Cruzamento das médias de 9 e 21 dias em {asset.label}.</p>}
        {asset && enough ? (
          <>
            <LineChart height={110} label={`Resultado da estratégia e de comprar e segurar em ${asset.label}`} dates={dates} format={growth} series={results} />
            {results.map((s) => (
              <ResultRow key={s.label} label={s.label} color={s.color} change={last(s.values) - 1} />
            ))}
            <div className="row">
              <span>Trocas de posição</span>
              <span className="num">{bt.trades}</span>
            </div>
            <ChartTable dates={dates} format={growth} series={results} />
          </>
        ) : (
          <p className="muted">{asset ? WAIT : 'O teste aparece quando houver um ativo com cotação.'}</p>
        )}
        <p className="muted">Mostra o que teria acontecido no passado. Não é recomendação de compra ou venda.</p>
      </section>

      <section className="card" aria-label="Risco da carteira">
        <h2>Risco da carteira</h2>
        {riskBody()}
        <p className="muted">
          Estimativa com os últimos 3 meses; renda fixa, fundos e previdência entram sem oscilação. Correlação perto de 1 quer dizer que os dois maiores
          ativos sobem e caem juntos. Não é recomendação.
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
