export type Area = 'tecnologia' | 'militar' | 'geral'
export type Question = {
  id: string
  area: Area
  subject: string
  statement: string
  options: string[]
  answer: number
  explanation: string
}
export type Attempt = { questionId: string; correct: boolean; at: string }
export type SubjectStats = { subject: string; answered: number; correct: number; rate: number }
export type PickOptions = { mode: 'livre' | 'erros'; subject?: string }

function lastAttempts(attempts: Attempt[]): Map<string, Attempt> {
  const last = new Map<string, Attempt>()
  for (const a of attempts) {
    const prev = last.get(a.questionId)
    if (!prev || a.at >= prev.at) last.set(a.questionId, a)
  }
  return last
}

export function statsBySubject(questions: Question[], attempts: Attempt[]): SubjectStats[] {
  const subjectOf = new Map(questions.map((q) => [q.id, q.subject]))
  const acc = new Map<string, { answered: number; correct: number }>()
  for (const q of questions) if (!acc.has(q.subject)) acc.set(q.subject, { answered: 0, correct: 0 })
  for (const a of attempts) {
    const s = subjectOf.get(a.questionId)
    const e = s ? acc.get(s) : undefined
    if (!e) continue
    e.answered++
    if (a.correct) e.correct++
  }
  return [...acc].map(([subject, e]) => ({ subject, ...e, rate: e.answered ? e.correct / e.answered : 0 }))
}

export function wrongQuestions(questions: Question[], attempts: Attempt[]): Question[] {
  const last = lastAttempts(attempts)
  return questions.filter((q) => last.get(q.id)?.correct === false)
}

// Sorteio com peso: errada 4, nunca respondida 3, acertada 1, vezes (1 + taxa de erro da matéria).
export function pickNext(
  questions: Question[],
  attempts: Attempt[],
  opts: PickOptions,
  rand: () => number = Math.random,
  exclude?: string,
): Question | undefined {
  let pool = opts.mode === 'erros' ? wrongQuestions(questions, attempts) : questions
  if (opts.subject) pool = pool.filter((q) => q.subject === opts.subject)
  if (exclude && pool.length > 1) pool = pool.filter((q) => q.id !== exclude)
  if (pool.length === 0) return undefined
  const last = lastAttempts(attempts)
  const errorRate = new Map(statsBySubject(questions, attempts).map((s) => [s.subject, s.answered ? 1 - s.rate : 0]))
  const weights = pool.map((q) => {
    const l = last.get(q.id)
    return (!l ? 3 : l.correct ? 1 : 4) * (1 + (errorRate.get(q.subject) ?? 0))
  })
  let r = rand() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r < 0) return pool[i]
  }
  return pool[pool.length - 1]
}

const nonEmpty = (s: unknown): s is string => typeof s === 'string' && s.trim() !== ''

export function parseQuestions(text: string): { ok: true; questions: Question[] } | { ok: false; error: string } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'JSON inválido' }
  }
  if (!Array.isArray(data) || data.length === 0) return { ok: false, error: 'envie uma lista de questões' }
  const out: Question[] = []
  for (const [i, raw] of data.entries()) {
    const q = (raw ?? {}) as Partial<Question>
    const options = Array.isArray(q.options) ? q.options : []
    const answer = q.answer
    if (
      !nonEmpty(q.id) ||
      !nonEmpty(q.subject) ||
      !nonEmpty(q.statement) ||
      options.length < 2 ||
      !options.every(nonEmpty) ||
      !Number.isInteger(answer) ||
      (answer as number) < 0 ||
      (answer as number) >= options.length
    ) {
      return { ok: false, error: `questão ${i + 1} incompleta` }
    }
    out.push({
      id: q.id,
      area: q.area === 'tecnologia' || q.area === 'militar' ? q.area : 'geral',
      subject: q.subject.trim(),
      statement: q.statement.trim(),
      options,
      answer: answer as number,
      explanation: typeof q.explanation === 'string' ? q.explanation : '',
    })
  }
  if (new Set(out.map((q) => q.id)).size !== out.length) return { ok: false, error: 'ids repetidos' }
  return { ok: true, questions: out }
}
