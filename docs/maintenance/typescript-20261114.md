# Manutenção TypeScript — 14/11/2026

Branch: `maintenance/typescript-regression-20261114`.
Base verificada: `9011d9ccedf6f194712b37013ff1e91e13f3eb4a` (`main` no início deste trabalho).

## Situação confirmada

A PR [#119](https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/119) já havia sido integrada em 13/11/2026 às 22:36:10 UTC, merge `151c083a095bb5e8ba85a72070d3361ef21227d3`. Esta manutenção não modifica essa PR nem seus sete arquivos de segurança. O comentário histórico descrevia 64 diagnósticos; a composição atual da base apresenta **61**, reproduzidos nas duas versões de Node. Os números não foram tratados como uma lista fixa de exceções.

## Alterações

- Reconhecer `tcc`, `atividades-complementares`, `estagio` e `vitrine-curso` no tipo `Tab`; completar os rótulos do simulador de perfis e incluir a Vitrine no grupo Cursos e Ofertas.
- Remover de `TABS_FULL` sete nomes sem destino no Workspace (`egressos-pesquisa`, `egressos-cpa`, `egressos-indicadores`, `gerenciar-modulos`, `catalogo-modulos`, `minha-conta`, `painel-financeiro`). Os destinos funcionais já existentes (`egressos`, `modulos`, `catalogo`, `conta`, `billing`) permanecem. Esses sete nomes já eram filtrados pelo menu, que só aceita destinos reais. As listas de acesso dos demais perfis não foram ampliadas.
- Assimilar os builders `PromiseLike` em `Promise.resolve` antes de usar `.catch()`/`.finally()`, preservando consultas, filtros, ações e fallbacks existentes de Raio-X, Vitrine, Extensão, BI acadêmico, BI Direito e painel de evasão.
- Importar `supabase` em Captação; passar `autoMeasures` ao painel de metas e `evolucao` ao detalhamento semestral.
- Utilizar `name`, campo real da concedente de estágio, como alternativa a `trade_name`; converter o valor de status da demonstração para string antes de `startsWith`.
- Sem alteração de migrações, políticas RLS, permissões no banco, lockfiles, configuração TypeScript ou arquivos da PR de segurança. Nenhum módulo foi removido. Não foram adicionados `@ts-ignore`, `@ts-nocheck` ou exclusões de fontes.

## Bloqueio de regressão

O script `scripts/compare-typescript-diagnostics.mjs` compara **arquivo, linha, coluna e código TS**. A mensagem não participa da identidade. A multiplicidade dos diagnósticos é mantida: um novo erro de mesma identidade também conta. Novas posições são bloqueadas de forma conservadora, mesmo quando poderiam resultar apenas de deslocamento de linhas.

A execução falha se houver erro novo, falha ao iniciar o compilador, sinal de término, saída inesperada, diagnóstico global/configuração sem posição ou divergência entre código de saída e diagnósticos. Avisos de runtime do Node não viram diagnósticos TypeScript; a validação de saída continua obrigatória.

Os workflows acadêmico e Mobile usam esse script em lugar de `grep/sed/comm` sobre mensagens completas. A base da PR é fixada em `pull_request.base.sha`; execuções por push/manual continuam comparando com `main`. A base instala seu próprio lockfile. O workflow acadêmico passa a executar nas versões 22 e 24. O check estrito do portal continua exigindo zero erros, independentemente da comparação histórica.

## Resultados efetivos locais

Composição: `vertice-servidor-source.zip` + `source-overrides/`, com dependências instaladas por `npm ci --legacy-peer-deps --no-audit --no-fund` separadamente nas duas composições. TypeScript 5.9.3.

| Verificação | Node 22.23.4 | Node 24.22.1 |
|---|---:|---:|
| Base: `tsc --noEmit --incremental false --pretty false` | 61 erros; saída 2 | 61 erros; saída 2 |
| Manutenção: mesmo comando completo | 0 erros; saída 0 | 0 erros; saída 0 |
| Comparador real: base → manutenção | 61 resolvidos; 0 novos; saída 0 | 61 resolvidos; 0 novos; saída 0 |
| `npm test` | 408/408 | 408/408 |
| Contratos/DOM do portal | 80/80 | 80/80 |
| Testes do comparador | 17/17 | 17/17 |
| `npm run build:static` | saída 0 | saída 0 |
| HTML, chunks dos módulos e artefatos PWA | presentes | presentes |

Os 80 testes de contratos incluem oito novos testes DOM com builders sem `.catch`/`.finally`: BI de TCC, AC e Estágio, fallback de consulta rejeitada, painel de risco, drill-down semestral, Raio-X e Vitrine com RPC rejeitada. A suíte existente inclui a cobertura do menu para todas as abas e um novo teste de visibilidade/perfis.

Os 17 testes do comparador abrangem ordem das uniões, diferenças de mensagens, correção de erros, novo arquivo/linha/coluna/código com contagem total igual, duplicação, caminhos Windows, diagnósticos multilinha, falhas e sinais de execução e CLI com compiladores controlados.

Evidências brutas (logs compactados sem alteração de conteúdo em `.log.gz`): [Node 22](typescript-20261114/node22/) e [Node 24](typescript-20261114/node24/). `summary.json` registra as identidades removidas; `base-exit.json` e `branch-exit.json` registram as saídas reais. Na comparação local, base e manutenção compartilham o diretório de dependências do respectivo build Node 24, cujo lockfile é idêntico ao da base; os dois builds finais tiveram instalação independente. No CI, cada lado instala seu próprio lockfile.

Os builds emitiram avisos de tamanho dos chunks. Alguns testes existentes emitiram avisos de `act` e configuração OAuth legada; todos passaram. Esses avisos não foram contabilizados como homologação de serviços externos.

## Limites e aprovação

Os testes DOM usam dados sintéticos e consultas simuladas. Não foi executada homologação com contas reais, envio de e-mails, upload real, acesso a dados pessoais ou escrita no Supabase remoto. Os resultados não comprovam integralmente cada fluxo de produção.

A manutenção será apresentada em uma PR em rascunho. Não houve merge desta manutenção, alteração da branch principal ou publicação em produção. Essas ações dependem da aprovação do responsável.

## Reprodução

Em cada Node (22 e 24), extrair o ZIP para uma pasta nova, copiar `source-overrides/.` para ela e instalar com `npm ci --legacy-peer-deps --no-audit --no-fund`. Executar:

```sh
npm run check -- --incremental false --pretty false
npm test
npm run build:static
```

Para a suíte de contratos, copiar `scripts/portal-types.vitest.config.ts` para a pasta `scripts/` da composição, instalar `scripts/tests/types-runtime` e disponibilizar seu `jsdom` em `node_modules/jsdom`, como no workflow `verify-portal-types.yml`. Executar:

```sh
./node_modules/.bin/vitest run --config scripts/portal-types.vitest.config.ts
```

Na raiz do repositório, após compor e instalar a base e a manutenção separadamente:

```sh
node --test scripts/tests/typescript-diagnostics.test.mjs
node scripts/compare-typescript-diagnostics.mjs CAMINHO_BASE CAMINHO_MANUTENCAO CAMINHO_EVIDENCIAS
```
