# Atas do colegiado dentro da Vértice

O coordenador pode elaborar a ata no portal, registrar os encaminhamentos e salvar versões por instituição e curso. O documento permanece em elaboração, não assinado e sem aprovação acadêmica. O salvamento não cria arquivo validado, não atende pendência e não modifica cobertura de indicadores.

## Escopo implementado

- Ata de colegiado: identificação, tipo, data, horário, local, presidência, secretaria, quórum, participantes por função, pauta, memória da ata anterior, discussão, decisões/votação e próxima reunião.
- Encaminhamentos com identificador estável, responsável, prazo, situação, referência textual de evidência, ata de origem e justificativa. Conclusão exige referência; cancelamento e reprogramação exigem motivo; reprogramação exige novo prazo.
- Criação e edição de rascunhos, recuperação de versões salvas após recarregar e consulta do histórico. A lista mostra até 500 atas recentes e o histórico até 100 versões recentes; as versões anteriores permanecem no banco.
- Rascunho em memória por usuário/IES/documento durante navegação entre abas. Operação pendente continua após desmontagem da tela. Fechar/recarregar a página com alterações não salvas gera aviso do navegador. Não há conteúdo institucional em localStorage/sessionStorage no código de produção.
- Repetição idempotente quando a confirmação da rede é perdida. A interface impede editar o payload enquanto o resultado está incerto. Conflito preserva o texto em memória e permite comparar com a versão atual antes de descartá-lo explicitamente.

Não há exportação PDF/DOCX, assinatura, submissão automática à aprovação, envio de arquivo ou promoção a evidência nesta etapa. A referência de evidência é texto informativo; não comprova a existência ou validação de um arquivo. NDE/ENADE e projetos ficaram para depois da validação deste primeiro fluxo.

## Análise dos modelos

Consulta somente leitura ao Supabase confirmou dois acervos ativos distintos, com versões por IES. Os códigos de colegiado, NDE e comissão ENADE existem como DOCX não placeholder, mas `template_object_path` e `template_review_ref` estavam nulos. A seleção do formulário usa instituição + ID exato da linha da biblioteca, que identifica sua versão, nunca somente o código.

Foi lido o conteúdo do modelo local `Mod Ata Colegiado 2026-2.docx`, SHA-256 `4ef765887ccc9ccea443965154256fad1df90926ec1466c020c2784818696d3c`. Ele contém memória da reunião anterior, acompanhamento de ações com evidência/ata de origem, discussão, deliberações e participantes. Essa leitura orientou os campos. Não foi presumida identidade entre essa cópia local e os objetos privados do Storage. Não houve alteração, cópia pública ou homologação do documento. O formulário declara expressamente que não é template homologado.

## Persistência e autorização

Migração gerada pela CLI: `20261103160346_inep_minutes_drafts.sql`. Apenas tabelas novas e funções próprias:

- `vertice_minutes_drafts`: conteúdo atual, IES, curso, fonte, ator, versão e ID da operação.
- `vertice_minutes_revisions`: snapshots imutáveis de cada gravação.
- `vertice_save_minutes_draft`: RPC SECURITY INVOKER, preservando RLS; lock por documento, compare-and-swap e repetição idempotente da mesma operação/conteúdo.
- Trigger privada de histórico/auditoria: SECURITY DEFINER somente para append; EXECUTE revogado de PUBLIC, anon e authenticated. Auditoria não duplica em retries.

MFA aal2 e vínculos existentes continuam obrigatórios. Os membros podem ler rascunhos da sua IES; equipe cria/edita os próprios; gestor/master pode editar conforme helpers existentes. Leitor não grava. Não existem políticas de Storage ou URLs públicas novas. Escopo/autor/criação são imutáveis; o navegador não pode alterar histórico ou apagar atas. Triggers validam schema/limites também para gravações diretas via Data API.

## Integração e publicação

Base isolada: `main` em `79f42f112350a5375ff3b66e6e556fcfe264ac13`. Flag `VITE_INEP_MINUTES_ENABLED` desligada por padrão. Os pontos de montagem são Biblioteca INEP e Repositório; nenhum arquivo preenchido é inserido no acervo de modelos.

**Gate concreto antes da ativação:** conciliar a política de consulta/escrita com a frente IES/governança. A main e o ZIP desta base não contêm `academic-approvals.ts` nem `VITE_ACADEMIC_GOVERNANCE_ENABLED`, embora os RPCs IES já existam no banco remoto. Não aplicar esta migração ou habilitar a flag sem validar o contrato final de escopo/papéis dessa frente. Nenhuma transição de aprovação foi implementada para contornar esse contrato.

PR #7, head documental `dffe1cd9`, altera `InepLibrary.tsx`; preservar o controle de respostas atrasadas e as verificações de download ao integrar os dois novos pontos de montagem. Esta frente não modifica Workspace, RecordForm, OwnerDashboard, lockfile, modelos, Storage ou Edge. Não fecha os gates de smoke hospedado/revisão editorial da PR #7.

Ordem de rollout: conciliar contratos e revisão → repetir testes contra código integrado → aplicar migração → teste autenticado real com MFA de duas IES e papéis distintos → habilitar flag/regerar pacote estático seguindo o pipeline existente → verificar commit remoto, CI, implantação e comportamento publicado. Ainda não aplicado/publicado por esta frente.

## Reprodução dos testes

Extrair o ZIP fonte em diretório descartável e sobrepor `source-overrides/` **e** a pasta `supabase/` do repositório. A suíte comercial precisa de `supabase/functions/vertice-demo/index.ts`, ausente do ZIP-base isolado.

```
npm ci --legacy-peer-deps --ignore-scripts
npm run check
npm test
npm run build:static
```

Banco PostgreSQL descartável: executar `supabase/tests/minutes-bootstrap.sql`, a migração nova, depois `supabase/tests/minutes-drafts.sql`, sempre com `psql -v ON_ERROR_STOP=1`. Bootstrap é exclusivamente local, cria stubs de Auth/Storage e usa os helpers reais de autorização; não é teste de sessão Supabase hospedada. A suíte de fixtures termina em ROLLBACK.

Prévia sintética local: em runtime descartável com Playwright 1.56.1 disponível, executar `node scripts/minutes-preview/serve.mjs`, depois `node scripts/minutes-preview/check.mjs`. A prévia usa API falsa isolada e dados fictícios; não acessa Supabase. Somente essa fixture guarda dados sintéticos em localStorage para simular recarregamento. Ela não é importada pela aplicação de produção nem deve entrar no pacote publicado.

As assinaturas continuam separadas: não há credenciais, integração GOV.BR ou assinatura legal simulada. Qualquer etapa futura de exportação/assinatura/reimportação depende de fluxo e provedor aprovados. Indicadores são organização documental; o preenchimento não atribui conceito regulatório.

## Evidências desta execução

- PostgreSQL 18.6 local, porta própria, migração aplicada com sucesso; todos os blocos de assertions do SQL passaram e as fixtures foram revertidas. Nenhuma consulta de teste escreveu no projeto hospedado.
- Suíte da aplicação: 146 testes em 23 arquivos, incluindo sete testes novos de validação e estado de gravação. A primeira execução teve uma suíte sem o arquivo de Edge no runtime extraído; resolvida copiando `supabase/` do repositório, sem alterar o teste.
- TypeScript e build estático passaram. O build informa chunks maiores que 500 KB e avisos já presentes de anotação do Zod; não são falhas de compilação.
- Teste Playwright com API sintética passou: criar/editar, ação, gravação pendente durante navegação, retorno, reload, confirmação perdida/retry sem nova versão, troca de IES, desktop 1365 px e mobile 390 px, sem overflow nem erro JavaScript. Seletores dos testes foram corrigidos para usar nomes acessíveis de controles já preenchidos.
- Capturas desktop/mobile em `docs/minutes-validation/`, inspecionadas visualmente: campos, botões, mensagens e listas legíveis e sem sobreposição. São dados fictícios; não validam uma sessão hospedada.
- Consulta de advisors remotos foi somente leitura: existem avisos anteriores de funções SECURITY DEFINER e proteção de senhas. Não foram alterados por esta frente. A RPC nova é INVOKER; a única função nova DEFINER não é executável pelos papéis de API.
- Não executados: smoke autenticado hospedado, migração remota, aprovação acadêmica, assinatura, publicação/validação live. Dependem da integração descrita acima.
