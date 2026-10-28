# Fase 5: Publicar e sincronizar

Data: 2026-10-28. Estado: decisões do dono tomadas; execução direta.

## Intenção

O dono quer usar o painel "nos dois" (celular e computador), em qualquer lugar. Hoje ele só roda com `npm run dev`, as notícias dependem do proxy do Vite e cada aparelho guarda os próprios dados.

## Decisões do dono

- Publicar na conta Vercel dele, ligada ao repositório do GitHub (cada merge na `main` publica).
- Sincronizar os dados num banco Postgres da Neon, protegido por uma senha só dele.
- Token da brapi no servidor, nunca no navegador.

## Objetivos

1. App publicado em https na Vercel, com deploy automático da `main`.
2. Entrada por senha única (`APP_PASSWORD`); sessão de 30 dias em cookie `HttpOnly`, `Secure`, `SameSite=Strict`.
3. Sincronizar carteira, configurações (sem token), tentativas de questões, questões importadas, compromissos e rotina.
4. Preços pela função `/api/brapi/*` com `BRAPI_TOKEN`; notícias pela função `/api/news/search`.
5. Toda rota de `/api`, menos a de entrar, exige sessão válida.

## Fora do escopo

- Várias pessoas, cadastro, recuperar senha, domínio próprio.
- Mesclar edições simultâneas em aparelhos diferentes (vale a última gravação).

## O que seria um fracasso

- Ver dados ou usar as funções sem a senha.
- Token, senha ou string do banco no código, no repositório ou no navegador.
- Perder os dados locais na primeira sincronização (banco vazio apagando o aparelho).

## Restrições

- Segredos só nas variáveis de ambiente da Vercel, cadastradas pelo dono. Claude não vê nem digita senha, token ou string de conexão.
- Única dependência nova: `@neondatabase/serverless`.
- Commits só com o dono como autor; PR para a `main`.

## Chamadas minhas (podem ser trocadas)

- Cookie assinado com HMAC-SHA256 cuja chave é a própria `APP_PASSWORD`: trocar a senha derruba todas as sessões.
- Senha errada responde depois de 400 ms, para atrasar tentativas em série.
- Tabela única `painel_kv(key text primary key, value jsonb, updated_at timestamptz)`, criada na primeira chamada.
- Ao entrar: se o banco estiver vazio, o aparelho envia os dados dele; se não, os dados do banco substituem os locais.
- Cada gravação local é enviada ao banco; sem rede, fica pendente e vai quando a conexão voltar ou o app abrir de novo.
- Gravação acima de 1 MB é recusada.
- Em desenvolvimento (`npm run dev`) não há login nem sincronização; tudo continua como hoje.

## Passos do dono

1. Na Vercel, abrir o projeto `meu-painel` → Storage → conectar um banco Neon (cria `DATABASE_URL`).
2. Em Settings → Environment Variables, cadastrar `APP_PASSWORD` (uma senha forte) e `BRAPI_TOKEN`.
3. Fazer um novo deploy (ou mesclar o PR) para as variáveis valerem.
