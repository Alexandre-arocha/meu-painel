import {
  CLASSES,
  classOf,
  fromLegacy,
  labelOf,
  parseAmount,
  priceKey,
  readPositions,
  resolveTargets,
  totals,
  validateDraft,
  type Draft,
  type Kind,
  type Position,
} from './portfolio'

const blank: Draft = { kind: 'acao', symbol: '', quantity: '', name: '', amount: '', subtype: '', index: '', rate: '', maturity: '' }
const draft = (over: Partial<Draft>): Draft => ({ ...blank, ...over })

test('ação aceita o código da B3 em maiúsculas e quantidade inteira', () => {
  expect(validateDraft(draft({ kind: 'acao', symbol: ' petr4 ', quantity: '100' }))).toEqual({
    ok: true,
    position: { kind: 'acao', symbol: 'PETR4', quantity: 100 },
  })
  expect(validateDraft(draft({ kind: 'acao', symbol: 'B3SA3', quantity: '7' })).ok).toBe(true)
})

test('ação, FII, ETF e BDR recusam fração, código fora da B3 e quantidade zero', () => {
  expect(validateDraft(draft({ kind: 'acao', symbol: 'PETR4', quantity: '1,5' }))).toEqual({ ok: false, errors: { quantity: 'use número inteiro' } })
  expect(validateDraft(draft({ kind: 'fii', symbol: 'AAPL', quantity: '10' }))).toEqual({
    ok: false,
    errors: { symbol: 'use o código da B3, como PETR4 ou HGLG11' },
  })
  expect(validateDraft(draft({ kind: 'etf', symbol: 'BOVA11', quantity: '0' }))).toEqual({
    ok: false,
    errors: { quantity: 'informe uma quantidade maior que zero' },
  })
  expect(validateDraft(draft({ kind: 'bdr', symbol: '', quantity: 'abc' }))).toEqual({
    ok: false,
    errors: { symbol: 'informe o código', quantity: 'use apenas números positivos' },
  })
})

test('exterior, cripto e moeda aceitam fração', () => {
  expect(validateDraft(draft({ kind: 'exterior', symbol: 'brk.b', quantity: '2,5' }))).toEqual({
    ok: true,
    position: { kind: 'exterior', symbol: 'BRK-B', quantity: 2.5 },
  })
  expect(validateDraft(draft({ kind: 'cripto', symbol: 'BTC', quantity: '0.005' }))).toEqual({
    ok: true,
    position: { kind: 'cripto', symbol: 'btc', quantity: 0.005 },
  })
  expect(validateDraft(draft({ kind: 'moeda', symbol: 'usd', quantity: '1.500,00' }))).toEqual({
    ok: true,
    position: { kind: 'moeda', symbol: 'USD', quantity: 1500 },
  })
})

test('moeda recusa o real e código que não tem 3 letras', () => {
  expect(validateDraft(draft({ kind: 'moeda', symbol: 'BRL', quantity: '10' }))).toEqual({ ok: false, errors: { symbol: 'o real já é a moeda da carteira' } })
  expect(validateDraft(draft({ kind: 'moeda', symbol: 'DOLAR', quantity: '10' }))).toEqual({
    ok: false,
    errors: { symbol: 'use o código da moeda, como USD ou EUR' },
  })
})

test('renda fixa guarda nome, valor, tipo de título, índice, taxa e vencimento', () => {
  expect(
    validateDraft(draft({ kind: 'renda-fixa', name: ' CDB Banco X ', amount: '10.000,50', subtype: 'cdb', index: 'cdi', rate: '110', maturity: '2027-12-15' })),
  ).toEqual({
    ok: true,
    position: { kind: 'renda-fixa', name: 'CDB Banco X', amount: 10000.5, subtype: 'cdb', index: 'cdi', rate: 110, maturity: '2027-12-15' },
  })
})

test('fundo sem índice, taxa e vencimento fica só com o essencial', () => {
  expect(validateDraft(draft({ kind: 'fundo', name: 'Fundo Y', amount: '5000', subtype: 'cdb' }))).toEqual({
    ok: true,
    position: { kind: 'fundo', name: 'Fundo Y', amount: 5000 },
  })
})

test('valor digitado recusa nome vazio, valor inválido, plano de outro tipo, taxa negativa e data inválida', () => {
  expect(validateDraft(draft({ kind: 'previdencia', name: ' ', amount: 'abc', subtype: 'cdb', rate: '-1', maturity: '2027-13-40' }))).toEqual({
    ok: false,
    errors: {
      name: 'informe o nome',
      amount: 'valor inválido',
      subtype: 'escolha o plano',
      rate: 'use uma taxa de zero ou mais',
      maturity: 'data inválida',
    },
  })
  expect(validateDraft(draft({ kind: 'renda-fixa', name: 'Tesouro', amount: '100' }))).toEqual({
    ok: false,
    errors: { subtype: 'escolha o tipo de título' },
  })
})

test('as 8 classes, a classe de cada tipo e a chave de preço por mercado', () => {
  expect(CLASSES.map((c) => c.id)).toEqual(['renda-fixa', 'acoes', 'fiis', 'etfs', 'exterior', 'cripto', 'moedas', 'fundos'])
  const kinds: Kind[] = ['acao', 'fii', 'etf', 'bdr', 'exterior', 'cripto', 'moeda', 'renda-fixa', 'fundo', 'previdencia']
  expect(kinds.map(classOf)).toEqual(['acoes', 'fiis', 'etfs', 'exterior', 'exterior', 'cripto', 'moedas', 'renda-fixa', 'fundos', 'fundos'])
  expect(priceKey({ kind: 'bdr', symbol: 'AAPL34' })).toBe('b3:AAPL34')
  expect(priceKey({ kind: 'exterior', symbol: 'AAPL' })).toBe('us:AAPL')
  expect(priceKey({ kind: 'cripto', symbol: 'bitcoin' })).toBe('crypto:bitcoin')
  expect(priceKey({ kind: 'moeda', symbol: 'USD' })).toBe('fx:USD')
})

test('labelOf mostra o código, o nome da cripto ou o nome digitado', () => {
  expect(labelOf({ id: '1', kind: 'acao', symbol: 'PETR4', quantity: 1, name: 'Petrobras' })).toBe('PETR4')
  expect(labelOf({ id: '2', kind: 'cripto', symbol: 'bitcoin', quantity: 1, name: 'Bitcoin' })).toBe('Bitcoin')
  expect(labelOf({ id: '3', kind: 'renda-fixa', name: 'CDB X', amount: 1 })).toBe('CDB X')
})

test('totals soma em reais por classe; ativo sem preço fica de fora e é avisado', () => {
  const positions: Position[] = [
    { id: '1', kind: 'acao', symbol: 'BBAS3', quantity: 100 },
    { id: '2', kind: 'exterior', symbol: 'AAPL', quantity: 2 },
    { id: '3', kind: 'renda-fixa', name: 'CDB', amount: 10000 },
    { id: '4', kind: 'previdencia', name: 'VGBL', amount: 3000, subtype: 'vgbl' },
    { id: '5', kind: 'cripto', symbol: 'bitcoin', quantity: 0.01, name: 'Bitcoin' },
  ]
  // O preço de fora já chega em reais: 1800 = US$ 360 x 5.
  const t = totals(positions, { 'b3:BBAS3': 20, 'us:AAPL': 1800 })
  expect(t.total).toBe(2000 + 3600 + 10000 + 3000)
  expect(t.byClass).toEqual({ 'renda-fixa': 10000, acoes: 2000, fiis: 0, etfs: 0, exterior: 3600, cripto: 0, moedas: 0, fundos: 3000 })
  expect(t.missing).toEqual(['crypto:bitcoin'])
})

test('fromLegacy traz BBAS3, B3SA3 e a renda fixa da carteira antiga, com ids fixos', () => {
  expect(
    fromLegacy({
      holdings: [
        { symbol: 'BBAS3', quantity: 100 },
        { symbol: 'B3SA3', quantity: 0 },
      ],
      fixedIncome: { amount: 10000, ratePctYear: 11, maturity: '2027-01-01' },
    }),
  ).toEqual([
    { id: 'antigo-BBAS3', kind: 'acao', symbol: 'BBAS3', quantity: 100, name: 'Banco do Brasil' },
    { id: 'antigo-renda-fixa', kind: 'renda-fixa', name: 'Renda fixa', amount: 10000, index: 'pre', rate: 11, maturity: '2027-01-01' },
  ])
  expect(fromLegacy({ holdings: [], fixedIncome: { amount: 0 } })).toEqual([])
})

test('readPositions descarta o que não é uma posição válida', () => {
  const ok: Position[] = [
    { id: 'a', kind: 'acao', symbol: 'PETR4', quantity: 10 },
    { id: 'e', kind: 'cripto', symbol: 'bitcoin', quantity: 0.5, name: 'Bitcoin' },
    { id: 'f', kind: 'renda-fixa', name: 'CDB', amount: 100, subtype: 'cdb', index: 'cdi', rate: 105 },
  ]
  expect(
    readPositions([
      ok[0],
      { id: 'b', kind: 'acao', symbol: 'PETR4', quantity: -1 },
      { id: 'c', kind: 'xyz', symbol: 'PETR4', quantity: 1 },
      { id: 'd', kind: 'renda-fixa', name: 'CDB', amount: 100, index: 'ruim' },
      { id: 'g', kind: 'acao', symbol: 'PETR4', quantity: 1.5 },
      ok[1],
      null,
      'x',
      ok[2],
    ]),
  ).toEqual(ok)
  expect(readPositions({ nao: 'lista' })).toEqual([])
})

test('resolveTargets usa as metas por classe ou converte a meta antiga', () => {
  expect(resolveTargets({ targetAllocation: { fixedIncome: 0.5, BBAS3: 0.25, B3SA3: 0.25 } })).toEqual({
    'renda-fixa': 0.5,
    acoes: 0.5,
    fiis: 0,
    etfs: 0,
    exterior: 0,
    cripto: 0,
    moedas: 0,
    fundos: 0,
  })
  const ct = { 'renda-fixa': 0.5, acoes: 0.3, fiis: 0, etfs: 0, exterior: 0.2, cripto: 0, moedas: 0, fundos: 0 }
  expect(resolveTargets({ classTargets: ct, targetAllocation: { fixedIncome: 1, BBAS3: 0, B3SA3: 0 } })).toEqual(ct)
  expect(resolveTargets({ classTargets: { acoes: 2 } })).toBeUndefined()
  expect(resolveTargets({})).toBeUndefined()
})

test('parseAmount aceita "10000", "10.000,50", "10000.5" e "0.005"', () => {
  expect(parseAmount('10000')).toEqual({ ok: true, value: 10000 })
  expect(parseAmount('10.000,50')).toEqual({ ok: true, value: 10000.5 })
  expect(parseAmount('10000.5')).toEqual({ ok: true, value: 10000.5 })
  expect(parseAmount('0.005')).toEqual({ ok: true, value: 0.005 })
  expect(parseAmount('1.500')).toEqual({ ok: true, value: 1500 })
})

test('parseAmount rejeita "-5", "abc" e ""', () => {
  for (const bad of ['-5', 'abc', '']) expect(parseAmount(bad).ok).toBe(false)
})
