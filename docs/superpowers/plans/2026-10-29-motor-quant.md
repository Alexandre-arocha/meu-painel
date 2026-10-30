# Motor quantitativo: plano de implementação

> **Para agentes:** use superpowers:executing-plans, uma tarefa por vez, com teste antes.

**Objetivo:** pôr no alto da tela Investimentos os indicadores, o teste de estratégia, o risco e o simulador de aportes.

**Arquitetura:** as contas puras ficam em `src/domain/quant.ts`. O histórico diário vem pelo provedor de preços (`getHistory`) e fica guardado por dia em `painel:v1:history`. O componente `QuantEngine` monta os blocos dentro da grade da tela Investimentos.

**Spec:** `docs/superpowers/specs/2026-10-29-motor-quant-design.md`

## Restrições globais

- Nenhuma chamada nova à brapi por atualização de preço. O histórico é buscado 1 vez por dia por ativo.
- Textos de apoio com a frase "não é recomendação".
- Alvos de toque de pelo menos 44 px, e cores só dos tokens.

## Foco da revisão

1. **Histórico curto ou vazio** (menos de 22 pontos): mostrar um aviso, sem `NaN` na tela.
2. **Sem quantidades na carteira:** o risco pede as quantidades.
3. **Sem meta:** o simulador pede a meta.
4. **Aporte inválido** ("abc" ou 0): erro junto do campo e nenhum resultado.
5. **Falha da brapi:** usar o cache do dia anterior se houver, e mostrar o motivo.

---

### Tarefa 1: contas do motor (`src/domain/quant.ts`)

**Funções:**
- `sma(values, n)`
- `dailyReturns(values)`
- `stdev(values)`
- `annualVol(values)`
- `maxDrawdown(values)`
- `rsi(values, n = 14)`
- `maCrossBacktest(values, fast = 9, slow = 21)`
- `correlation(a, b)`
- `portfolioRisk(stocks, fixedIncome)`
- `splitContribution(amount, current, target, prices)`
- `projectFixedIncome(amount, ratePctYear, months = 12)`

**Testes** (`src/domain/quant.test.ts`):
- `sma([1,2,3,4,5], 3)` dá `[null, null, 2, 3, 4]`.
- A maior queda de `[100, 120, 90, 130, 117]` dá −25%.
- O RSI dá 100 quando o preço só sobe e 50 quando alterna +1 e −1.
- O backtest de `[10,9,8,9,10,11,12]` com médias de 2 e 3 dias:
  - estratégia: `[1,1,1,1,1,1.1,1.2]`;
  - comprar e segurar: `[1,0.9,0.8,0.9,1,1.1,1.2]`;
  - 1 troca de posição.
- A correlação dá 1 e −1 nos casos simples.
- O VaR de uma ação de R$ 1.000 com retornos ±1% e R$ 1.000 em renda fixa dá cerca de R$ 19,00.
- O aporte de R$ 1.000 com meta 60/20/20, carteira R$ 10.000 / R$ 1.646 / R$ 2.840 e preços 16,46 / 14,20 dá 51 BBAS3, 10 B3SA3 e cerca de R$ 18,54 em renda fixa.
- R$ 10.000 a 11% ao ano em 12 meses dá R$ 11.100.

### Tarefa 2: histórico e cache

**Arquivos e funções:**
- `src/data/prices.ts`: `getHistory(symbol)` opcional no `PriceProvider`, com `range=3mo&interval=1d`. Lê `historicalDataPrice` com a mesma função do intraday.
- `src/data/storage.ts`: `loadHistory` e `saveHistory` (`{ day, series }`), fora da sincronização.

**Testes:**
- A URL tem `range=3mo&interval=1d`.
- Os pontos saem como `{ t, p }`.
- Um erro traz o motivo da brapi.
- O cache faz a ida e a volta, e um cache inválido dá `null`.

### Tarefa 3: `QuantEngine` na tela Investimentos

**Arquivos:**
- `src/ui/useHistory.ts`: usa o cache do dia ou busca os dois ativos.
- `src/ui/LineChart.tsx`
- `src/ui/QuantEngine.tsx`
- `src/ui/InvestmentsPage.tsx`
- `src/ui/styles.css`

**Testes** (`src/ui/QuantEngine.test.tsx`):
- Os indicadores aparecem a partir do histórico falso.
- A troca de ativo funciona.
- O backtest mostra as linhas de resultado.
- O risco aparece com a carteira e pede as quantidades quando ela está vazia.
- O simulador divide o aporte e mostra erro em aporte inválido.
- O cache do dia evita uma nova busca.
- Os testes atuais de Investimentos continuam verdes.

### Tarefa 4: verificação

- Conferir no navegador nas larguras 1280 e 375, no preto e no branco.
- Rodar `npm test` e `npm run build`.
- Abrir o PR.
