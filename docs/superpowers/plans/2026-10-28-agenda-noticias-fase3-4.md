# Fases 3 e 4: Agenda e Notícias completas — Plano de implementação

> **Para quem for executar:** use superpowers:executing-plans (escolhido pelo dono: execução nativa, tudo de uma vez). Passos com checkbox (`- [ ]`).

**Objetivo:** completar as abas Agenda e Notícias e o Início com recorrência semanal, duração, calendário navegável, datas importantes com contagem, links seguros, filtro Carteira, atualização e notícias salvas.

**Arquitetura:** regras puras em `src/domain/agenda.ts` e `src/data/news.ts`, persistência validada em `src/data/storage.ts`, telas em `src/ui`. Mesmo padrão das fases anteriores (injeção de `now`/`store` nos componentes para teste).

**Stack:** Vite, React 19, TypeScript, Vitest + Testing Library (sem dependência nova).

**Spec:** `docs/superpowers/specs/2026-10-28-agenda-noticias-fase3-4-design.md`

## Restrições globais

- Dados só em localStorage, validados ao carregar; dado inválido é descartado sem quebrar a tela.
- Duração de compromisso: inteiro de 5 a 720 minutos; padrão 60.
- Links de notícia: só `http:`/`https:`; `target="_blank"` e `rel="noopener noreferrer"`.
- Notícias salvas: chave `painel:v1:lastNews`, no máximo 50 itens.
- Tag de carteira: `Carteira`, quando o título normalizado contém `banco do brasil`, `bbas3`, `b3sa3` ou a palavra `b3`.
- Contagem: `hoje`, `amanhã`, `faltam N dias` (dias de calendário entre datas `AAAA-MM-DD`).
- Commits sem coautor; push ao fim das Tarefas 3, 6 e 7.
- Estilos só com os tokens existentes em `src/ui/styles.css`; alvos de toque de 44 px; foco visível.

## Foco de revisão

- Mês com 6 semanas (agosto de 2026 começa num sábado): o calendário não pode cortar o dia 30/31 → teste na Tarefa 1.
- Virada de ano na navegação (dezembro → janeiro e janeiro → dezembro) → teste na Tarefa 1.
- Evento semanal cuja data de início cai num dia não marcado: aparece só nos dias marcados, nunca antes do início → teste na Tarefa 1.
- Link de RSS relativo, sem protocolo ou `javascript:` → sem link na tela → testes nas Tarefas 2 e 4.
- Notícias salvas corrompidas ou com item sem título → ignoradas sem tela branca → teste na Tarefa 3.

---

### Tarefa 1: Regras da agenda

**Arquivos:** modificar `src/domain/agenda.ts`; teste `src/domain/agenda.test.ts`.

**Interfaces:**
- Produz:
  - `AgendaEvent` ganha `durationMin?: number` e `weekdays?: number[]` (0 = domingo; repete toda semana a partir de `date`).
  - `weekday(date: string): number` (exportada).
  - `occursOn(e: AgendaEvent, date: string): boolean`
  - `daysUntil(date: string, today: string): number`
  - `countdownLabel(days: number): string`
  - `type ImportantDate = { event: AgendaEvent; days: number }` e `importantDates(events: AgendaEvent[], today: string, limit?: number): ImportantDate[]` (padrão 5)
  - `shiftMonth(year: number, month: number, delta: number): { year: number; month: number }` (month 0 = janeiro)
  - `planDay` passa a usar `occursOn` e `durationMin ?? 60`.

- [ ] **Passo 1:** Testes: `evento semanal aparece só nos dias marcados e a partir do início` (início 2026-10-26, dias [1, 3]: true em 2026-10-28, false em 2026-10-27 e em 2026-10-21); `planDay usa a duração do compromisso` (Dentista 18:00, 90 min → `18:00-19:30 Dentista` e `19:30-20:30 Estudo: questões`); `planDay inclui evento semanal` (Academia toda quarta 18:00 desde 2026-10-01 aparece em 2026-10-28); `daysUntil e countdownLabel` (11 de 2026-10-28 a 2026-11-08; 0 → `hoje`, 1 → `amanhã`, 11 → `faltam 11 dias`); `importantDates lista só provas e mercado futuras, em ordem` (resultado: mercado 2026-11-04 com 7 dias, prova 2026-11-08 com 11; ignora pessoal, passada e semanal); `shiftMonth atravessa a virada do ano` ((2026, 11, +1) → (2027, 0); (2026, 0, −1) → (2025, 11)); `monthGrid de agosto de 2026 tem 6 semanas` (primeira `[null×6, 1]`, última `[30, 31, null×5]`).
- [ ] **Passo 2:** `npm test -- agenda` e ver falhar.
- [ ] **Passo 3:** Implementar.
- [ ] **Passo 4:** `npm test -- agenda` passa.
- [ ] **Passo 5:** Commit `feat: agenda com eventos semanais, duração, contagem e troca de mês`.

### Tarefa 2: Regras das notícias

**Arquivos:** modificar `src/data/news.ts`; testes `src/data/news.test.ts`; ajustar fixtures de `NewsItem` em `src/domain/signal.test.ts`, `src/ui/InvestmentsPage.test.tsx`, `src/ui/NewsPage.test.tsx`.

**Interfaces:**
- Produz: `NewsItem` ganha `link: string | null`; `safeLink(url: string | null | undefined): string | null`; `markPortfolio(items: NewsItem[]): NewsItem[]`; `parseRss` preenche `link` com `safeLink`.

- [ ] **Passo 1:** Testes: `safeLink aceita http e https e rejeita javascript:, data:, relativo e sem protocolo`; `parseRss guarda o link seguro de cada item` (`http://a/1` no primeiro item); `markPortfolio marca notícias que citam BB, BBAS3, B3 ou B3SA3` (`Banco do Brasil anuncia dividendos` e `B3 tem recorde` ganham `Carteira`; `Ibovespa sobe` não; não duplica a tag).
- [ ] **Passo 2:** Rodar e ver falhar.
- [ ] **Passo 3:** Implementar; adicionar `link: null` nas fixtures dos outros testes.
- [ ] **Passo 4:** `npm test` passa e `npm run build` sem erro de tipo.
- [ ] **Passo 5:** Commit `feat: notícias com link seguro e tag Carteira`.

### Tarefa 3: Armazenamento

**Arquivos:** modificar `src/data/storage.ts`; testes `src/data/storage-agenda.test.ts`, novo `src/data/storage-news.test.ts`.

**Interfaces:**
- Consome: `AgendaEvent` (Tarefa 1), `NewsItem` (Tarefa 2).
- Produz: `loadEvents` valida `durationMin` (inteiro 5–720) e `weekdays` (lista não vazia de inteiros 0–6); `type NewsCache = { at: string; items: NewsItem[] }`; `saveNews(cache: NewsCache, store?: Storage): boolean` (guarda no máximo 50 itens); `loadNews(store?: Storage): NewsCache | null`.

- [ ] **Passo 1:** Testes: `compromisso semanal com duração é salvo e carregado`; `duração fora de 5–720 ou dia da semana inválido é descartado`; `notícias salvas: salvar e carregar`; `salva no máximo 50 notícias`; `notícias salvas corrompidas devolvem null e itens sem título são descartados`.
- [ ] **Passo 2:** Rodar e ver falhar.
- [ ] **Passo 3:** Implementar.
- [ ] **Passo 4:** Rodar e ver passar.
- [ ] **Passo 5:** Commit; **marco 1:** push.

### Tarefa 4: Tela de Notícias

**Arquivos:** modificar `src/ui/NewsList.tsx`, `src/ui/NewsPage.tsx`, `src/ui/format.ts` (`dayTime`), `src/ui/styles.css`; teste `src/ui/NewsPage.test.tsx`.

**Interfaces:**
- Consome: `safeLink`, `markPortfolio`, `saveNews`, `loadNews`.
- Produz: `<NewsPage news store? now? />`; temas `Todas`, `Carteira`, `Mercado`, `Concursos`, `Tecnologia`; botão `Atualizar`; textos `Atualizado às HH:MM` e aviso de notícias salvas.

- [ ] **Passo 1:** Antes do código, carregar `frontend-design` e `ui-ux-pro-max` (rodar a busca da skill para lista de notícias e calendário no celular).
- [ ] **Passo 2:** Testes: `título da notícia abre o link em nova aba` (href, `target=_blank`, `rel` com `noopener`); `notícia com link perigoso aparece sem link`; `filtro Carteira mostra só notícias que citam BB ou B3`; `Atualizar busca de novo e mostra a hora`; `sem conexão mostra as notícias salvas com aviso`; os dois testes existentes continuam passando (com `localStorage.clear()` antes de cada um).
- [ ] **Passo 3:** Rodar e ver falhar.
- [ ] **Passo 4:** Implementar; salvar a busca que trouxe notícias; falha ou lista vazia → salvas com aviso `role="alert"`; sem salvas → `Não foi possível carregar as notícias.`
- [ ] **Passo 5:** Rodar e ver passar.
- [ ] **Passo 6:** Commit `feat: feed com links, filtro Carteira, atualizar e notícias salvas`.

### Tarefa 5: Tela da Agenda

**Arquivos:** modificar `src/ui/AgendaPage.tsx`, `src/ui/styles.css`; teste `src/ui/AgendaPage.test.tsx`.

**Interfaces:**
- Consome: tudo da Tarefa 1.
- Produz: região `Plano do dia` (título `Hoje, montado a partir da sua rotina` para hoje, `Plano de DD/MM/AAAA` para outro dia, botão `Voltar para hoje`); botões `Mês anterior` e `Próximo mês`; dias como botões com nome `D de mês` (+ `, N compromisso(s)`) e `aria-pressed` no selecionado; legenda; região `Datas importantes`; campo `Duração (min)`; grupo `Repetir toda semana`; lista `Toda semana`.

- [ ] **Passo 1:** Testes (os quatro existentes continuam): `próximo mês mostra novembro de 2026`; `clicar num dia mostra o plano daquele dia` (31 de outubro → `Plano de 31/10/2026` e `09:00–10:00`); `compromisso semanal aparece nas semanas seguintes` (Academia, quarta, 19:00 → `weekdays: [3]` salvo; em 4 de novembro o plano mostra Academia); `duração inválida mostra erro` (`2` → `duração entre 5 e 720 minutos`); `datas importantes mostram a contagem` (Prova PM em 2026-11-08, tipo prova → `faltam 11 dias`).
- [ ] **Passo 2:** Rodar e ver falhar.
- [ ] **Passo 3:** Implementar; clicar num dia também preenche a data do formulário.
- [ ] **Passo 4:** Rodar e ver passar.
- [ ] **Passo 5:** Commit `feat: agenda com calendário navegável, dia selecionado, repetição semanal e datas importantes`.

### Tarefa 6: Início

**Arquivos:** modificar `src/ui/HomePage.tsx`; novo teste `src/ui/HomePage.test.tsx`.

- [ ] **Passo 1:** Testes: `Início mostra a próxima data importante com a contagem` (`Prova PM · faltam 11 dias`); `Início mostra até três manchetes salvas com link`; `Início sem notícias salvas convida a abrir o feed`.
- [ ] **Passo 2:** Rodar e ver falhar.
- [ ] **Passo 3:** Implementar.
- [ ] **Passo 4:** Rodar e ver passar.
- [ ] **Passo 5:** Commit; **marco 2:** push.

### Tarefa 7: README e verificação no navegador

- [ ] **Passo 1:** README: agenda (semanal, duração, datas importantes) e notícias (links, Carteira, salvas).
- [ ] **Passo 2:** `npm test` e `npm run build` passam.
- [ ] **Passo 3:** `npm run dev`; conferir em 375 px e 1280 px, claro e escuro: sem rolagem horizontal, navegação do calendário por teclado (Tab + Enter), link abre em nova aba, feed real carrega.
- [ ] **Passo 4:** Commit; **marco 3:** push.

## Autoverificação

- Cobertura da spec: objetivos 1–2 (T1, T3, T5), 3 (T1, T5), 4 (T1, T5), 5 (T5), 6 (T2, T4), 7 (T2, T4), 8 (T4), 9 (T3, T4, T6), 10 (T6).
- Tipos conferidos: `AgendaEvent`, `ImportantDate`, `NewsItem.link`, `NewsCache` com os mesmos nomes da Tarefa 1 à 6.
