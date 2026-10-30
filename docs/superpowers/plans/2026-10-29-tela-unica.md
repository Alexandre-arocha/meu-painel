# Tela única: plano de implementação

> **Para agentes:** use superpowers:executing-plans, uma tarefa por vez, com teste antes.

**Objetivo:** fazer do Início uma tela única com números, notícias, questão do dia, carteira e agenda.

**Arquitetura:** extrair o que as abas já fazem em peças reutilizáveis e montar o Início com elas, num grid de três colunas que vira uma coluna no celular:
- `useQuotes`: os preços.
- `NewsFeed`: o feed de notícias.
- `QuestionView`: a questão.

**Stack:** React 19, TypeScript, Vitest e Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-29-tela-unica-design.md`

## Restrições globais

- Textos em português, com letra maiúscula só no começo.
- Alvos de toque de pelo menos 44 px.
- As cores vêm só dos tokens de `styles.css`.
- Nenhuma chamada nova à brapi: os preços seguem a cada 15 minutos.
- As abas existentes continuam funcionando, e os testes delas ficam verdes sem mudança.

## Foco da revisão

1. **Sem preço** (token ausente ou erro): os números da carteira e das ações mostram "—" e a tela não quebra.
2. **Notícias falham:** o feed mostra as notícias salvas ou o aviso de erro, como na aba Notícias.
3. **Sem questão disponível:** a coluna mostra uma frase curta, sem quebrar.
4. **Carteira vazia:** total R$ 0,00 e divisão sem barras quebradas.
5. **Tela estreita (375 px):** nada de rolagem horizontal, e a ordem do celular é respeitada.

---

### Tarefa 1: valor da carteira e data por extenso

**Arquivos:**
- `src/domain/portfolio.ts`: `portfolioValue`.
- `src/ui/format.ts`: `longDate`.
- Testes: `src/domain/portfolio.test.ts` e `src/ui/format.test.ts`.

**Interfaces:**
- `portfolioValue(p: Portfolio, prices: Record<string, number>): number` soma a renda fixa e quantidade × preço de cada ação. Preço ausente conta como zero.
- `longDate(d: Date): string` devolve, por exemplo, "Quinta-feira, 29 de outubro".

**Testes:**
- Renda fixa de 10.000 mais 100 BBAS3 a 16,46 e 200 B3SA3 a 14,20 dá 14.486.
- Preço ausente conta como zero.
- `longDate(new Date(2026, 9, 29))` dá "Quinta-feira, 29 de outubro".

### Tarefa 2: hook `useQuotes`

**Arquivos:**
- Criar `src/ui/useQuotes.ts`.
- Mudar `src/ui/InvestmentsPage.tsx`.

**Interface:** `useQuotes(makePrices, token, store): { quotes: Quote[]; error: string | null }`. Leva junto a carga inicial, o intervalo de 15 minutos e as cotações salvas quando a busca falha.

**Testes:** os de `InvestmentsPage.test.tsx` continuam verdes.

### Tarefa 3: componente `NewsFeed`

**Arquivos:**
- Criar `src/ui/NewsFeed.tsx`.
- `src/ui/NewsPage.tsx` passa a só envolver o `NewsFeed`.

**Interface:** `NewsFeed({ news, now?, store?, limit? })`. Leva junto os avisos, os temas, o Atualizar e a lista. `limit` corta a lista.

**Testes:** os de `NewsPage.test.tsx` continuam verdes.

### Tarefa 4: componente `QuestionView`

**Arquivos:**
- Criar `src/ui/QuestionView.tsx`.
- Mudar `src/ui/StudyPage.tsx`.

**Interface:** `QuestionView({ question, chosen, onAnswer, onNext })`. Mostra a matéria, o enunciado, as opções, a correção e o botão Próxima questão.

**Testes:** os de `StudyPage.test.tsx` continuam verdes.

### Tarefa 5: Início como tela única

**Arquivos:**
- `src/ui/HomePage.tsx`
- `src/ui/HomePage.test.tsx`, reescrito antes do código.
- `src/ui/App.tsx`: passa `makePrices` e as notícias gerais ao Início.
- `src/ui/App.test.tsx`: passa `generalNews`.
- `src/ui/styles.css`

**Testes:**
- Os números mostram o preço vindo do provedor, o total da carteira e "0 de 20".
- O feed mostra as notícias do source e o filtro por tema funciona.
- Responder a questão grava a tentativa, mostra a correção e sobe o "de 20".
- A agenda do dia e a próxima data importante aparecem.
- Sem preço, a tela mostra "—".

### Tarefa 6: verificação

- Conferir no navegador, com o servidor de desenvolvimento, nas larguras 1280 e 375.
- Rodar `npm test` e `npm run build`.
- Abrir o PR.
