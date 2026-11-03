# Painel pessoal

Um lugar só para acompanhar investimentos, notícias e agenda.

## O que tem

- **Início:** a tela do dia a dia, em três partes.
  - **Investimentos:** um quadro para cada investimento, com o valor em reais e a variação do dia; o patrimônio com a variação do dia em reais e em %; uma barra fina com a divisão por classe e a meta de cada uma; a curva da evolução; e os ativos contra o Ibovespa e o CDI em 1 ano. Sem nada cadastrado, um botão leva ao cadastro.
  - **Calendário:** o mês com os dias de compromisso marcados. Tocar num dia mostra os seus compromissos nele. Embaixo ficam as próximas datas, com os vencimentos da renda fixa.
  - **Notícias:** os temas, a manchete com foto grande e as demais com miniatura.
  - **Arrumação:** no computador, três colunas (notícias, investimentos e calendário). Entre 900 e 1099 px, investimentos vai para cima. No celular, uma coluna na ordem investimentos, calendário e notícias.
- **Investimentos:** cadastro manual de qualquer investimento.
  - **Com cotação automática:** ações, FIIs, ETFs e BDRs da B3; ações e ETFs dos EUA, em reais pelo dólar do dia; criptomoedas; dólar e outras moedas. O código é conferido antes de salvar.
  - **Com valor digitado:** renda fixa (Tesouro Selic, IPCA+ e Prefixado, CDB, LCI, LCA, debênture, CRI/CRA e poupança, com índice, taxa e vencimento), fundos e previdência (PGBL ou VGBL).
  - **Na tela:** a lista por classe com o valor e a variação do dia; o motor quantitativo de cada ativo com cotação, em 3 meses, 1 ano ou 5 anos conforme o histórico dele, com MACD, Bollinger, Sharpe, Sortino, beta e o sinal das notícias; a comparação com o Ibovespa e o CDI em base 100; o teste de quatro estratégias contra comprar e segurar, com 0,1% de custo por troca; o simulador de aportes; o risco da carteira, com o mapa de correlação; a carteira de menor risco; a projeção com aportes em 1, 5 e 10 anos; a evolução do patrimônio; e a divisão pelas 8 classes contra a meta.
  - **Carteira antiga:** BBAS3, B3SA3 e a renda fixa da versão anterior entram sozinhas na lista nova, uma vez.
- **Agenda:** plano do dia montado pela sua rotina (notícias antes do trabalho e o trabalho), calendário navegável (toque num dia para ver o plano dele), compromissos com duração e repetição semanal (ex.: academia toda segunda e quarta) e datas importantes com contagem regressiva para provas e eventos de mercado. Os vencimentos da renda fixa entram sozinhos no calendário e nas datas, a partir da carteira, sem precisar cadastrar.
- **Notícias:** feed com foto de 15 fontes do Brasil e do mundo (g1, InfoMoney, TecMundo, BBC, The Guardian, The New York Times, Le Monde, El País, Der Spiegel e The Verge), com os temas Mercado, Mundo, Política, Tecnologia e Seus ativos (notícias que citam os códigos e os nomes da sua carteira). As notícias de fora são traduzidas para o português pelo DeepL; sem tradução, aparecem no original com a língua indicada. Tocar numa notícia abre a matéria em nova aba. Sem conexão, mostra as últimas notícias salvas.

Tudo fica salvo só no seu navegador (localStorage). Funciona no celular e no computador e pode ser instalado como app (PWA).

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal. Para ver os preços da B3, crie um token gratuito em brapi.dev e cole na aba Investimentos, seção Configurações. Os preços dos EUA, das criptos e das moedas não pedem token. Para traduzir as notícias de fora também em desenvolvimento, crie um arquivo `.env.local` (fica fora do Git) com `DEEPL_API_KEY=` e a sua chave.

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
- Preços: a B3 vem da brapi, com cota grátis de 15 mil chamadas por mês. O app atualiza de 15 em 15 minutos, só com a aba visível, e só chama a brapi de novo com o pregão aberto.
- Os EUA e o histórico de 5 anos vêm do Yahoo, pelo servidor. O Yahoo não é oficial e pode mudar ou bloquear. Se isso acontecer, o histórico guardado continua, e a brapi, a CoinGecko e a AwesomeAPI completam o que der.
- Cripto vem da CoinGecko e moedas da AwesomeAPI. Se uma fonte falhar, fica o último preço dela, marcado como velho.
- A variação do dia de um ativo dos EUA, em reais, junta a do ativo e a do dólar.
- Renda fixa, fundos e previdência valem o que você digitar.

## Aviso

O app mostra o tom das notícias ao lado do preço. Isso é um sinal de apoio, não uma previsão garantida, e não recomenda compra nem venda.
