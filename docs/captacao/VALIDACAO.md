# Captação por IES — preparação para revisão

Data: 10/11/2026. Base: `7105e2a7ae1d99780acb3fd2c1909683b6040359` (`main`).
Branch de implementação: `feat/captacao-integrada-ies`.

## Resultado implementado

O BI existente passa a ter Visão geral, Conexões, Campanhas, Interessados, Atendimento e Inscrições e matrículas. A visão legada permanece independente: falha na nova configuração não impede sua consulta. Seus estágios manuais são identificados como informados, sem confirmação acadêmica.

Conexões e campanhas têm formulários de preparação, múltiplas contas por rede/IES, páginas/formulários associados à conexão, edição com controle de versão e IDs estáveis de tentativa. O link de destino contém somente a rede, o meio e um identificador gerado de campanha. Nenhuma captura é instalada na página por copiar o link. A validação de URL é sintática; não comprova titularidade nem resolução pública do domínio, e nenhum endereço é buscado pelo servidor.

A migração nova é aditiva, independente das conexões acadêmicas. Inclui RLS, FKs compostas por IES/conexão, ACL de colunas e auditoria privada de operações de preparação. Não permite ao cliente escrever fatos de autorização, verificação ou sincronização. A versão deve avançar exatamente uma unidade; uma edição com versão antiga é recusada também em acesso direto ao banco. Criar novamente com o mesmo ID de tentativa não insere outro registro; a biblioteca recupera o cadastro somente na IES correta e compara os campos antes de aceitar o replay.

Somente Master e gestor da própria IES, com AAL2 e instituição ativa, podem consultar/editar esta preparação. Nenhum papel, usuário, convite ou acesso foi criado. Essa regra usa `has_role`, já existente no banco; não concede envio, autorização social ou acesso a dados nominais.

## Inventário novamente conferido em leitura

| Item | Resultado em 10/11/2026 |
|---|---|
| main | Permanece em `7105e2a7ae1d99780acb3fd2c1909683b6040359`, conferida novamente após implementação |
| PR #28 | Aberta, draft e conflitante; não mesclada |
| PR #54 | Aberta e conflitante; não mesclada |
| Issue #78 | Aberta; nenhuma conciliação pelo nome ou migração e-ORBIT executada |
| Render | Workspace `Virgílio Meirelles \| Projetos`; serviços `vertice-portal` e `vertice-educacao-superior` seguem main e compõem ZIP + overrides; publicação não executada |
| Release overlay | Existe no workflow ENADE; não aparece nos comandos atuais desses dois serviços. Não aplicado ao build desta frente |
| Banco | `qvetbbmviatxxatzzuzc`; novas tabelas desta frente não estavam presentes no inventário consultado |
| Contagens | 0 leads, 0 custos, 0 snapshots e 0 conexões acadêmicas, em consultas agregadas desta execução |
| Helpers remotos | `is_master`, `member_role`, `has_role`, `can_read_institution` presentes; `full_access_roles` e `is_full_access` ausentes |
| Histórico de conexões | Recuperadas as três migrações de 09/11: `conexoes_dados_ies`, `conexoes_aprovacao_e_financeiro`, `conexoes_registros_sync` |
| Esquema de conexões | Registradas 37 colunas, 16 constraints, 3 políticas SELECT e 44 grants das três tabelas; somente metadados, sem ler registros ou cofre |

`CONEXOES_DDL_HISTORICO.json` preserva o DDL histórico recuperado, como evidência, não como migração a executar. `CONEXOES_SCHEMA_REFERENCIA.json` registra o esquema/ACL atuais consultados. Os três objetos de tabela criados/alterados pelo histórico estão presentes no esquema atual. Esta implementação não reutiliza seu cofre, seus RPCs ou worker; a compatibilidade de uma futura integração deverá ser revisada antes de alterá-los.

Diferença corrigida em relação ao rascunho: `is_full_access` não existe no banco atual. A migração e o harness novos dependem de `has_role(target,array['gestor'])`, que admite Master conforme a definição já existente. Os demais perfis são recusados nesta preparação. Não aplicar a migração RBAC inteira apenas para disponibilizar um helper.

`ARQUITETURA.md` e `REQUISITOS_PROVEDORES.md` preservam o pacote recebido como referência histórica. Não se revalidaram permissões Meta/TikTok/WhatsApp nesta fase porque nenhum conector desses provedores foi implementado ou autorizado.

## Validação executada

| Verificação | Node 24.22.1 | Node 22.23.4 | Limite |
|---|---|---|---|
| Instalação do produto com lockfile | Passou, 671 pacotes | Mesma instalação/lockfile utilizada | Cache gravável; lockfile do produto não alterado |
| 343 testes existentes, 44 arquivos | Passaram | Passaram | Incluem legado; não provam integração Supabase/provedor |
| 27 testes de contratos/persistência | Passaram | Passaram | Cliente Supabase simulado |
| 8 testes de interface DOM | Passaram | Passaram | React montado em jsdom, sem navegador visual/autenticação real |
| Migração e SQL em PostgreSQL/PGlite 0.5.16 | Passaram | Passaram | Fundação real + helpers necessários; não reproduz toda a plataforma Supabase |
| TypeScript comparado à base | 47 erros preexistentes, nenhum novo | 47 erros preexistentes, nenhum novo | O type-check completo continua falhando; não foi declarado aprovado |
| Build estático ZIP + overrides | Passou | Passou | Não equivale a deploy nem validação autenticada |
| Chromium local | Bloqueado ao iniciar | Não executado | SO recusou socket no início do processo |
| Navegador disponível | Sem acesso ao localhost | Não executado | Conexão recusada ao servidor de teste |
| UI visual desktop/celular | Não executada | Não executada | CSS e smoke browser preparados, sem homologação visual local |
| CI GitHub | Workflow preparado | Workflow preparado | Consultar resultado do commit remoto antes de considerar CI aprovada |
| Supabase remoto / RLS autenticada / REST real | Não executados | Não executados | Nenhuma migração aplicada remotamente |
| OAuth / leads reais / mensagens / matrícula | Não executados | Não executados | Fora desta fase |

A suíte SQL cobre MFA, perfis, IES arquivada, ACL, leitura/escrita entre IES, FKs por IES/conexão/formulário, página usada indevidamente como formulário, campos de verificação/sync protegidos, URL inválida, versão antiga, 100 tentativas repetidas e auditoria sem duplicação. A competição de versões é exercitada por snapshots sequenciais; não foi feita validação com duas sessões PostgreSQL simultâneas. Não há workers nesta fase.

A suíte DOM cobre visão legada quando metadados falham, datas desconhecidas, falha de gravação sem perder campos, bloqueio de duplo submit, reutilização do ID, conflito de edição, foco inicial/retorno, troca de IES durante consulta/gravação e seleção de formulários da conexão. Nenhum dado de teste foi persistido em produção.

Avisos existentes: bundle Vite grande; configuração OAuth Manus ausente nos testes de legado. Não foram tratados como comprovação de falha dos conectores sociais nem ocultados como sucesso de integração.

## Reprodução

Na raiz do checkout, com Node 22 ou 24:

```bash
mkdir -p .captacao-build
unzip -qo vertice-servidor-source.zip -d .captacao-build
cp -a source-overrides/. .captacao-build/
cp scripts/captacao.vitest.config.ts .captacao-build/scripts/
npm ci --prefix .captacao-build --legacy-peer-deps --no-audit --no-fund --cache ../npm-cache
npm ci --prefix scripts/tests/runtime --no-audit --no-fund --cache ../npm-cache
ln -s "$PWD/scripts/tests/runtime/node_modules/jsdom" .captacao-build/node_modules/jsdom
(cd .captacao-build && npm test && ./node_modules/.bin/vitest run --config scripts/captacao.vitest.config.ts && npm run build:static)
PGLITE_MODULE="$PWD/scripts/tests/runtime/node_modules/@electric-sql/pglite/dist/index.js" node supabase/tests/captacao-integrada.test.mjs
```

Para comparar o TypeScript, compor outro diretório com ZIP e overrides **do commit base**, usando o mesmo lockfile/dependências, e executar:

```bash
node scripts/verify-captacao-typecheck.mjs CAMINHO_BUILD_BASE .captacao-build
```

O workflow `verify-captacao-integrada.yml` faz essa composição pelo SHA base da PR e executa a matriz Node 22/24. O resultado verde dessa etapa significa ausência de novos diagnósticos, não que os 47 erros da base tenham sido resolvidos.

Para smoke visual em máquina que permita Chromium:

```bash
node scripts/tests/runtime/node_modules/playwright/cli.js install chromium
node scripts/prepare-captacao-ui.mjs .captacao-build
./.captacao-build/node_modules/.bin/vite --config .captacao-build/captacao-ui/vite.config.mjs
# Em outro terminal:
PLAYWRIGHT_MODULE="$PWD/scripts/tests/runtime/node_modules/playwright/index.mjs" node scripts/tests/captacao-ui.test.mjs
```

O harness não integra o roteamento público e usa IES, contas e formulários sintéticos. O smoke preparado ainda precisa passar em navegador. `CHROMIUM_PATH` permite informar um executável já instalado. Não subir o harness como portal de produção.

## Próximo passo exato

1. Revisar a PR draft, o SQL e o resultado do CI do mesmo commit.
2. Executar smoke desktop/celular e navegação por teclado; testar API/RLS com sessões autenticadas e MFA em Supabase isolado, com a migração e o esquema real de dependências. Revalidar criação/retry e CAS no REST, além de duas sessões concorrentes.
3. Resolver/revisar os 47 erros globais de TypeScript na frente correspondente antes de afirmar type-check completo aprovado.
4. Com decisão explícita de implantação, validar migração em homologação e publicar no serviço existente. Nada nesta PR autoriza aplicar a migração remota ou fazer merge/deploy.
5. Para a Fase 2, confirmar a IES, o aplicativo existente, seus ativos e a autorização específica. Depois revalidar documentação oficial e implementar OAuth, cofre, recepção e worker.

Preparação não equivale a integração operacional. Não foram criadas credenciais, concedidos acessos, importados leads reais, enviados anúncios/mensagens, alteradas matrículas, aplicadas migrações remotas ou publicados deploys desta frente.
