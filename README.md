# Painel pessoal

Um lugar só para acompanhar investimentos, notícias, estudos para concursos e agenda.

## O que tem

- **Início:** a tela única para usar no dia a dia. No topo ficam a data, os preços de BBAS3 e B3SA3, o total da carteira e o estudo do dia. Logo abaixo vêm o feed de notícias com filtro por tema, a questão do dia para responder na hora, a divisão da carteira contra a meta, a agenda de hoje e a próxima data importante. No celular, tudo vira uma coluna.
- **Investimentos:** carteira (BBAS3, B3SA3 e renda fixa), preço do dia, notícias com tom, sinal de apoio e divisão atual contra a meta.
- **Estudos:** banco de questões (Informática/TI, Português, RLM e Constituição/Forças Armadas), caderno de erros, desempenho por matéria e importação das suas questões em JSON. Matérias com mais erros aparecem mais.
- **Agenda:** plano do dia montado pela sua rotina (trabalho, notícias e estudo), calendário navegável (toque num dia para ver o plano dele), compromissos com duração e repetição semanal (ex.: academia toda segunda e quarta) e datas importantes com contagem regressiva para provas e eventos de mercado.
- **Notícias:** feed de mercado, concursos e tecnologia com filtro por tema e filtro "Carteira" (notícias que citam Banco do Brasil ou B3). Cada título abre a matéria em nova aba. Sem conexão, mostra as últimas notícias salvas.

Tudo fica salvo só no seu navegador (localStorage). Funciona no celular e no computador e pode ser instalado como app (PWA).

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal. Para ver os preços, crie um token gratuito em brapi.dev e cole na aba Investimentos, seção Configurações.

Testes: `npm test`. Build: `npm run build`.

## Como publicar (Vercel)

O projeto `meu-painel` já está na Vercel, ligado a este repositório: cada merge na `main` publica sozinho. Publicado, o painel pede uma senha, sincroniza os dados entre aparelhos num banco Postgres da Neon e busca preços e notícias pelas funções em `api/`.

Passos que só o dono faz (senhas e tokens nunca vão para o código):

1. Na Vercel, projeto `meu-painel` → **Storage** → criar ou conectar um banco **Neon** (cria a variável `DATABASE_URL`).
2. **Settings → Environment Variables**: cadastrar `APP_PASSWORD` (senha forte, só sua) e `BRAPI_TOKEN`, para Production e Preview.
3. **Deployments → Redeploy** para as variáveis valerem.
4. Entre primeiro no aparelho que já tem os seus dados (o computador): o que o banco ainda não tem sobe dele. Depois entre no celular.

## Importar questões

Cole na aba Estudos uma lista em JSON neste formato (`answer` é o índice da opção certa, começando em 0):

```json
[{ "id": "q1", "subject": "Português", "statement": "Qual palavra está correta?", "options": ["exceção", "excessão"], "answer": 0, "explanation": "opcional" }]
```

## Limites conhecidos

- Sincronização: vale a última gravação; editar a mesma coisa em dois aparelhos ao mesmo tempo mantém só uma das versões.
- O tom das notícias usa palavras-chave e marca a maioria como neutra.
- O aviso de dado velho não conhece os feriados da B3.

## Aviso

O app mostra o tom das notícias ao lado do preço. Isso é um sinal de apoio, não uma previsão garantida, e não recomenda compra nem venda.
