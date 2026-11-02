import { useEffect, useState } from 'react'
import { loadSnapshots, saveSnapshots } from '../data/storage'
import { recordSnapshot, type Snapshots } from '../domain/portfolioLab'

// Grava o patrimônio do dia quando todos os preços carregaram (total diferente de null). Só escreve quando o valor muda.
export function useSnapshots(total: number | null, today: string, store: Storage): Snapshots {
  const [snapshots, setSnapshots] = useState<Snapshots>(() => loadSnapshots(store))

  useEffect(() => {
    if (total === null || total <= 0) return
    const current = loadSnapshots(store)
    const next = recordSnapshot(current, today, total)
    if (next[today] === current[today]) return
    saveSnapshots(next, store)
    setSnapshots(next)
  }, [total, today, store])

  return snapshots
}
