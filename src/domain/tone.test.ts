import { lexiconClassifier } from './tone'

test('lexiconClassifier classifica "Banco do Brasil tem lucro recorde" como positive', async () => {
  const r = await lexiconClassifier.classify('Banco do Brasil tem lucro recorde')
  expect(r.tone).toBe('positive')
  expect(r.reason).toContain('lucro')
})

test('lexiconClassifier classifica "B3 registra queda no volume" como negative', async () => {
  const r = await lexiconClassifier.classify('B3 registra queda no volume')
  expect(r.tone).toBe('negative')
})

test('lexiconClassifier devolve neutral com reason "sem palavra-chave" para texto sem termos', async () => {
  expect(await lexiconClassifier.classify('Copom se reúne na quarta')).toEqual({
    tone: 'neutral',
    reason: 'sem palavra-chave',
  })
})

test('lexiconClassifier ignora acentos e maiúsculas', async () => {
  expect((await lexiconClassifier.classify('PREJUÍZO no trimestre')).tone).toBe('negative')
})

test('lexiconClassifier devolve neutral quando positivas e negativas empatam', async () => {
  expect((await lexiconClassifier.classify('Lucro cresce mas ações em queda e prejuízo')).tone).toBe('neutral')
})
