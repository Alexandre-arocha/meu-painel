# Painel pessoal

Um lugar só para acompanhar investimentos, notícias e agenda.

## O que tem

- **Início:** a tela única para usar no dia a dia. No topo ficam a data, os preços de BBAS3 e B3SA3 e o total da carteira. Logo abaixo vêm o feed de notícias com filtro por tema, a divisão da carteira contra a meta, a agenda de hoje e a próxima data importante. No celular, tudo vira uma coluna.
- **Investimentos:** carteira (BBAS3, B3SA3 e renda fixa), preço do dia, notícias com tom, sinal de apoio e divisão atual contra a meta.
- **Agenda:** plano do dia montado pela sua rotina (notícias antes do trabalho e o trabalho), calendário navegável (toque num dia para ver o plano dele), compromissos com duração e repetição semanal (ex.: academia toda segunda e quarta) e datas importantes com contagem regressiva para provas e eventos de mercado.
- **Notícias:** feed com foto de 15 fontes do Brasil e do mundo (g1, InfoMoney, TecMundo, BBC, The Guardian, The New York Times, Le Monde, El País, Der Spiegel e The Verge), com os temas Mercado, Mundo, Política, Tecnologia e Seus ativos (notícias que citam Banco do Brasil ou B3). As notícias de fora são traduzidas para o português pelo DeepL; sem tradução, aparecem no original com a língua indicada. Tocar numa notícia abre a matéria em nova aba. Sem conexão, mostra as últimas notícias salvas.

Tudo fica salvo só no seu navegador (localStorage). Funciona no celular e no computador e pode ser instalado como app (PWA).

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal. Para ver os preços, crie um token gratuito em brapi.dev e cole na aba Investimentos, seção Configurações. Para traduzir as notícias de fora também em desenvolvimento, crie um arquivo `.env.local` (fica fora do Git) com `DEEPL_API_KEY=` e a sua chave.

Testes: `npm test`. Build: `npm run build`.

## Como publicar (Vercel)

O projeto `meu-painel` já está na Vercel, ligado a este repositório: cada merge na `main` publica sozinho. Publicado, o painel pede uma senha, sincroniza os dados entre aparelhos num banco Postgres da Neon e busca preços e notícias pelas funções em `api/`.

Passos que só o dono faz (senhas e tokens nunca vão para o código):

1. Na Vercel, projeto `meu-painel` → **Storage** → criar ou conectar um banco **Neon** (cria a variável `DATABASE_URL`).
2. **Settings → Environment Variables**: cadastrar `APP_PASSWORD` (senha forte, só sua), `BRAPI_TOKEN` e `DEEPL_API_KEY` (chave grátis do DeepL API Free, que termina em `:fx`), para Production.
3. **Deployments → Redeploy** para as variáveis valerem.
4. Entre primeiro no aparelho que já tem os seus dados (o computador): o que o banco ainda não tem sobe dele. Depois entre no celular.

## Limites conhecidos

- Sincronização: vale a última gravação; editar a mesma coisa em dois aparelhos ao mesmo tempo mantém só uma das versões.
- O tom das notícias usa palavras-chave e marca a maioria como neutra.
- Tradução: o plano grátis do DeepL dá 500 mil letras por mês. O app traduz só as manchetes que estão na tela e guarda as traduções no aparelho; se a cota acabar, as notícias aparecem no original até o mês virar.
- O aviso de dado velho não conhece os feriados da B3.

## Aviso

O app mostra o tom das notícias ao lado do preço. Isso é um sinal de apoio, não uma previsão garantida, e não recomenda compra nem venda.
