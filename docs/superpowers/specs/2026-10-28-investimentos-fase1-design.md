# Fase 1: Investimentos + notícias do mercado

Data: 2026-10-28. Estado: rascunho, aguardando aprovação.

## Intenção

O dono do projeto investe em ações do Banco do Brasil (BBAS3) e da B3 (B3SA3), tem R$ 10 mil em renda fixa e quer aumentar a carteira. Hoje ele junta tudo em lugares diferentes. Ele quer abrir um painel e ver, num só lugar: o que tem, como as ações estão se comportando no dia e quais notícias importam para elas.

O painel completo terá mais três partes (estudos para concursos, agenda, feed geral). Esta fase cobre só investimentos e as notícias que mexem com eles.

## Objetivos

- Mostrar a carteira: BBAS3, B3SA3 e renda fixa, com quantidades e valores informados pelo dono.
- Mostrar o preço do dia de BBAS3 e B3SA3 com um gráfico simples.
- Mostrar notícias ligadas a BBAS3, B3SA3, Selic e renda fixa, cada uma com um tom (positivo, neutro, negativo).
- Mostrar, ao lado do preço do dia, um sinal que resume o tom das notícias recentes.
- Mostrar a divisão atual da carteira e a divisão desejada, para apoiar a decisão do próximo aporte.
- Funcionar bem no celular e no computador.

## Fora do escopo

- Estudos, agenda e feed geral de notícias (fases seguintes).
- Comprar ou vender ativos, ou conectar-se à corretora.
- Cobrir outras ações além das duas (pode virar uma lista editável depois).

## O que seria um fracasso, mesmo que funcione

- O app prometer ou sugerir que sabe o que o preço vai fazer. O sinal das notícias é apoio, nunca previsão garantida.
- O app mandar comprar ou vender. A decisão é sempre do dono.
- Mostrar preço velho sem avisar que está atrasado.
- Guardar dados financeiros do dono em lugar público.

## Restrições

- Uso pessoal, um único usuário.
- Dados de preço de fontes gratuitas, portanto com atraso de alguns minutos. O painel mostra a hora da última atualização.
- Repositório no GitHub com o dono como único contribuidor. Commits sem coautor. Push ao fim de cada fase.

## Decisões do dono (palavras dele)

- Acompanhar ações e investimentos primeiro.
- Carteira atual: BBAS3, B3SA3 e R$ 10 mil em renda fixa; quer aumentar.
- Usar no celular e no computador.
- Ver o efeito das notícias nas ações durante o dia.
- O mockup `mockup-completo.html` foi aprovado como direção.

## Chamadas minhas (o dono ainda não decidiu; podem ser trocadas)

- Formato: aplicativo web responsivo e instalável (PWA), porque cobre celular e computador com uma base só.
- O tom das notícias vem de um modelo de linguagem lendo o título e o resumo, com um rótulo e uma frase curta de motivo, para o dono conferir.
- O sinal do dia é uma contagem simples (positivas contra negativas nas últimas horas) comparada com a variação do preço, sem modelo estatístico de previsão.
- Renda fixa: o dono informa valor, taxa e vencimento; o painel não consulta o banco.
- Dados guardados localmente no aparelho na primeira versão; sincronizar entre aparelhos fica para depois.

## Deixado para quem for construir

- Escolher a fonte de preços gratuita e de notícias (RSS ou API), conferindo termos de uso e limites.
- Escolher linguagem, framework e onde guardar os dados.
- Detalhes visuais, seguindo o mockup e as skills de design.
- Como tratar horário de mercado (aberto/fechado, feriados).

## Perguntas em aberto

- O dono quer alertas (por exemplo, aviso quando sair notícia negativa)? Não foi discutido.
- Haverá meta de aporte mensal calculada pelo painel, ou só um campo que ele preenche?
