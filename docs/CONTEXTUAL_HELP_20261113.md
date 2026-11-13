# Ajuda contextual e guia da Vértice

A interface agora utiliza `HelpLabel` nos rótulos dos formulários e `ContextHelp` nos termos documentados. O botão “?” abre um popover local, por clique ou teclado, com fechamento por Escape, clique externo ou botão de fechar. A abertura não envia o formulário, não marca checkboxes e não solicita análises de IA.

- `client/src/components/ContextHelp.tsx`: componentes compartilhados; mantém os controles, identificadores, handlers e validações existentes.
- `client/src/lib/contextual-help.ts`: fonte de consulta para termos, indicadores e campos. Reutiliza as definições de `help.ts` e a descrição dos campos da DRE já empregada no cálculo de EBITDA.
- `client/src/lib/module-help.ts`: orientação de uso dos 44 módulos/áreas descritos no Workspace. O conteúdo de ENEM continua separado do ensino superior.
- `/guia.html`: pesquisa tolerante a acentos e consulta das mesmas definições, incluindo módulos, indicadores, campos e perguntas frequentes.
- Todos os rótulos nativos encontrados na fonte composta foram migrados (649 declarações JSX; algumas correspondem a listas dinâmicas). Termos estáticos documentados e cartões de indicadores compartilhados também recebem ajuda. Elementos sem rótulo e gráficos internos de bibliotecas não são apresentados como cobertos individualmente.

Nos campos sem definição específica, a ajuda orienta o tipo de entrada (seleção, data, arquivo, número etc.) e o preenchimento obrigatório. Não atribui fórmulas ou funções não documentadas. As explicações existentes nos formulários genéricos têm precedência. Novas telas devem usar `HelpLabel`; novos conceitos devem entrar no catálogo antes de ganharem explicações específicas.

O recurso “Perguntar à IA” não foi alterado. Os textos de ajuda são carregados com a interface e não disparam chamadas de IA.

## Validação

Reconstruir a fonte conforme README e sobrepor `source-overrides/`. Executar `npm run check`, `npm run build:static` e `npx vitest run --config vitest.help.config.ts` (o ambiente de testes requer jsdom; há dependência fixada em `scripts/tests/runtime/package.json`). Os testes cobrem campos, formulário, checkbox, Escape/foco, fechamento, vínculos com o glossário, troca de campos e catálogo.
