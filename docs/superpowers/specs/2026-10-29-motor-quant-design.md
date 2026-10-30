# Motor quantitativo na área de investimentos

Data: 2026-10-29. Estado: aprovado pelo desenho mostrado na conversa ("Pode construir").

## Intenção

O dono quer "uma área só para investimento, tipo um motor quantitativo". Ele marcou os quatro blocos propostos: indicadores e gráfico, teste de estratégia, simulador de aportes e risco da carteira.

## O que a área mostra

A área fica na tela Investimentos, que abre pelo "Editar carteira" da tela única.

- **Ativo:** escolha entre BBAS3 e B3SA3.
- **Gráfico:** preço ajustado por proventos dos últimos 3 meses com as médias de 9 e 21 dias.
  - Mostra o primeiro e o último dia e o maior e o menor valor.
  - O cursor, o toque ou as setas do teclado mostram os valores de cada dia.
  - Uma tabela, que abre ao toque, traz todos os dias.
- **Indicadores:**
  - Preço.
  - Retorno no período.
  - Volatilidade ao ano.
  - Maior queda.
  - RSI de 14 dias.
  - Preço acima ou abaixo da média de 21 dias.
- **Como ler os números:** uma explicação curta de cada indicador, que abre ao toque.
- **Teste de estratégia:** cruzamento das médias 9 e 21 contra "comprar e segurar", com as duas curvas e o número de trocas de posição.
- **Risco da carteira:**
  - Valor da carteira.
  - Volatilidade ao ano.
  - Correlação entre BBAS3 e B3SA3.
  - Queda possível num dia ruim: VaR de 95% em 1 dia.
- **Simulador de aportes:** divide um aporte para chegar perto da meta, em ações inteiras, e manda o resto para a renda fixa. Também projeta a renda fixa em 12 meses com a taxa informada.

O formulário da carteira, as metas, os cartões de preço e as notícias continuam no fim da tela.

## O que seria fracasso

- Recomendar compra ou venda, ou prever preço. A área descreve o passado e faz contas com a meta do dono.
- Gastar a cota grátis da brapi. O histórico é buscado uma vez por dia por ativo e fica guardado.

## Restrições

- O plano grátis da brapi dá só 3 meses de histórico diário (`range=3mo`, `interval=1d`) e um ativo por chamada.
- As contas ficam no domínio, sem React, com teste cada uma.

## Chamadas minhas

- **Renda fixa:** entra no risco com volatilidade zero. É uma simplificação, porque a taxa varia pouco no dia a dia.
- **VaR:** paramétrico, 1,645 × desvio padrão diário × valor da carteira.
- **RSI:** o de Wilder, que as corretoras usam. Começa pela média simples dos 14 primeiros dias e depois suaviza dia a dia.
- **Preço ajustado:** o histórico usa o fechamento ajustado por proventos (`adjustedClose`). Assim o retorno, a maior queda e o teste de estratégia contam dividendos e JCP.
- **Preço de agora:** a cotação ao vivo troca o fechamento do dia no histórico, ou entra como o dia seguinte. O gráfico e os números batem com o preço mostrado.
- **Dias em comum:** a correlação e o risco usam só os dias em que os dois ativos negociaram.
- **Projeção da renda fixa:** não desconta o imposto de renda, e a tela avisa isso.
- **Estratégia:** fica comprada no dia seguinte a um dia em que a média de 9 ficou acima da de 21.
- **Simulador sem meta:** quando o dono ainda não tem meta, o simulador pede para definir a meta antes.
