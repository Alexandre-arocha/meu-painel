# Fase 5: Publicar e sincronizar — Plano de implementação

> **Para quem for executar:** superpowers:executing-plans (nativo, tudo de uma vez). Passos com checkbox.

**Objetivo:** publicar na Vercel com login por senha única, funções para preços e notícias, e sincronização dos dados num Postgres da Neon.

**Arquitetura:** regras do servidor em `server/` (testáveis, sem Vercel); `api/` só embrulha as regras nas rotas da Vercel (Web `Request`/`Response`, exportações `GET`/`POST`/`PUT`). No navegador, `src/sync.ts` puxa os dados ao entrar e envia cada gravação de `storage.ts`. Em `npm run dev` nada muda.

**Stack:** Vite + React, funções Node da Vercel, `@neondatabase/serverless`, Web Crypto (HMAC-SHA256).

**Spec:** `docs/superpowers/specs/2026-10-28-publicar-sincronizar-fase5-design.md`

## Restrições globais

- Segredos só em `process.env` (`APP_PASSWORD`, `BRAPI_TOKEN`, `DATABASE_URL`); nada disso em código, teste com valor real ou navegador.
- Cookie `painel_session`: `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`.
- Chaves sincronizadas (`SYNC_KEYS`): `painel:v1:portfolio`, `painel:v1:settings` (sem `brapiToken`), `painel:v1:attempts`, `painel:v1:questions`, `painel:v1:events`, `painel:v1:routine`.
- Imports relativos do servidor com extensão `.js` (o pacote é `"type": "module"`).
- Commits sem coautor.

## Foco de revisão

- Cookie com validade ou assinatura adulterada → 401 (Tarefa 1).
- Primeira entrada com banco vazio não apaga os dados do aparelho (Tarefa 4).
- Gravação sem rede fica pendente e é enviada depois (Tarefa 4).
- `brapiToken` antigo guardado nas configurações não sobe para o banco (Tarefa 4).
- Chave fora de `SYNC_KEYS` ou corpo acima de 1 MB → 400 (Tarefa 2).

---

### Tarefa 1: Sessão (`server/session.ts`)

**Produz:** `SESSION_COOKIE`; `signSession(secret: string, now: number): Promise<string>` (`"<expira_ms>.<hmac_hex>"`); `verifySession(cookieHeader: string | null, secret: string, now: number): Promise<boolean>`; `checkPassword(input: string, secret: string): Promise<boolean>`; `sessionCookie(token: string): string`; `clearSessionCookie(): string`.

- [ ] Testes (`server/session.test.ts`, ambiente node): `sessão vale por 30 dias e expira depois`; `assinatura ou validade adulterada é recusada`; `sessão de outra senha é recusada`; `checkPassword aceita a certa e recusa errada e vazia`; `cookie tem HttpOnly, Secure, SameSite=Strict e Max-Age de 30 dias`.
- [ ] Ver falhar → implementar → ver passar → commit.

### Tarefa 2: Rotas do servidor (`server/api.ts`, `server/kv.ts`, `src/data/syncKeys.ts`)

**Produz:** `type Env`, `type Kv = { all(): Promise<Record<string, unknown>>; put(key: string, value: unknown): Promise<void> }`, `type Deps = { env: Env; kv?: () => Kv; fetchFn?: typeof fetch; now?: () => number; delay?: (ms: number) => Promise<void> }`; `handleLogin`, `handleLogout`, `handleSession`, `handleData`, `handleNews`, `handleBrapi(req, endpoint, deps)`; `createKv(databaseUrl)` (Neon; sem teste unitário, verificado no deploy).

- [ ] Testes (`server/api.test.ts`, node, kv e fetch falsos): `login com senha certa devolve cookie`; `login errado espera 400 ms e devolve 401`; `sem APP_PASSWORD o login devolve 500`; `rotas protegidas sem sessão devolvem 401`; `data GET devolve os itens e PUT grava chave permitida`; `data PUT recusa chave fora da lista e corpo acima de 1 MB`; `news busca no Google Notícias com q e devolve XML`; `news recusa q vazio ou acima de 100 caracteres`; `brapi repassa a query com o token do servidor e só aceita quote e historical`; `brapi sem BRAPI_TOKEN devolve 503`.
- [ ] Ver falhar → implementar → ver passar → commit.

### Tarefa 3: Rotas da Vercel e configuração

**Arquivos:** `api/login.ts`, `api/logout.ts`, `api/session.ts`, `api/data.ts`, `api/news/search.ts`, `api/brapi/[endpoint].ts`, `server/deps.ts`, `tsconfig.server.json` (referenciado em `tsconfig.json`), dependência `@neondatabase/serverless`.

- [ ] `npm run build` passa com o `tsconfig.server.json` checando `api/` e `server/`; commit; **marco 1:** push.

### Tarefa 4: Cliente (`src/sync.ts`, `storage.ts`, `prices.ts`)

**Produz:** `setWriteListener(fn: ((key: string) => void) | null)` em `storage.ts`; `createProxyPriceProvider(fetchFn?, now?): PriceProvider` (base `/api/brapi`, sem token; 503 → `token da brapi não cadastrado na Vercel`); `pullAll(fetchFn, store): Promise<'empty' | 'pulled'>`; `createSync(fetchFn, store): { queue(key: string): void; flush(): Promise<void>; queueAll(): void }`; `startSync(fetchFn, store): Promise<void>`.

- [ ] Testes: `listener recebe a chave gravada e não é chamado se a gravação falha`; `provedor do servidor chama /api/brapi sem Authorization`; `503 vira mensagem de token não cadastrado`; `pullAll grava os valores do banco`; `pullAll com banco vazio não mexe nos dados locais`; `flush envia o valor atual e limpa a pendência`; `sem rede a pendência fica guardada`; `settings sobe sem brapiToken`; `chave fora da lista não é enviada`; `startSync com banco vazio envia os dados locais`.
- [ ] Ver falhar → implementar → ver passar → commit.

### Tarefa 5: Telas (`LoginPage`, `App`, `InvestmentsPage`)

**Produz:** `<LoginPage onLogin fetchFn? />`; `App` com `auth?: boolean` (padrão `import.meta.env.PROD`) e `fetchFn?`; botão `Sair`; `InvestmentsPage` com `serverPrices?: boolean` (esconde o campo de token).

- [ ] Testes: `senha errada mostra "senha incorreta"`; `App com auth e sem sessão mostra a entrada`; `entrar sincroniza e mostra o Início`; `Sair volta para a entrada`; `com preços no servidor não aparece campo de token`.
- [ ] Ver falhar → implementar → ver passar → commit; **marco 2:** push.

### Tarefa 6: Publicar

- [ ] Carregar as skills da Vercel; criar o projeto `meu-painel` ligado ao GitHub (MCP da Vercel).
- [ ] Passar ao dono os 3 passos da spec (banco, `APP_PASSWORD`, `BRAPI_TOKEN`); depois do deploy, conferir: sem senha → tela de entrada e `/api/data` 401; com senha → dados, preços e notícias; celular (375 px).
- [ ] README com "Como publicar"; commit; **marco 3:** push; PR.

## Autoverificação

- Spec: objetivo 1 (T3, T6), 2 (T1, T2, T5), 3 (T2, T4), 4 (T2, T4), 5 (T2).
- Nomes: `SYNC_KEYS`, `Kv`, `Deps`, `createProxyPriceProvider`, `setWriteListener` iguais em todas as tarefas.
