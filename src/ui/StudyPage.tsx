import { useMemo, useState, type FormEvent } from 'react'
import { SEED_QUESTIONS } from '../data/questions'
import { loadAttempts, loadCustomQuestions, saveAttempts, saveCustomQuestions } from '../data/storage'
import { parseQuestions, pickNext, statsBySubject, wrongQuestions, type Attempt, type Question } from '../domain/study'
import { QuestionView } from './QuestionView'

type Mode = 'livre' | 'erros'
type Props = { rand?: () => number; now?: () => Date; store?: Storage }

export function StudyPage({ rand = Math.random, now = () => new Date(), store = localStorage }: Props) {
  const [custom, setCustom] = useState<Question[]>(() => loadCustomQuestions(store))
  const questions = useMemo(() => {
    const seedIds = new Set(SEED_QUESTIONS.map((q) => q.id))
    return [...SEED_QUESTIONS, ...custom.filter((q) => !seedIds.has(q.id))]
  }, [custom])
  const [attempts, setAttempts] = useState<Attempt[]>(() => loadAttempts(store))
  const [mode, setMode] = useState<Mode>('livre')
  const [subject, setSubject] = useState('')
  const [current, setCurrent] = useState<Question | undefined>(() => pickNext(questions, attempts, { mode: 'livre' }, rand))
  const [chosen, setChosen] = useState<number | null>(null)
  const [importText, setImportText] = useState('')
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const subjects = [...new Set(questions.map((q) => q.subject))]
  const stats = statsBySubject(questions, attempts).filter((s) => s.answered > 0)
  const wrong = wrongQuestions(questions, attempts)

  function next(m: Mode = mode, s: string = subject) {
    setChosen(null)
    setCurrent(pickNext(questions, attempts, { mode: m, subject: s || undefined }, rand, current?.id))
  }

  function changeMode(m: Mode) {
    setMode(m)
    next(m)
  }

  function answer(i: number) {
    if (!current || chosen !== null) return
    setChosen(i)
    const list = [...attempts, { questionId: current.id, correct: i === current.answer, at: now().toISOString() }]
    setAttempts(list)
    saveAttempts(list, store)
  }

  function importQuestions(e: FormEvent) {
    e.preventDefault()
    const r = parseQuestions(importText)
    if (!r.ok) {
      setImportMsg({ ok: false, text: r.error })
      return
    }
    const merged = [...custom.filter((c) => !r.questions.some((q) => q.id === c.id)), ...r.questions]
    setCustom(merged)
    saveCustomQuestions(merged, store)
    setImportText('')
    const n = r.questions.length
    setImportMsg({ ok: true, text: n === 1 ? '1 questão importada.' : `${n} questões importadas.` })
  }

  return (
    <div className="page">
      <div className="grid">
        <section className="card wide" aria-label="Questão">
          <h2>Questão</h2>
          <div className="filters">
            <label htmlFor="subject">Matéria</label>
            <select
              id="subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value)
                next(mode, e.target.value)
              }}
            >
              <option value="">Todas</option>
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <div className="chips" role="group" aria-label="Modo de estudo">
              <button type="button" className="chip" aria-pressed={mode === 'livre'} onClick={() => changeMode('livre')}>
                Questões livres
              </button>
              <button type="button" className="chip" aria-pressed={mode === 'erros'} onClick={() => changeMode('erros')}>
                Revisar erros
              </button>
            </div>
          </div>
          {!current ? (
            <p className="muted">
              {mode === 'erros' ? 'Nenhuma questão para revisar. Bom sinal.' : 'Nenhuma questão nesta matéria.'}
            </p>
          ) : (
            <QuestionView question={current} chosen={chosen} onAnswer={answer} onNext={() => next()} />
          )}
        </section>

        <section className="card" aria-label="Desempenho">
          <h2>Desempenho por matéria</h2>
          {stats.length === 0 ? (
            <p className="muted">Responda questões para ver seu desempenho.</p>
          ) : (
            stats.map((s) => (
              <div className="alloc" key={s.subject}>
                <div className="alloc-row">
                  <span>{s.subject}</span>
                  <span className="num">
                    {Math.round(s.rate * 100)}% de {s.answered}
                  </span>
                </div>
                <div className="bar" aria-hidden="true">
                  <i style={{ width: `${Math.round(s.rate * 100)}%` }} />
                </div>
              </div>
            ))
          )}
          <p className="muted">Matérias com mais erros aparecem mais.</p>
        </section>

        <section className="card" aria-label="Caderno de erros">
          <h2>Caderno de erros ({wrong.length})</h2>
          {wrong.length === 0 ? (
            <p className="muted">Nenhum erro pendente.</p>
          ) : (
            <>
              <ul className="list">
                {wrong.slice(0, 8).map((q) => (
                  <li key={q.id}>
                    <span className="muted">{q.subject}</span> {q.statement}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => changeMode('erros')}>
                Refazer erros
              </button>
            </>
          )}
        </section>

        <section className="card wide" aria-label="Importar questões">
          <h2>Importar questões</h2>
          <form onSubmit={importQuestions}>
            <div className="field">
              <label htmlFor="import">Questões em JSON</label>
              <textarea
                id="import"
                rows={4}
                value={importText}
                placeholder='[{"id":"q1","subject":"Português","statement":"...","options":["A","B"],"answer":0}]'
                onChange={(e) => setImportText(e.target.value)}
              />
            </div>
            {importMsg && <p className={importMsg.ok ? 'up' : 'err'}>{importMsg.text}</p>}
            <button type="submit">Importar</button>
          </form>
          <p className="muted">O banco inicial tem questões próprias de exemplo. Importe as suas no formato acima.</p>
        </section>
      </div>
    </div>
  )
}
