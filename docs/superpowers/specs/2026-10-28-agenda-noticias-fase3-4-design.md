# Fases 3 e 4: Agenda e Notícias (versão completa)

Data: 2026-10-28. Estado: aprovado pelo dono para execução direta ("faz tudo de uma vez").

## Intenção

O dono quer "uma agenda que se base na minha vida" e "um feed de notícias", dentro do mesmo painel que já tem investimentos e estudos. A primeira versão das duas abas já está na `main`: plano do dia pela rotina, calendário do mês só de leitura, compromissos simples e feed com filtro por tema. Esta fase completa as duas abas para que sejam úteis no dia a dia, seguindo o mockup aprovado (`mockup-completo.html`).

## Estado atual (main)

- Agenda: rotina editável (trabalho, dias, minutos de estudo), plano de hoje, calendário do mês atual, compromissos com data, horário opcional (sempre 1 h) e tipo; remover compromisso.
- Notícias: feed de mercado, concursos e tecnologia via RSS do Google Notícias com filtro por tema; tom por palavras-chave.
- Início: resumo com plano de hoje e atalho para Notícias.

## Objetivos

1. Compromissos que repetem toda semana (ex.: academia toda segunda e quarta), porque a vida do dono tem rotina além do trabalho.
2. Duração do compromisso (hoje é fixa em 1 h).
3. Calendário navegável: mês anterior e próximo, e clicar num dia mostra o plano daquele dia.
4. "Datas importantes" com contagem regressiva para provas e eventos de mercado ("faltam 11 dias").
5. Legenda das cores do plano do dia.
6. Notícias com link para abrir a matéria original.
7. Filtro "Carteira" no feed: notícias que citam Banco do Brasil, BBAS3, B3 ou B3SA3.
8. Botão "Atualizar" e a hora da última atualização do feed.
9. Últimas notícias salvas no aparelho: sem conexão, o feed mostra as salvas avisando; o Início mostra as três manchetes mais recentes.
10. Início mostra a próxima data importante com a contagem.

## Fora do escopo

- Sincronizar com Google Agenda ou outro calendário.
- Notificações e alertas.
- Editar compromisso (continua remover e criar de novo).
- Tom das notícias por modelo de linguagem e publicação do app (dependem de decisões do dono; tarefa 9 da fase 1).
- Busca por palavra no feed.

## O que seria um fracasso, mesmo funcionando

- Link de notícia que executa código (`javascript:`) ou abre na mesma aba tirando o dono do painel.
- Evento semanal que aparece antes da data de início ou em dia errado.
- Contagem regressiva errada por fuso horário.
- Feed vazio sem explicar por quê quando a rede falha.
- Calendário que só funciona com mouse (precisa de teclado e leitor de tela).

## Restrições

- Tudo salvo só no navegador (localStorage), validado ao carregar.
- Commits só com o dono como autor, sem coautor; push ao fim de cada marco; PR para a `main`.
- Visual segue o mockup aprovado e o sistema de estilos atual (tokens claro/escuro, alvos de 44 px, foco visível).
- O app não prevê preço nem recomenda compra ou venda.

## Decisões do dono

- Agenda baseada na rotina dele; calendário; feed de notícias (mercado, concursos, tecnologia).
- Usar as skills e fazer as fases 3 e 4 juntas, de uma vez.

## Chamadas minhas (podem ser trocadas)

- Evento semanal vale a partir da data de início, nos dias da semana marcados; sem data de fim.
- Duração entre 5 e 720 minutos; padrão 60.
- Datas importantes = compromissos não semanais do tipo "Prova / concurso" ou "Mercado", de hoje em diante, até 5 itens.
- Contagem em dias de calendário: "hoje", "amanhã", "faltam N dias".
- "Carteira" é uma tag a mais, calculada pelo título (sem acento, sem maiúscula); não substitui o tema original.
- Links só `http`/`https`, abrem em nova aba com `rel="noopener noreferrer"`.
- O feed salva a última busca que trouxe notícias (até 50); se a busca falhar ou vier vazia, mostra as salvas com aviso.
- Compromissos semanais aparecem numa lista própria ("Toda semana"), separada dos próximos compromissos.

## Deixado para quem for construir

- Layout exato do cabeçalho do calendário e da legenda.
- Texto dos estados vazios.
