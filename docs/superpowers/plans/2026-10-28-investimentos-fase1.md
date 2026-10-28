# Fase 1: Investimentos + notícias — Plano de implementação

> **Para quem for executar:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** painel web responsivo que mostra a carteira (BBAS3, B3SA3, renda fixa), o preço do dia, notícias com tom e um sinal de apoio, sem prever nem recomendar.

**Arquitetura:** regras puras em `src/domain` (carteira, tom, sinal), acesso a dados em `src/data` atrás de interfaces (preços, notícias, armazenamento), telas em `src/ui`. Dados do dono ficam em `localStorage`. As regras puras são testadas sem rede.

**Stack:** Vite, React, TypeScript, Vitest, vite-plugin-pwa. Preços: brapi.dev (token gratuito do dono). Notícias: RSS do Google Notícias lido por proxy.

**Spec:** `docs/superpowers/specs/2026-10-28-investimentos-fase1-design.md`

## Restrições globais

- Um único usuário; nenhum dado financeiro vai para o repositório nem para logs.
- Preço com atraso; mostrar sempre a hora da última atualização e avisar quando o dado estiver velho (mais de 15 minutos em horário de mercado).
- O app nunca diz "compre" ou "venda" e nunca chama o sinal de previsão. Texto fixo na tela: "Sinal de apoio, não é previsão garantida."
- Tickers desta fase: `BBAS3`, `B3SA3`. Termos de busca de notícia: `Banco do Brasil BBAS3`, `B3 B3SA3`, `Selic`, `renda fixa`.
- Commits sem linha de coautor; autor é o dono. Push ao fim de cada marco (Tarefas 3, 6, 7, 8).
- Token da brapi fica só no `localStorage`; nunca no código nem no git.
- Visual segue `mockup-completo.html`, claro e escuro.

## Foco de revisão

- Carteira vazia ou com quantidade 0: a divisão da carteira não pode dar divisão por zero nem `NaN`.
- Quantidade negativa, texto ou vazio digitado pelo dono: rejeitar com mensagem, sem quebrar.
- `localStorage` vazio, corrompido ou de versão antiga: abrir com carteira vazia, sem tela branca.
- API de preço fora do ar, sem token ou com token inválido: mostrar o último valor guardado marcado como velho e uma mensagem clara.
- Notícias repetidas, sem título ou sem data: não duplicar na lista e não quebrar a ordenação.
- Mercado fechado, fim de semana ou feriado: o gráfico do dia mostra "mercado fechado" em vez de linha vazia.

---

### Tarefa 1: Esqueleto do projeto

**Arquivos:**
- Criar: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/ui/App.tsx`, `.gitignore`
- Teste: `src/ui/App.test.tsx`

**Interfaces:**
- Produz: script `npm test` (Vitest) e `npm run dev`.

- [ ] **Passo 1:** Teste `App mostra o título "Meu painel" e o aviso de sinal de apoio` em `src/ui/App.test.tsx` (`getByText("Meu painel")`, `getByText(/não é previsão garantida/i)`).
- [ ] **Passo 2:** Rodar `npm test` e ver falhar (App não existe).
- [ ] **Passo 3:** Criar o projeto com Vite React TS, Vitest + Testing Library; `.gitignore` inclui `node_modules`, `dist`, `.env*`, `.superpowers`, `receipts`, `review-receipts`. Implementar `App()` em `src/ui/App.tsx` com o título e o aviso.
- [ ] **Passo 4:** `npm test` passa e `npm run build` termina sem erro.
- [ ] **Passo 5:** Commit `feat: esqueleto Vite React TS com Vitest`.

### Tarefa 2: Carteira e divisão (regras puras)

**Arquivos:**
- Criar: `src/domain/portfolio.ts`
- Teste: `src/domain/portfolio.test.ts`

**Interfaces:**
- Produz:
  - `type Holding = { symbol: "BBAS3" | "B3SA3"; quantity: number }`
  - `type FixedIncome = { amount: number; ratePctYear?: number; maturity?: string }`
  - `type Portfolio = { holdings: Holding[]; fixedIncome: FixedIncome }`
  - `type Allocation = { fixedIncome: number; BBAS3: number; B3SA3: number }` (frações de 0 a 1)
  - `parseQuantity(input: string): { ok: true; value: number } | { ok: false; error: string }`
  - `allocation(p: Portfolio, prices: Record<string, number>): Allocation`

- [ ] **Passo 1:** Testes: `allocation com 10000 de renda fixa, 100 BBAS3 a 30 e 50 B3SA3 a 20 soma 1` (renda fixa 10000/14000, BBAS3 3000/14000, B3SA3 1000/14000); `allocation com carteira vazia devolve zeros`; `allocation ignora ticker sem preço e não retorna NaN`; `parseQuantity rejeita "-1", "abc" e ""`; `parseQuantity aceita "10" como 10`; `parseQuantity rejeita "1,5" com erro "use número inteiro"`.
- [ ] **Passo 2:** Rodar `npm test -- portfolio` e ver falhar.
- [ ] **Passo 3:** Implementar as duas funções em `src/domain/portfolio.ts`; total 0 devolve todas as frações 0.
- [ ] **Passo 4:** Rodar e ver passar.
- [ ] **Passo 5:** Commit `feat: regras da carteira e divisão`.

### Tarefa 3: Armazenamento local

**Arquivos:**
- Criar: `src/data/storage.ts`
- Teste: `src/data/storage.test.ts`

**Interfaces:**
- Consome: `Portfolio` da Tarefa 2.
- Produz:
  - `loadPortfolio(store?: Storage): Portfolio` (padrão `localStorage`)
  - `savePortfolio(p: Portfolio, store?: Storage): void`
  - `loadSettings(store?: Storage): { brapiToken?: string; targetAllocation?: Allocation }` e `saveSettings(...)`
  - Chave `painel:v1:portfolio`; JSON inválido ou versão diferente devolve carteira vazia (`{ holdings: [], fixedIncome: { amount: 0 } }`).

- [ ] **Passo 1:** Testes: `salvar e carregar devolve a mesma carteira`; `JSON corrompido devolve carteira vazia`; `chave ausente devolve carteira vazia`; `quantidade negativa guardada à mão é descartada ao carregar`.
- [ ] **Passo 2:** Rodar e ver falhar.
- [ ] **Passo 3:** Implementar com validação ao carregar (quantidade inteira >= 0).
- [ ] **Passo 4:** Rodar e ver passar.
- [ ] **Passo 5:** Commit; **marco 1:** `git push -u origin feat/fase1-investimentos`.

### Tarefa 4: Preços do dia

**Arquivos:**
- Criar: `src/data/prices.ts`
- Teste: `src/data/prices.test.ts`

**Interfaces:**
- Produz:
  - `type Quote = { symbol: string; price: number; changePct: number; updatedAt: string; stale: boolean; intraday: { t: string; p: number }[] }`
  - `interface PriceProvider { getQuotes(symbols: string[]): Promise<Quote[]> }`
  - `createBrapiProvider(token: string | undefined, fetchFn?: typeof fetch, now?: () => Date): PriceProvider`
  - `isStale(updatedAt: string, now: Date): boolean` (true se passou de 15 min em dia útil entre 10h e 17h30 no horário de Brasília)

- [ ] **Passo 1:** Testes com `fetchFn` falso: `getQuotes converte a resposta em Quote`; `sem token lança erro "token ausente"`; `resposta 401 lança erro "token inválido"`; `isStale é true com 20 min de atraso em dia útil às 11h`; `isStale é false com mercado fechado no sábado`.
- [ ] **Passo 2:** Rodar e ver falhar.
- [ ] **Passo 3:** Implementar. Endpoint e campos da brapi: confirmar na documentação oficial antes de escrever o mapeamento e anotar a URL num comentário no topo do arquivo.
- [ ] **Passo 4:** Rodar e ver passar.
- [ ] **Passo 5:** Commit `feat: provedor de preços brapi`.

### Tarefa 5: Notícias e tom

**Arquivos:**
- Criar: `src/data/news.ts`, `src/domain/tone.ts`
- Modificar: `vite.config.ts` (proxy de dev `/news-proxy` para `https://news.google.com/rss`)
- Teste: `src/data/news.test.ts`, `src/domain/tone.test.ts`

**Interfaces:**
- Produz:
  - `type Tone = "positive" | "neutral" | "negative"`
  - `type NewsItem = { id: string; title: string; source: string; publishedAt: string | null; tags: string[]; tone: Tone; reason: string }`
  - `parseRss(xml: string, tag: string): Omit<NewsItem, "tone" | "reason">[]`
  - `dedupe(items: NewsItem[]): NewsItem[]` (mesmo título normalizado conta como repetido)
  - `interface ToneClassifier { classify(title: string): Promise<{ tone: Tone; reason: string }> }`
  - `lexiconClassifier: ToneClassifier` (palavras em português: "lucro", "alta", "recorde" positivas; "queda", "prejuízo", "rebaixa" negativas; resto neutro)

- [ ] **Passo 1:** Testes: `parseRss ignora item sem título`; `parseRss usa data inválida como null sem quebrar`; `dedupe remove títulos repetidos ignorando maiúsculas e acentos`; `lexiconClassifier classifica "Banco do Brasil tem lucro recorde" como positive`; `lexiconClassifier classifica "B3 registra queda no volume" como negative`; `lexiconClassifier devolve neutral com reason "sem palavra-chave" para texto sem termos`.
- [ ] **Passo 2:** Rodar e ver falhar.
- [ ] **Passo 3:** Implementar. Notícia sem data fica ao fim da lista. O classificador com modelo de linguagem fica na Tarefa 9, porque exige função no servidor e chave de API.
- [ ] **Passo 4:** Rodar e ver passar.
- [ ] **Passo 5:** Commit `feat: leitura de RSS e tom por palavras-chave`.

### Tarefa 6: Sinal do dia

**Arquivos:**
- Criar: `src/domain/signal.ts`
- Teste: `src/domain/signal.test.ts`

**Interfaces:**
- Consome: `Tone`, `NewsItem`, `Quote`.
- Produz: `type Signal = { label: "mais positivo" | "neutro" | "mais negativo" | "sem dados"; positives: number; negatives: number; agreesWithPrice: boolean | null }` e `computeSignal(news: NewsItem[], quote: Quote | undefined, now: Date, windowHours?: number): Signal` (padrão 6 h).

- [ ] **Passo 1:** Testes: `3 positivas e 1 negativa nas últimas 6 h dão "mais positivo"`; `notícia de 8 h atrás é ignorada`; `empate dá "neutro"`; `sem notícias na janela dá "sem dados"`; `agreesWithPrice é true com sinal positivo e changePct > 0`; `agreesWithPrice é null quando não há quote`.
- [ ] **Passo 2:** Rodar e ver falhar.
- [ ] **Passo 3:** Implementar contagem simples; nenhum texto do tipo "vai subir" ou "vai cair" em lugar nenhum.
- [ ] **Passo 4:** Rodar e ver passar.
- [ ] **Passo 5:** Commit; **marco 2:** push.

### Tarefa 7: Tela de Investimentos com design

**Arquivos:**
- Criar: `src/ui/InvestmentsPage.tsx`, `src/ui/PortfolioCard.tsx`, `src/ui/QuoteCard.tsx`, `src/ui/NewsList.tsx`, `src/ui/AllocationCard.tsx`, `src/ui/styles.css`
- Modificar: `src/ui/App.tsx`
- Teste: `src/ui/InvestmentsPage.test.tsx`

**Interfaces:**
- Consome: tudo das Tarefas 2 a 6.
- Produz: `<InvestmentsPage prices={PriceProvider} news={NewsSource} classifier={ToneClassifier} />`, com `interface NewsSource { fetchNews(): Promise<NewsItem[]> }` definida em `src/data/news.ts`.

- [ ] **Passo 1:** Antes de escrever a interface, carregar as skills `frontend-design` e `ui-ux-pro-max` e aplicar ao CSS: tokens de cor e espaçamento do `mockup-completo.html`, tema claro e escuro, alvo de toque mínimo de 44 px no celular, contraste AA, foco visível.
- [ ] **Passo 2:** Testes com provedores falsos: `mostra preço e variação de BBAS3`; `mostra "dado velho" quando stale é true`; `sem token mostra campo para informar o token`; `quantidade inválida mostra mensagem e não salva`; `carteira vazia mostra convite para informar quantidades`; `lista de notícias mostra o tom de cada item`; `mostra o aviso "Sinal de apoio, não é previsão garantida."`; `mercado fechado mostra "mercado fechado" no lugar do gráfico`.
- [ ] **Passo 3:** Rodar e ver falhar.
- [ ] **Passo 4:** Implementar as telas. Gráfico do dia em SVG simples, sem biblioteca.
- [ ] **Passo 5:** Rodar `npm test`; abrir `npm run dev` e conferir no navegador em 375 px e em 1280 px, claro e escuro, com captura de tela.
- [ ] **Passo 6:** Commit; **marco 3:** push.

### Tarefa 8: Instalável no celular (PWA)

**Arquivos:**
- Modificar: `vite.config.ts`, `index.html`
- Criar: `public/icon-192.png`, `public/icon-512.png`
- Teste: `src/pwa.test.ts` (confere que o manifesto gerado tem nome, `display: "standalone"` e dois ícones)

- [ ] **Passo 1:** Teste do manifesto.
- [ ] **Passo 2:** Rodar e ver falhar.
- [ ] **Passo 3:** Configurar `vite-plugin-pwa` com nome "Meu painel", tema claro e escuro e os ícones.
- [ ] **Passo 4:** `npm run build` e `npm test` passam; Lighthouse PWA sem erro bloqueante.
- [ ] **Passo 5:** Commit; **marco 4:** push.

### Tarefa 9 (depois da decisão do dono): Tom por modelo de linguagem e publicação

Fica fora da execução automática. Exige duas decisões do dono: criar uma chave de API (guardada só em variável de ambiente do servidor) e escolher onde publicar o app para usar no celular fora de casa. Escrever o plano desta tarefa só depois dessas respostas.

## Autoverificação

- Cobertura da spec: carteira (T2, T3), preço do dia e aviso de atraso (T4, T7), notícias com tom (T5, T7), sinal (T6, T7), divisão atual e desejada (T2, T7), celular e computador (T7, T8). Alertas e meta de aporte calculada seguem como perguntas em aberto da spec e não entram.
- Tipos conferidos: `Allocation`, `Quote`, `NewsItem`, `Tone` usados com os mesmos nomes nas tarefas 2 a 7.
