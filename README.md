# Painel pessoal

Um lugar só para acompanhar investimentos, notícias, estudos para concursos e agenda.

## O que tem

- **Início:** resumo do dia com preços, meta de questões, erros para revisar, agenda de hoje, próxima data importante com contagem e as três manchetes mais recentes.
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

## Importar questões

Cole na aba Estudos uma lista em JSON neste formato (`answer` é o índice da opção certa, começando em 0):

```json
[{ "id": "q1", "subject": "Português", "statement": "Qual palavra está correta?", "options": ["exceção", "excessão"], "answer": 0, "explanation": "opcional" }]
```

## Limites conhecidos

- As notícias passam por um proxy do servidor de desenvolvimento; publicar o app exige um proxy no servidor.
- O tom das notícias usa palavras-chave e marca a maioria como neutra.
- O aviso de dado velho não conhece os feriados da B3.

## Aviso

O app mostra o tom das notícias ao lado do preço. Isso é um sinal de apoio, não uma previsão garantida, e não recomenda compra nem venda.
