# Validação TypeScript do portal — 14/11/2026

## Referência examinada

- Repositório: `vrcmeirelles-del/vertice-educacao-superior`.
- `main`, consultada no GitHub e obtida com `git fetch origin main`: `9011d9ccedf6f194712b37013ff1e91e13f3eb4a`.
- O merge da PR #119 (`151c083a095bb5e8ba85a72070d3361ef21227d3`) é ancestral dessa referência.
- Branch de correção: `fix/typescript-ci-validation-20261114`.
- Ambiente local: Node **24.22.1**, TypeScript **5.9.3** instalado pelo lockfile.
- Não se verificou qual commit está implantado no Render. Esta execução valida o código da branch principal consultada, não o estado de produção.

## Procedimento reproduzido

Conforme `README.md`, `render.yaml` e os workflows do portal:

```bash
mkdir -p .validation-build
unzip -qo vertice-servidor-source.zip -d .validation-build
cp -a source-overrides/. .validation-build/
cp -a supabase .validation-build/
npm ci --prefix .validation-build --legacy-peer-deps --no-audit --no-fund
npm run check --prefix .validation-build -- --pretty false --incremental false
npm test --prefix .validation-build -- --maxWorkers=2 --minWorkers=1
npm run build:static --prefix .validation-build
```

O ZIP é apenas a base; validar somente `source-overrides` ou somente o ZIP não representa a fonte composta. Nenhuma configuração de tipagem foi relaxada, nenhum diagnóstico foi suprimido e nenhuma dependência/lockfile foi alterada.

## Resultados efetivos locais

| Verificação | Resultado | Evidência |
|---|---|---|
| `main` antes das correções | saída 2, **61 erros** | `typecheck-before.log` |
| TypeScript após correções | saída 0, **0 erros** | `typecheck-after.log` |
| Comparação base × alteração, executando o compilador | 61 → 0; **0 erros novos** | `comparison/typecheck-comparison.json` e logs completos |
| Suíte padrão | **407/407** testes, 50 arquivos | `tests-existing.log` |
| Contratos/UI do portal e escopo da Reitoria | **72/72**, 7 arquivos | `tests-portal.log` |
| Captação: contratos e DOM | **35/35**, 2 arquivos | `tests-captacao.log` |
| Novas regressões do portal | **10/10** | `tests-regression.log` |
| Novas regressões do comparador | **8/8** | `tests-comparator.log` |
| Build estático | saída 0; Vite e prerender concluídos | `build-static.log` |

São **532 testes aprovados** nessas cinco suítes. O paralelismo da suíte padrão foi limitado a dois workers para o ambiente local; os testes e o comando base são os existentes. Os testes de UI são executados em jsdom com dados sintéticos e não acessam o banco remoto.

Para repetir as suítes adicionais:

```bash
npm ci --prefix scripts/tests/types-runtime --no-audit --no-fund
mkdir -p .validation-build/scripts
cp scripts/portal-types.vitest.config.ts scripts/typescript-regression.vitest.config.ts scripts/captacao.vitest.config.ts .validation-build/scripts/
ln -s "$PWD/scripts/tests/types-runtime/node_modules/jsdom" .validation-build/node_modules/jsdom
(cd .validation-build && ./node_modules/.bin/vitest run --config scripts/portal-types.vitest.config.ts)
(cd .validation-build && ./node_modules/.bin/vitest run --config scripts/captacao.vitest.config.ts)
(cd .validation-build && ./node_modules/.bin/vitest run --config scripts/typescript-regression.vitest.config.ts)
node --test scripts/tests/compare-typescript.test.mjs
```

Para a comparação local foi recomposta uma base imutável do commit acima; o `package-lock.json` foi comparado byte a byte com o da alteração antes de compartilhar o diretório instalado. No CI, cada lado instala suas próprias dependências pelo respectivo lockfile.

## Causas corrigidas

1. **Tipos e navegação:** `Tab` não declarava destinos já presentes no catálogo e no Workspace. Os destinos existentes foram tipados, receberam os rótulos exigidos pelo simulador de perfis e foram associados aos grupos de navegação. O teste existente que exige exatamente uma associação por destino voltou a passar. As listas de visibilidade por papel e as funções `can` permanecem iguais.
2. **Supabase PromiseLike:** consultas e RPCs não oferecem o contrato completo de uma Promise nativa. `Promise.resolve(consulta)` assimila o thenable antes de usar `.catch`/`.finally`. Foram corrigidos Raio-X, Vitrine, Extensão, BI acadêmico, BI Direito e risco de evasão, preservando consultas, parâmetros, filtros e fallbacks existentes. Os testes usam deliberadamente um objeto com apenas `.then`, sem `.catch` e sem `.finally`.
3. **Dados fora de escopo:** `autoMeasures` agora é passado do Workspace para `GoalsTab`; `evolucao` é passado ao drill-down do BI. A regressão abre um semestre e confere os dados de matrículas carregados.
4. **Importação ausente:** o BI de captação agora importa o cliente Supabase utilizado nas consultas existentes.
5. **Contrato de estágio:** o nome da concedente usa `InternshipOrg.name`, compatível com o cadastro e o contrato do módulo; não havia `legal_name` nesse contrato.
6. **Demonstração:** o status de uma linha com células heterogêneas é convertido para string antes de `startsWith`.

A lista de 61 diagnósticos foi reproduzida na referência atual; não se presumiu que fosse a mesma composição de erros da descrição histórica da PR #119.

## Comparação do CI

Os workflows de BI acadêmico e Mobile usam um único comparador versionado e testado. Ele:

- executa o TypeScript de cada build com `--noEmit --pretty false --incremental false`;
- compara **arquivo + linha + coluna + código TS**, preservando a quantidade de ocorrências;
- ignora o texto explicativo e linhas de continuação: mudanças de ordem das uniões ou apresentação da mensagem não se tornam erros novos;
- detecta novos arquivos, códigos, posições e ocorrências adicionais, mesmo que o total de erros diminua;
- reprova falhas de execução, sinais, saída inconsistente e diagnósticos não reconhecidos;
- salva logs integrais e resumo JSON como artefatos do CI;
- usa o SHA da base da PR no workflow acadêmico, evitando que uma mudança posterior de `main` altere a referência da mesma execução.

**Limite intencional:** a posição continua fazendo parte da identidade. Mover uma linha que ainda contém um erro legado é tratado conservadoramente como uma nova posição e exige revisão. O comparador não tenta inferir equivalência semântica entre erros diferentes que compartilham um código. O workflow `portal` mantém uma verificação absoluta de **zero erros**, em Node 22 e 24; a comparação não substitui esse requisito.

## Preservação e homologação pendente

Não há mudanças em migrações, funções Edge, RLS, Storage, autenticação, tokens do estudante ou dados institucionais. Os filtros e argumentos das consultas alteradas foram mantidos; os testes sintéticos conferem os filtros de IES e curso nos caminhos exercitados. Isso não equivale a comprovar isolamento do banco remoto.

Ainda dependem de homologação em ambiente autorizado:

- execução remota da matriz CI Node 22/24 no commit proposto;
- login real por papel e tentativa de acesso cruzado entre IES e entre cursos;
- envio/recebimento de convites de Extensão e integração com os serviços externos;
- magic link, sessão do estudante e upload real pelo Storage;
- fluxos completos de TCC, AC, Estágio, Vitrine e BI com os dados e as permissões de homologação.

O build continua advertindo sobre tamanho de chunks e importações simultaneamente estáticas/dinâmicas. O prerender efetivamente concluiu; não houve dependência do fallback que tolera falha de prerender no script existente. A suíte de portal registra avisos preexistentes do ambiente React `act`; os 72 testes passam.

**Sem merge, deploy ou publicação em produção.** Aprovação técnica local não é homologação operacional.
