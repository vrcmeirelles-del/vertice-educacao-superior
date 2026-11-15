# Falhas de build dos planejamentos — 15/11/2026

## Resultado

Os logs dos dois serviços confirmam uma declaração duplicada de `kind` em
`source-overrides/client/src/components/area/CoursePlanning.tsx` no commit
`e3868d0ff34ff55848e970d121b2bff8b03d5f2d`.

Durante a investigação, o repositório oficial e o Render já continham a correção
`e8c7bb1150953e6cd194ea2247eed665488181f2`, publicada por uma operação anterior
a esta intervenção. Nenhum merge, deploy ou ajuste de produção foi executado
nesta investigação. A nova proposta acrescenta apenas testes e este relatório.

## Evidências do Render

Workspace: `Virgílio Meirelles | Projetos` (`tea-d925voi8qa3s73csvir0`).
Ambos os serviços usam `main` do repositório oficial, auto-deploy por commit e
pré-visualizações de PR desativadas. São sites estáticos.

| Serviço | ID | Deploy original com falha | Deploy corrigido, status live |
| --- | --- | --- | --- |
| vertice-portal | srv-dbm52uhsrm7s73f3ojkg | dep-dbsrsrm8bjmc73esqe1g | dep-dbst2olckfvc73e0g35g |
| vertice-educacao-superior | srv-dbbm6q3ncjis7396t7fg | dep-dbsrsrm8bjmc73esqdu0 | dep-dbst2olckfvc73e0g31g |

O primeiro build registrou a falha às 11h15min45s de Palmas; o segundo, às
11h15min46s. Ambos emitiram:

```text
[vite:esbuild] Transform failed with 1 error:
CoursePlanning.tsx:69:34: ERROR: The symbol "kind" has already been declared
```

O Render concluiu os deploys corrigidos às 12h36min43s e 12h36min44s de Palmas,
respectivamente. Os seguintes `version.json` responderam com o SHA completo
`e8c7bb1150953e6cd194ea2247eed665488181f2`:

- https://vertice-portal.onrender.com/version.json
- https://vertice-educacao-superior.onrender.com/version.json
- https://www.verticesuperior.com.br/version.json

Essas respostas comprovam a versão pública servida, sem comprovar por si sós
o funcionamento dos fluxos autenticados ou a aplicação das migrações SQL.

## Causa e correção existente

O commit original introduziu `kind` como propriedade de `PlanningEditor` para
selecionar a interface estratégica ou semestral. Uma constante chamada `kind`
já existia no mesmo escopo, derivada da seção selecionada. Esbuild recusou
a transformação do componente, interrompendo Vite antes do prerender.

O commit corretivo preserva a propriedade `kind` e usa `isSemester` e `planKind`
para selecionar o registro e o tipo enviado à RPC. Também tipa o acesso às
seções. Não substitui autenticação, conexão Supabase, abas independentes ou
repositório. Não há evidência de que a migração SQL tenha causado este erro
de compilação: a reprodução local falhou na transformação do TSX.

O mesmo commit foi consumido pelos dois serviços. Seus comandos de build
compõem o ZIP-base com `source-overrides/`, instalam com `npm ci` e executam
`npm run build:static`. A diferença final é o diretório de publicação:
`public` para o portal e `dist/public` para o outro serviço.

## Alterações propostas nesta branch

Branch: `fix/verify-planning-build-20261115`, baseada no SHA corrigido `e8c7bb1`.

- `CoursePlanning.ui.test.tsx`: cinco novos casos para os modos independentes,
  histórico, salvamento e publicação com o `p_kind` correto, identidade do
  registro, revisão, criação de novo rascunho, troca de modo, leitura e erros.
- `InstitutionTabs.test.tsx`: um novo caso verifica ambas as abas para os oito
  perfis de gestão/curso e sua ausência para CPA, equipe, leitor e sessão ausente.
- Este relatório de diagnóstico, validação e reversão.

Os testes existentes já estão incluídos nas configurações de CI do repositório;
não foi necessário criar outro workflow, aplicativo, serviço ou banco.

## Verificações executadas

Ambiente local: Node 24.22.1, npm 11.9.0, dependências do lockfile, composição
ZIP-base + overrides. As suítes de interface usam jsdom do runtime de testes
existente. As gravações de planejamento são simuladas nos testes de interface.

| Verificação | Resultado |
| --- | --- |
| Build estático completo do commit e3868d0 em worktree isolada | Falhou com status 1, mesma duplicidade na linha 69 |
| npm run check na composição corrigida, incluindo os novos testes | Aprovado, zero diagnósticos |
| npm run build:static na composição corrigida | Aprovado, prerender de 15 páginas públicas e 20 áreas demonstrativas |
| Cópia e comparação dos dois destinos estáticos de publicação | Aprovado, index.html presente e árvores idênticas |
| npm test | 410 testes aprovados em 50 arquivos |
| vitest run --config scripts/portal-types.vitest.config.ts | 137 testes aprovados em 16 arquivos |
| vitest run --config scripts/extension.vitest.config.ts | 19 testes aprovados em seis arquivos |
| node --test scripts/tests/extension-runtime/*.test.mjs | 16 testes aprovados, PostgreSQL local PGlite |
| node --test scripts/tests/typescript-diagnostics.test.mjs | 17 testes aprovados |
| node scripts/check-canonical-source.mjs | Aprovado, fonte única e snapshot histórico íntegros |
| git diff --check | Aprovado |

Total: 599 testes aprovados nas cinco suítes finais acima, sem contar novamente
as execuções preliminares. O build emite avisos sobre tamanho de chunks e
anotações do Zod; as suítes existentes emitem avisos de ambiente de teste.
Esses avisos não impediram a conclusão dos comandos.

Não executei migrações, testes SQL de planejamento ou gravações autenticadas
no Supabase de produção. Os testes locais não substituem o aceite autenticado
do usuário. Não alterei Supabase Auth, MFA, RLS, credenciais, tabelas ou catálogo.

## Reprodução das verificações

Em uma cópia de trabalho da branch proposta, a partir da raiz:

```bash
mkdir -p .verification-build
unzip -qo vertice-servidor-source.zip -d .verification-build
cp -a source-overrides/. .verification-build/
mkdir -p .verification-build/supabase/functions
cp -a supabase/functions/. .verification-build/supabase/functions/
cp scripts/portal-types.vitest.config.ts scripts/extension.vitest.config.ts .verification-build/scripts/
npm ci --prefix .verification-build --legacy-peer-deps --no-audit --no-fund
npm ci --prefix scripts/tests/types-runtime --no-audit --no-fund
ln -s ../../scripts/tests/types-runtime/node_modules/jsdom .verification-build/node_modules/jsdom
npm ci --prefix scripts/tests/extension-runtime --no-audit --no-fund
node scripts/check-canonical-source.mjs
node --test scripts/tests/typescript-diagnostics.test.mjs
node --test scripts/tests/extension-runtime/*.test.mjs
cd .verification-build
npm run check
npm test
./node_modules/.bin/vitest run --config scripts/portal-types.vitest.config.ts
./node_modules/.bin/vitest run --config scripts/extension.vitest.config.ts
npm run build:static
```

## Operações posteriores sujeitas à aprovação expressa

1. Atualizar a leitura de `main`, conferir a base e o SHA da PR, executar o CI
   e revisar exclusivamente os três arquivos desta proposta.
2. Após a aprovação do usuário, integrar a PR por squash com o título
   `[skip render] Testar regressões das abas independentes de planejamento`.
   Usar correspondência obrigatória com o SHA revisado da branch. Se houver
   novos commits ou conflitos, interromper e reapresentar o conteúdo alterado.
3. O marcador `[skip render]` evita novo deploy desta alteração de testes e
   documentação. A correção de aplicação já está publicada nos dois serviços.
   Não executar `trigger_deploy`, migrações ou alterações de configuração.

Uma nova publicação de aplicação não é necessária para esta proposta. Qualquer
publicação adicional deve ter seu SHA e operações apresentados ao usuário e
receber aprovação expressa antes da execução.

## Reversão

Antes do merge, descartar/fechar a PR não altera a produção. Depois de um merge
autorizado, reverter apenas o commit squash desta proposta, mantendo o marcador
`[skip render]`; isso remove testes/documentação e mantém a aplicação em e8c7bb1.
Submeter também essa reversão à aprovação expressa.

Para uma futura publicação com regressão, o ponto de retorno de aplicação que
preserva as abas separadas é `e8c7bb1150953e6cd194ea2247eed665488181f2`, com os
deploys corrigidos identificados na tabela. Após aprovação, selecionar Rollback
para o respectivo deploy no Dashboard, se o artefato ainda estiver disponível,
ou publicar especificamente esse SHA se for necessária uma recompilação.
Conferir o resultado, `version.json` e os fluxos autenticados após a operação.

O rollback pelo Dashboard desativa auto-deploy; registrar a configuração
resultante e só restaurá-la de forma deliberada. Rollback de artefato não
reverte migrações nem dados. Não executar reversão SQL automática e não reverter
o commit e8c7bb1, pois isso reintroduziria o erro de compilação.

## Fontes técnicas consultadas

- https://github.com/vrcmeirelles-del/vertice-educacao-superior/commit/e3868d0ff34ff55848e970d121b2bff8b03d5f2d
- https://github.com/vrcmeirelles-del/vertice-educacao-superior/commit/e8c7bb1150953e6cd194ea2247eed665488181f2
- https://dashboard.render.com/static/srv-dbm52uhsrm7s73f3ojkg
- https://dashboard.render.com/static/srv-dbbm6q3ncjis7396t7fg
- https://render.com/docs/deploys
- https://render.com/docs/rollbacks

Os logs e históricos foram obtidos pela conexão autorizada do Render, e os
arquivos foram examinados no repositório oficial. Nenhum segredo foi necessário
para a reprodução ou foi incluído neste relatório.
