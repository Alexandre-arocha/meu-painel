import type { Question } from '../domain/study'

const LETTERS = 'ABCDEFGHIJ'

type Props = { question: Question; chosen: number | null; onAnswer: (i: number) => void; onNext: () => void }

// Enunciado, opções e correção de uma questão. Usado em Estudos e no Início.
export function QuestionView({ question, chosen, onAnswer, onNext }: Props) {
  return (
    <>
      <p className="muted">{question.subject}</p>
      <p className="statement">{question.statement}</p>
      {question.options.map((o, i) => (
        <button
          key={i}
          type="button"
          className={`opt${chosen !== null && i === question.answer ? ' ok' : ''}${chosen === i && i !== question.answer ? ' bad' : ''}`}
          disabled={chosen !== null}
          onClick={() => onAnswer(i)}
        >
          {LETTERS[i]}) {o}
        </button>
      ))}
      {chosen !== null && (
        <div className="feedback" aria-live="polite">
          <p className={chosen === question.answer ? 'up' : 'dn'}>
            {chosen === question.answer
              ? 'Correto.'
              : `Errado. Resposta certa: ${LETTERS[question.answer]}) ${question.options[question.answer]}.`}
          </p>
          {question.explanation && <p className="muted">{question.explanation}</p>}
          <button type="button" onClick={onNext}>
            Próxima questão
          </button>
        </div>
      )}
    </>
  )
}
