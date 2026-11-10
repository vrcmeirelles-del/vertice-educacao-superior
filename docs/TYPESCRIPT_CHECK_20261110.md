# Portal — correção dos 47 diagnósticos de TypeScript

Base: main `7105e2a7ae1d99780acb3fd2c1909683b6040359`.
Branch: `fix/portal-typescript-47`, independente da captação PR #89.

## Correções

| Área | Causa | Comportamento corrigido |
|---|---|---|
| Reitoria / e-ORBIT | Consultas exigiam catálogo de semestres e retornavam listas; tela usava campos ausentes | Carrega catálogo, seleciona o resumo de período conhecido mais recente e usa os nomes canônicos |
| Compliance | Plano e notas eram tratados como dois campos de um único objeto inexistente | Seleciona os tipos no mesmo semestre; ausência ou denominador vazio permanece sem valor |
| Evasão, saúde e docentes | Nomes de propriedades divergentes dos parsers | Usa taxas, nome docente, rótulo e sinal efetivamente retornados; conta apenas turmas de ingresso apuradas |
| Biblioteca, vestibular e ENADE | Campos de título, data, curso e período não coincidiam com os contratos | Exibe títulos/exemplares, data/situação do edital e curso/semestre da fonte |
| Mapa de calor | Tela usava curso/semestre onde a consulta retorna linha/coluna | Posiciona os valores e diferencia zero de célula ausente |
| Risco por ocupação | Tela exigia matrículas/vagas ausentes no contrato e formatava taxa nula | Exibe os campos disponíveis e identifica a falta de base para cálculo |
| Governança | SELECT dinâmico perdia o tipo de cada resposta | Colunas literais e paginação genérica preservam os tipos; limite alcançado informa consulta incompleta |
| Matrículas | Definição duplicada conflitava com capacidade/vagas disponíveis nulas | Reutiliza o tipo canônico de snapshot |
| Modo TV | Recebia relatórios genéricos e encaminhava para componente que exige relatórios acadêmicos | Reutiliza o contrato BIReport do painel |
| Instrumento 2026 | Usava `ind` onde o mapeamento possui `ind2017` | Mostra o indicador 2017 correto e seu nome |
| Upload/avaliação/custos | Tipo de upload incompleto, expressão unknown no JSX e mapa com chave excessivamente estreita | Tipos alinhados aos dados e à renderização existentes |

Não se alteraram o tsconfig, a opção strict ou o lockfile do produto. Não foram adicionados `any`, `@ts-ignore`, `@ts-nocheck` ou exclusões de código para esconder diagnósticos. Não houve migração de banco, ajuste de acesso ou implantação.

## Verificação

O type-check da base reproduziu 47 diagnósticos. Após as correções, o comando completo `npm run check` passou localmente. Os 14 testes novos passaram: seis de seleção/conversão dos resumos e oito de renderização em DOM.

Os testes DOM exercitam as seis abas do Reitor com objetos no formato dos contratos atuais, identificando valores, nomes, períodos, ausência de denominador, célula zero e limpeza do resumo de evasão ao trocar a instituição. Usam fontes sintéticas; não afirmam leitura autenticada da produção.

O workflow `verify-portal-types.yml` executa em Node 22 e 24: type-check completo obrigatório, suíte existente, novos testes e build estático. Ele exige saída zero do TypeScript, sem comparação permissiva com erros anteriores. Consultar os resultados do commit da PR para a evidência de CI.

## Reprodução

```bash
mkdir -p .typecheck-build
unzip -qo vertice-servidor-source.zip -d .typecheck-build
cp -a source-overrides/. .typecheck-build/
cp scripts/portal-types.vitest.config.ts .typecheck-build/scripts/
npm ci --prefix .typecheck-build --legacy-peer-deps --no-audit --no-fund --cache ../npm-cache
npm ci --prefix scripts/tests/types-runtime --no-audit --no-fund --cache ../npm-cache
ln -s "$PWD/scripts/tests/types-runtime/node_modules/jsdom" .typecheck-build/node_modules/jsdom
(cd .typecheck-build && npm run check && npm test && ./node_modules/.bin/vitest run --config scripts/portal-types.vitest.config.ts && npm run build:static)
```

A publicação continua sendo uma ação separada. A correção de compilação não comprova integração operacional de fontes externas ou ausência de todos os problemas de execução.
