import { useState } from 'react'
import type { PriceProvider, Quote } from '../data/prices'
import { parseAmount, type Allocation, type Portfolio } from '../domain/portfolio'
import {
  annualVol,
  correlation,
  dailyReturns,
  maCrossBacktest,
  maxDrawdown,
  portfolioRisk,
  projectFixedIncome,
  rsi,
  sma,
  splitContribution,
} from '../domain/quant'
import { localDate, money, pct, ratio } from './format'
import { LineChart } from './LineChart'
import { useHistory } from './useHistory'
import { SYMBOLS } from './useQuotes'

const MIN_POINTS = 22 // média de 21 dias + 1 pregão
const COLOR = { price: 'var(--tx)', fast: 'var(--ac)', slow: 'var(--warn)', hold: 'var(--mut)' }
const SHORT = 'Histórico curto demais para os cálculos (precisa de 22 pregões).'
const WAIT = 'Os cálculos aparecem quando o histórico carregar.'

type Props = {
  makePrices: (token: string | undefined) => PriceProvider
  token: string | undefined
  portfolio: Portfolio
  target?: Allocation
  quotes: Quote[]
  now?: () => Date
  store?: Storage
}

const last = (xs: number[]) => xs[xs.length - 1]
const shares = (n: number) => `${n} ${n === 1 ? 'ação' : 'ações'}`

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
export function QuantEngine({ makePrices, token, portfolio, target, quotes, now = () => new Date(), store = localStorage }: Props) {
  const [symbol, setSymbol] = useState(SYMBOLS[0])
  const [amountText, setAmountText] = useState('1000')
  const [rateText, setRateText] = useState(String(portfolio.fixedIncome.ratePctYear ?? ''))
  const { series, error, loading } = useHistory(makePrices, token, store, localDate(now()))

  const closes = (s: string) => (series[s] ?? []).map((p) => p.p)
  const priceOf = (s: string): number | undefined => quotes.find((q) => q.symbol === s)?.price ?? last(closes(s))
  const valueOf = (s: string) => (portfolio.holdings.find((h) => h.symbol === s)?.quantity ?? 0) * (priceOf(s) ?? 0)

  function statusText(): string {
    if (loading) return 'Buscando o histórico…'
    return error ?? SHORT
  }

  const values = closes(symbol)
  const enough = values.length >= MIN_POINTS
  const slow = sma(values, 21)
  const lastSlow = slow[slow.length - 1]
  const price = priceOf(symbol) ?? 0
  const change = enough ? last(values) / values[0] - 1 : 0
  const drawdown = maxDrawdown(values)
  const strength = rsi(values)
  const bt = maCrossBacktest(values)

  const fixed = portfolio.fixedIncome.amount
  const stocks = SYMBOLS.map((s) => ({ value: valueOf(s), returns: dailyReturns(closes(s)) })).filter((x) => x.value > 0)
  const missingPrice = portfolio.holdings.some((h) => h.quantity > 0 && priceOf(h.symbol) == null)
  const hasPortfolio = fixed > 0 || portfolio.holdings.some((h) => h.quantity > 0)
  const riskReady = !missingPrice && stocks.every((x) => x.returns.length >= MIN_POINTS - 1)
  const risk = portfolioRisk(stocks, fixed)
  const corr = correlation(dailyReturns(closes('BBAS3')), dailyReturns(closes('B3SA3')))

  const amount = parseAmount(amountText)
  const amountValue = amount.ok ? amount.value : 0
  const amountError = amountValue > 0 ? null : 'Informe um aporte maior que zero.'
  const rate = rateText.trim() === '' ? null : Number(rateText.replace(',', '.'))
  const rateError = rate === null || (Number.isFinite(rate) && rate >= 0) ? null : 'Informe uma taxa de zero ou mais.'

  function riskBody() {
    if (!hasPortfolio) return <p className="muted">Preencha a carteira abaixo para ver o risco.</p>
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
        <div className="row">
          <span>Correlação BBAS3 e B3SA3</span>
          <span className="num">{corr == null ? '—' : corr.toFixed(2).replace('.', ',')}</span>
        </div>
        <div className="row">
          <span>Queda possível num dia ruim (1 em 20)</span>
          <span className="num dn">{money(risk.var95)}</span>
        </div>
      </>
    )
  }

  function simulatorBody() {
    if (!target) return <p className="muted">Defina a meta abaixo para dividir o aporte.</p>
    if (amountError) return null
    const prices = { BBAS3: priceOf('BBAS3'), B3SA3: priceOf('B3SA3') }
    if (prices.BBAS3 == null || prices.B3SA3 == null) return <p className="muted">{WAIT}</p>
    const split = splitContribution(amountValue, { fixedIncome: fixed, BBAS3: valueOf('BBAS3'), B3SA3: valueOf('B3SA3') }, target, prices)
    return (
      <>
        <div className="row">
          <span>BBAS3</span>
          <span className="num">
            {shares(split.BBAS3.shares)} · {money(split.BBAS3.value)}
          </span>
        </div>
        <div className="row">
          <span>B3SA3</span>
          <span className="num">
            {shares(split.B3SA3.shares)} · {money(split.B3SA3.value)}
          </span>
        </div>
        <div className="row">
          <span>Renda fixa</span>
          <span className="num">{money(split.fixedIncome)}</span>
        </div>
        {rate !== null && !rateError && (
          <div className="row">
            <span>Renda fixa em 12 meses a {rateText.trim()}%</span>
            <span className="num">{money(projectFixedIncome(fixed + split.fixedIncome, rate))}</span>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <section className="card wide" aria-label="Motor quantitativo">
        <div className="card-head">
          <h2>Motor quantitativo</h2>
          <div className="chips" role="group" aria-label="Ativo">
            {SYMBOLS.map((s) => (
              <button key={s} type="button" className="chip" aria-pressed={s === symbol} onClick={() => setSymbol(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
        {!enough ? (
          <p className="muted">{statusText()}</p>
        ) : (
          <>
            {error && <p className="muted">{error} Mostrando o histórico guardado.</p>}
            <LineChart
              label={`Preço de ${symbol} e médias de 9 e 21 dias nos últimos 3 meses`}
              series={[
                { values, color: COLOR.price },
                { values: sma(values, 9), color: COLOR.fast },
                { values: slow, color: COLOR.slow },
              ]}
            />
            <p className="legend-line">
              <span>
                <i className="swatch" style={{ background: COLOR.price }} />
                Preço
              </span>
              <span>
                <i className="swatch" style={{ background: COLOR.fast }} />
                Média 9 dias
              </span>
              <span>
                <i className="swatch" style={{ background: COLOR.slow }} />
                Média 21 dias
              </span>
            </p>
            <div className="metrics quant-tiles">
              <Tile label="Preço" value={money(price)} />
              <Tile label="Retorno em 3 meses" value={pct(change * 100)} tone={change >= 0 ? 'up' : 'dn'} />
              <Tile label="Volatilidade ao ano" value={ratio(annualVol(values))} />
              <Tile label="Maior queda" value={pct(drawdown * 100)} tone={drawdown < 0 ? 'dn' : undefined} />
              <Tile label="RSI 14 dias" value={strength == null ? '—' : strength.toFixed(0)} />
              <Tile label="Preço x média 21" value={lastSlow != null && price > lastSlow ? 'Acima' : 'Abaixo'} />
            </div>
          </>
        )}
      </section>

      <section className="card" aria-label="Teste de estratégia">
        <h2>Teste de estratégia</h2>
        <p className="muted">Cruzamento das médias de 9 e 21 dias em {symbol}.</p>
        {enough ? (
          <>
            <LineChart
              height={110}
              label={`Resultado da estratégia e de comprar e segurar em ${symbol}`}
              series={[
                { values: bt.hold, color: COLOR.hold },
                { values: bt.strategy, color: COLOR.fast },
              ]}
            />
            <ResultRow label="Estratégia" color={COLOR.fast} change={last(bt.strategy) - 1} />
            <ResultRow label="Comprar e segurar" color={COLOR.hold} change={last(bt.hold) - 1} />
            <div className="row">
              <span>Trocas de posição</span>
              <span className="num">{bt.trades}</span>
            </div>
          </>
        ) : (
          <p className="muted">{WAIT}</p>
        )}
        <p className="muted">Mostra o que teria acontecido no passado. Não é recomendação de compra ou venda.</p>
      </section>

      <section className="card" aria-label="Risco da carteira">
        <h2>Risco da carteira</h2>
        {riskBody()}
        <p className="muted">Estimativa com os últimos 3 meses; a renda fixa entra sem oscilação. Não é recomendação.</p>
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
        <p className="muted">Divide o aporte pelo que falta para cada parte chegar à meta. Conta, não recomendação.</p>
      </section>
    </>
  )
}
