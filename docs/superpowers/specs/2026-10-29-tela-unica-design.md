# Tela única: tudo no Início

Data: 2026-10-29. Estado: aprovado pelo desenho mostrado na conversa ("Pode construir").

## Intenção

O dono quer abrir o painel e ver tudo numa tela só, simples e minimalista. Nas palavras dele: "eu quero tudo em uma tela com o feed de noticias gerais investimento ações questoes tudo em uma tela so tela simples e manimalista".

## O que a tela mostra

- **Topo:** a data por extenso.
- **Quatro números:**
  - BBAS3, com preço e variação.
  - B3SA3, com preço e variação.
  - Carteira: o valor total e quanto dele está em renda fixa.
  - Estudo de hoje: questões feitas contra a meta de 20 e erros para revisar.
- **No computador, três colunas:**
  - **Notícias:** o feed geral, com filtro por tema (Todas, Carteira, Mercado, Concursos, Tecnologia) e o botão Atualizar.
  - **Questão do dia:** responde na própria tela e vê a correção. Depois passa para a próxima.
  - **Carteira e Hoje:** a divisão atual contra a meta, a agenda do dia e a próxima data importante.
- **No celular:** uma coluna, nesta ordem: números, notícias, questão, carteira e agenda.

## Fora do escopo

- Apagar as outras telas. Elas continuam como telas de edição, para quantidades, metas, compromissos e importação de questões.
- Trocar o gráfico do dia por um de 1 mês. O dono ainda não decidiu.

## O que seria fracasso

- Uma tela poluída, com caixas e cores demais.
- Recomendar compra ou venda. A carteira só compara a divisão atual com a meta.
- Gastar mais chamadas da brapi do que a cota grátis permite. A tela única não pode aumentar as chamadas por atualização.

## Restrições

- Alvos de toque de pelo menos 44 px. As cores vêm dos tokens de `styles.css`, nos modos claro e escuro.
- Os preços usam a mesma busca da aba Investimentos, com atualização a cada 15 minutos.

## Chamadas minhas (o dono pode trocar)

- **Abas:** em 29/10 o dono pediu "deixe só essa tela". A barra de abas saiu. As outras telas abrem pelos links de cada seção e têm "‹ Início" no topo para voltar.
- **Atualizar:** não há botão geral. Os preços atualizam sozinhos a cada 15 minutos, e o feed de notícias tem o próprio Atualizar.
- **Escolha da questão:** igual a "Questões livres", em que as matérias com mais erros aparecem mais.
- **Visual:** linhas finas no lugar de caixas e uma cor de destaque. Verde e vermelho só nas variações de preço.
