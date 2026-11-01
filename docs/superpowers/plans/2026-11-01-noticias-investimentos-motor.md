# Plano: notícias do mundo, todos os investimentos e motor quantitativo completo

## Contexto

Você mandou um desenho da tela inicial: notícias com foto à esquerda, investimentos no meio e calendário à direita. Depois pediu mais três coisas:

- mais tipos de investimento;
- um motor quantitativo melhor;
- notícias do mundo todo, em qualquer língua, traduzidas para o português.

Hoje o app só conhece BBAS3, B3SA3 e um valor de renda fixa, e o código fixa essas três coisas. As notícias vêm só do Google News, sem foto, e a tela inicial ainda tem a questão do dia.

**O que você decidiu:**

- **Investimentos:** cadastro manual de qualquer tipo, com preço automático onde existe fonte grátis.
- **Tipos novos:** criptomoedas, dólar e outras moedas, ações e ETFs dos EUA, BDRs e renda fixa detalhada (Tesouro, CDB, LCI, LCA, debêntures, poupança e previdência).
- **Estudos:** saem do app todo.
- **Notícias:** mercado e economia, política, seus ativos, tecnologia e o mundo. As estrangeiras são traduzidas pelo DeepL.
- **Histórico:** vem do Yahoo, e o app guarda o que baixar. A brapi entra como reserva.
- **Motor quantitativo:**
  - funciona com todos os ativos;
  - compara com Ibovespa e CDI;
  - mostra a evolução do patrimônio;
  - põe os vencimentos no calendário;
  - ganha indicadores e períodos novos;
  - testa várias estratégias;
  - projeta o patrimônio com aportes;
  - calcula a carteira de menor risco.

## Fontes de dados (todas testadas ao vivo)

| Dado | Fonte | Como chega | Custo e limite |
| --- | --- | --- | --- |
| Preço ao vivo de ações, FIIs, ETFs e BDRs | brapi, que já está no app | Pelo servidor, com o token na Vercel | Grátis, 15 mil chamadas por mês |
| Histórico de 5 anos de B3, EUA, Ibovespa (`^BVSP`), S&P 500, dólar e euro (`BRL=X`, `EURBRL=X`), mais o preço das ações dos EUA | Yahoo, não oficial, já ajustado por proventos | Pelo servidor, porque o navegador não pode ler o Yahoo direto | Grátis |
| Cripto em reais: preço, variação e 365 dias | CoinGecko | Direto do navegador | Grátis |
| Moedas: cotação e 90 dias | AwesomeAPI | Direto do navegador | Grátis |
| CDI, Selic e IPCA | Banco Central (SGS 12, 432 e 433) | Direto do navegador, em menos de 0,5 s | Grátis |
| Notícias com foto | Feeds RSS, listados abaixo | Pelo servidor, só ids de uma lista fixa | Grátis |
| Notícias "Seus ativos" | Google News, como hoje | Pelo servidor | Grátis, sem foto |
| Tradução | DeepL API Free | Pelo servidor, com a chave na Vercel | 500 mil letras por mês |

**Feeds com foto conferidos:**

| Região | Fontes |
| --- | --- |
| Brasil | g1 Economia, Política e Tecnologia; InfoMoney; TecMundo |
| Mundo | BBC World e Business; Guardian World e Business; NYT World e Business; Le Monde (fr); El País (es); Spiegel (de); The Verge |

## Tela inicial

```
Computador (≥1100 px)
┌──────────────┬────────────────────────────────┬──────────────┐
│ NOTÍCIAS     │ INVESTIMENTOS                  │ CALENDÁRIO   │
│ Tudo Mundo…  │ Ibov +0,8%  Dólar 5,44  S&P…  │  novembro ‹› │
│ ┌──────────┐ │ Patrimônio  R$ 48.320,00       │ D S T Q Q S S│
│ │  foto    │ │ +R$ 210,40 (+0,44%) hoje       │ · · ● · · · ·│
│ └──────────┘ │ ▬▬▬▬▬▬▬ ▬▬▬ ▬▬ ▬ (classes)     │ Hoje         │
│ Manchete     │ Renda fixa 55% · Ações 25% …   │ 08:45 Notíc. │
│ BBC · do inglês │ BBAS3 +1,2%  R$ 1.646,00    │ Próximas     │
│ ▢ título     │ BTC  -0,3%  R$ 2.100,00        │ CDB vence 12d│
│ Ver todas ›  │ Bolsa 1 ano: você · Ibov · CDI │ Abrir agenda │
└──────────────┴────────────────────────────────┴──────────────┘
Celular: uma coluna, na ordem Investimentos → Calendário → Notícias.
```

## Fases

Cada fase vira um ramo e um PR, sem marca de coautoria. Só mesclo com o seu OK. Se o PR anterior ainda não estiver mesclado, a fase seguinte parte do ramo dele.

Toda mudança começa pelo teste (TDD). Antes de cada commit eu rodo o `/simplify`. Componentes e CSS que ficarem sem uso são apagados na mesma fase.

### Fase 1: app sem estudos, notícias do mundo com foto e tradução (`feat/noticias-do-mundo`)

**Tirar os estudos:**

- **Apagar:** `StudyPage`, `QuestionView`, `domain/study.ts`, `data/questions.ts` e os testes deles.
- **`storage.ts` e `syncKeys.ts`:** sair as funções e as chaves de `attempts` e `questions`.
- **`App.tsx`:** sai a aba Estudos. Quem abrir `#/estudos` cai no Início.
- **`HomePage`:** saem a questão e o "Estudo hoje".
- **Agenda:**
  - `planDay` deixa de montar o bloco de estudo, e a rotina perde `studyMinutes`. `loadRoutine` aceita a rotina com ou sem esse campo.
  - Some o tipo "Estudo".
  - `loadEvents` converte eventos antigos do tipo `estudo` em `pessoal`, para nenhum compromisso sumir.
- **Notícias:** saem as buscas de concursos.

**Notícias:**

- **`src/data/feeds.ts`:** um mapa `id → { url, source, tag, lang }`, usado pelo navegador, pelo servidor e pelo Vite. Os temas são Mercado, Mundo, Política e Tecnologia.
- **Servidor:**
  - **`handleFeed`:** exige sessão, aceita só ids do mapa (assim não vira proxy aberto) e tem tempo limite.
  - **`handleTranslate`:** recebe um POST com até 50 textos, cada um com até 500 letras. Exige sessão e usa `DEEPL_API_KEY`. Se a chave termina em `:fx`, usa `api-free.deepl.com`, com `target_lang: 'PT-BR'`. Os erros viram mensagens claras: 456 vira "cota do mês acabou", 403 vira "chave inválida" e sem chave vira 503.
  - **Rotas novas:** `api/news/feed.ts` e `api/translate.ts`.
  - **Em desenvolvimento:** um plugin no `vite.config.ts` chama as mesmas funções do servidor, sem a checagem de sessão. A chave fica num `.env.local` que não vai para o Git.
- **Leitura dos feeds:**
  - `parseRss` passa a ler também Atom (`entry`), usado pelo The Verge.
  - Ganha `image`, procurada em `media:content` (o maior), `media:thumbnail`, `enclosure` de imagem ou o primeiro `<img>` da descrição. Só entram URLs `https` que passam por `safeLink`.
  - Ganha também `lang` e `original`, o título antes da tradução.
- **Tradução:**
  - O `NewsFeed` traduz só as manchetes estrangeiras que estão na tela.
  - As traduções ficam guardadas em `painel:v1:translations`, só neste aparelho, até 1000.
  - O pedido ao DeepL vai em lotes por língua.
  - O tom (`lexiconClassifier`) é calculado sobre o título traduzido.
  - Se a tradução falhar, aparece o título original com o rótulo "em inglês".
- **Tela:**
  - Foto com `alt=""`, `loading="lazy"`, `referrerPolicy="no-referrer"` e proporção fixa. Se a foto falhar, ela some.
  - Rótulo "BBC · traduzido do inglês".
  - Temas: Tudo, Mercado, Mundo, Política, Tecnologia e Seus ativos. A tag "Carteira" vira "Seus ativos".
  - A página Notícias vira uma grade de cartões.

**Testes:**

- RSS e Atom, as formas de achar a foto e a recusa de `javascript:` e `http`;
- o cache antigo, sem foto;
- `handleFeed`: 401, 404 e 200;
- `handleTranslate`:
  - recusa sem sessão, textos demais e falta de chave;
  - o 456;
  - o servidor certo, o cabeçalho `DeepL-Auth-Key` e a ordem das traduções mantida;
- o cache de traduções;
- o original aparecendo quando a tradução falha;
- a conversão de `estudo` em `pessoal` e a rotina sem `studyMinutes`.

### Fase 2: carteira com todos os tipos de investimento (`feat/carteira-completa`)

**Modelo** (`src/domain/portfolio.ts`, reescrito):

- **Com preço automático:** `acao`, `fii`, `etf`, `bdr`, `exterior`, `cripto` e `moeda`, cada um com `symbol` e `quantity`. Exterior, cripto e moeda aceitam fração.
- **Com valor digitado:**
  - `renda-fixa`, com um destes subtipos:

    | Grupo | Subtipos |
    | --- | --- |
    | Tesouro | Selic, IPCA+, Prefixado |
    | Bancários | CDB, LCI, LCA |
    | Crédito | Debênture, CRI/CRA |
    | Outros | Poupança |

  - `fundo`;
  - `previdencia` (PGBL ou VGBL).

  Cada um tem `name`, `amount` e opcionalmente o índice (`cdi`, `ipca`, `selic` ou `pre`), a taxa e o vencimento.
- **8 classes**, para as metas e a barra: Renda fixa, Ações, FIIs, ETFs, Exterior (EUA e BDRs), Cripto, Moedas e Fundos (fundos e previdência).
- **Funções:** validação por tipo, `totals` (com a conversão do dólar para reais) e `fromLegacy`.

**Onde os dados ficam:**

- **Nova chave sincronizada:** `painel:v1:positions`.
- **Migração:** acontece uma vez, a partir da `painel:v1:portfolio`, que continua intacta. Assim uma versão velha do app em outro aparelho não apaga nada.
- **Metas:** ficam por classe, em `classTargets` nos Settings. São derivadas de `targetAllocation` quando não existirem.

**Preços:**

- **`/api/history`, um `handleHistory` novo:**
  - exige sessão;
  - aceita o símbolo só num formato restrito;
  - aceita só os períodos 5d, 3mo, 1y, 5y e 10y;
  - lê o Yahoo e devolve `{ currency, price, previousClose, t[], c[] }`, com `c` vindo do `adjclose`.
  - O plugin do Vite atende a mesma rota em desenvolvimento.
- **`usePrices(positions)`**, no lugar de `useQuotes`:
  - **B3:** brapi, uma chamada por ticker.
  - **EUA:** `/api/history` com o período 5d, convertido pelo dólar da AwesomeAPI.
  - **Cripto:** uma chamada à CoinGecko para todas.
  - **Moedas:** uma chamada à AwesomeAPI para todas.
  - **Quando atualiza:** só com o mercado aberto (`marketOpen`, tirado de `isStale`) e a aba visível. Se um preço falhar, fica o último guardado, marcado como velho.
- **`useHistory(positions)` unificado:**
  - Pede o Yahoo com o período de 5 anos.
  - Se falhar, usa a brapi (3 meses), a CoinGecko (365 dias) ou a AwesomeAPI (90 dias).
  - **Guardar:** o histórico fica guardado por data em `painel:v1:prices`, só neste aparelho. Cada busca junta o que veio com o que já existia, então ele só cresce.

**Tela Investimentos:**

- **`PositionsCard`** substitui `PortfolioCard`:
  - lista os ativos agrupados por classe, com o valor em reais e a variação do dia;
  - o formulário "Adicionar investimento" muda os campos conforme o tipo;
  - antes de salvar, confere se o ativo existe, com uma consulta;
  - deixa editar e remover, com confirmação.
- **`AllocationCard`:** a meta passa a ser pelas 8 classes.
- **Saem:** `QuoteCard` e `NewsList`. O sinal das notícias vai para o motor.

**Motor nesta fase:** os botões listam todos os ativos com preço, na janela atual de 3 meses. O simulador de aportes passa a dividir pela meta de cada classe.

**"Seus ativos":** passa a buscar os tickers da B3 e dos EUA da carteira.

**Testes:**

- a validação de cada tipo;
- `totals` com o dólar;
- a migração;
- a leitura de cada fonte, com `fetch` falso;
- `handleHistory`: validação, conversão e erros;
- o `usePrices` agrupando por fonte e pausando;
- o guardar, juntando sem perder dias;
- a reserva quando o Yahoo falha;
- o formulário com cada tipo.

### Fase 3: tela inicial nova (`feat/inicio-novo`)

- **`HomePage`** reescrita em três seções. A linha de números antiga sai.
  - **Notícias:** os temas, a manchete com foto grande, as demais com miniatura e o rótulo de tradução.
  - **Investimentos:**
    - uma faixa "Mercados hoje" com Ibovespa, dólar, S&P 500 e Bitcoin;
    - o patrimônio em número grande e a variação do dia em R$ e em %;
    - a barra fina das 8 classes, com espaços de 2 px;
    - a legenda com % e meta;
    - até 6 ativos;
    - estado vazio com o botão "Cadastrar investimentos".
  - **Calendário:**
    - um `MonthCalendar` extraído da `AgendaPage` e usado nas duas telas;
    - tocar num dia mostra os itens dele;
    - "Hoje" vem de `planDay` e "Próximas datas" vem de `importantDates`.
- **Vencimentos:** `maturityEvents(positions)` gera os eventos "Vence: …" do tipo `mercado`. Eles aparecem no Início e na Agenda, mas não são salvos e não têm botão de apagar.
- **CSS:**
  - `grid-template-areas`: três colunas a partir de 1100 px;
  - entre 900 e 1099 px, Investimentos em cima e Notícias e Calendário lado a lado;
  - no celular, uma coluna.
- **Cores:** rodo o `validate_palette.js` com as 8 cores das classes, nos dois temas.
- **Testes:**
  - a ordem das seções;
  - o estado vazio;
  - o vencimento no calendário;
  - tocar num dia;
  - a faixa de mercados com uma fonte falhando.

### Fase 4: motor por ativo (`feat/motor-ativo`)

- **Períodos:** 3 meses, 1 ano e 5 anos, conforme o histórico disponível. Cripto vai até 1 ano.
  - As médias do gráfico são de 9 e 21 dias em 3 meses, e de 50 e 200 dias em 1 ano e 5 anos.
- **Indicadores novos** em `domain/quant.ts`, cada um com teste:
  - `ema` e `macd` (12, 26, 9);
  - `bollinger` (20 dias, 2 desvios, posição em %);
  - `sharpe` e `sortino`, contra o CDI;
  - `beta` e correlação com o Ibovespa (`^BVSP`).
- **CDI:**
  - `src/data/cdi.ts` busca a série 12 do SGS no período, com tempo limite de 15 s;
  - o resultado fica guardado por dia, só neste aparelho;
  - `cdiIndex` acumula o CDI nos pregões;
  - `indexTo100` põe tudo na mesma base.
- **Comparação:** gráfico com o ativo, o Ibovespa e o CDI em base 100, num eixo só. Ativos de fora entram convertidos para reais.
- **Estratégias:**
  - `backtest(values, sinal, custo)` passa a ser genérico;
  - compara cruzamento de médias, RSI 30/70, Bollinger e momentum de 3 meses contra comprar e segurar;
  - desconta 0,1% a cada troca de posição;
  - mostra uma tabela com retorno, maior queda e número de trocas, e um gráfico com até 5 linhas;
  - deixa o aviso de que não é recomendação.
- **Tela:** o "Como ler os números" é atualizado. Os gráficos usam `LineChart` e `ChartTable`.
- **Testes:**
  - cada indicador com valores conhecidos;
  - as estratégias numa série de exemplo;
  - o CDI com falha e com cache.

### Fase 5: motor da carteira (`feat/motor-carteira`)

- **Risco:**
  - volatilidade, VaR e CVaR de 95% em 1 dia e maior queda da carteira de hoje no período;
  - quanto cada ativo contribui para o risco;
  - um mapa de correlação em cores divergentes (azul, cinza, laranja), validado e com tabela ao lado.
- **Menor risco e melhor retorno por risco:**
  - uma busca com 5000 carteiras aleatórias, só com pesos positivos e sorteio de semente fixa, usando `portfolioRisk` e `stdev`;
  - uma tabela com o peso atual, o de menor risco e o de melhor Sharpe;
  - uma nuvem de risco contra retorno, com a sua carteira marcada;
  - o aviso de que é estudo do passado.
- **Projeção com aportes:**
  - Monte Carlo com semente fixa, 2000 caminhos mensais, o aporte mensal digitado e horizontes de 1, 5 e 10 anos;
  - **bolsa, cripto e moedas:** calibrados no histórico;
  - **renda fixa:** pelo índice. CDI, Selic e IPCA vêm do SGS. A poupança segue a regra oficial a partir da Selic;
  - um gráfico em leque com os cenários ruim (10%), médio (50%) e bom (90%), e uma tabela ao lado;
  - o aviso de que é antes do imposto de renda.
- **Evolução do patrimônio:**
  - **Onde fica:** nova chave sincronizada `painel:v1:snapshots`, no formato `{ data: total }`, com até 1000 dias.
  - **Quando grava:** quando todos os preços carregaram.
  - **Onde aparece:** gráfico em Investimentos e curva pequena no Início.
  - **Comparação no Início:** "Bolsa em 1 ano: você · Ibovespa · CDI".
- **Testes:**
  - o sorteio repetível;
  - a carteira de menor risco num caso de 2 ativos com resposta conhecida;
  - o Monte Carlo com volatilidade zero, que precisa dar o valor exato;
  - os cenários em ordem;
  - a gravação e o limite dos snapshots.

## O que você vai fazer (eu guio no navegador)

Antes de a Fase 1 ir ao ar, crie a conta do DeepL API Free. Ela pede um cartão só para verificação. Depois:

1. Copie a chave, que termina em `:fx`.
2. Cole a chave na Vercel como `DEEPL_API_KEY`, em Production.
3. Faça um novo deploy.

Enquanto a chave não estiver lá, as notícias de fora aparecem no idioma original, com o rótulo do idioma.

## Limites e riscos

- **Yahoo:**
  - é não oficial e pode bloquear os servidores da Vercel ou mudar o formato;
  - se isso acontecer, o histórico guardado continua e a brapi, a CoinGecko e a AwesomeAPI completam;
  - as ações dos EUA dependem dele para o preço: se ele cair, fica o último preço, marcado como velho;
  - isso é conferido depois de cada deploy.
- **DeepL:** o limite é de 500 mil letras por mês. O app traduz só o que aparece na tela e guarda as traduções, o que dá cerca de 240 mil por mês. Se a cota acabar, as notícias aparecem no original até o mês virar.
- **Renda fixa, fundos e previdência:** o valor é o que você digita. As projeções usam os índices do Banco Central, antes do imposto.
- **Motor:** a carteira de menor risco, a projeção e as estratégias olham o passado. Não são recomendação.
- **Evolução do patrimônio:**
  - começa agora;
  - só registra os dias em que o app abre;
  - se dois aparelhos gravarem no mesmo dia, vale o último.
- **"Seus ativos":** essas notícias vêm do Google News, sem foto.
- **Versões antigas do app** em outro aparelho continuam funcionando. As chaves novas não mexem nas antigas.

## Verificação, em cada fase

- `npm test` e `npm run build` sem erros.
- **No navegador** (servidor `painel`), com dados de exemplo:
  - em 1280 px e em 375 px, no preto e no branco;
  - sem rolagem horizontal;
  - toques com 44 px ou mais no celular;
  - console sem erros.
  - Depois, o `localStorage` volta ao que era.
- **Por fase:**
  - **Fase 1:** o feed e a tradução, esta com o servidor simulado nos testes.
  - **Fase 2:** os preços de cada fonte, com dados reais nas fontes sem chave.
  - **Fase 4:** os indicadores contra valores calculados à parte.
- **Depois de cada merge:**
  - a Vercel publica com sucesso;
  - o pacote em produção contém os textos novos;
  - as rotas novas respondem 401 sem sessão, o que prova que subiram;
  - você confere logado, incluindo as notícias traduzidas e os preços dos EUA.
