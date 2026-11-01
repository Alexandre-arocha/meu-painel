import { useEffect, useState } from 'react'
import type { Markets } from '../data/markets'
import { money, pct, points, shortMoney } from './format'

type Reading = { price: number; changePct: number | null }

// Ibovespa e S&P 500 pelo Yahoo, o dólar pela AwesomeAPI e o Bitcoin pela CoinGecko, em reais.
const TILES: { label: string; format: (n: number) => string; load: (m: Markets) => Promise<Reading | null | undefined> }[] = [
  { label: 'Ibovespa', format: points, load: (m) => m.chart('^BVSP', '5d') },
  { label: 'Dólar', format: money, load: async (m) => (await m.fx(['USD']))[0] },
  { label: 'S&P 500', format: points, load: (m) => m.chart('^GSPC', '5d') },
  { label: 'Bitcoin', format: shortMoney, load: async (m) => (await m.crypto(['bitcoin']))[0] },
]

// Reticências enquanto busca; traço quando a fonte falhou.
function valueText(r: Reading | null | undefined, loading: boolean, format: (n: number) => string): string {
  if (loading) return '…'
  return r ? format(r.price) : '—'
}

// "Mercados hoje" no Início. Cada número vem de uma busca; se uma fonte falhar, só aquele fica com traço.
export function MarketStrip({ markets }: { markets: Markets }) {
  const [readings, setReadings] = useState<(Reading | null)[] | null>(null)

  useEffect(() => {
    let alive = true
    Promise.allSettled(TILES.map((t) => t.load(markets))).then((results) => {
      if (alive) setReadings(results.map((r) => (r.status === 'fulfilled' && r.value ? r.value : null)))
    })
    return () => {
      alive = false
    }
  }, [markets])

  return (
    <ul className="markets" aria-label="Mercados hoje" aria-busy={!readings}>
      {TILES.map((t, i) => {
        const r = readings?.[i]
        return (
          <li key={t.label}>
            <span className="muted">{t.label}</span>
            <b className="num">{valueText(r, !readings, t.format)}</b>
            {r && r.changePct !== null && <span className={`num ${r.changePct >= 0 ? 'up' : 'dn'}`}>{pct(r.changePct)}</span>}
          </li>
        )
      })}
    </ul>
  )
}
