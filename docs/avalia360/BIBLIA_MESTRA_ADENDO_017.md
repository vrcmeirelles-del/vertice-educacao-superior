# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 017 — Branch Supabase autorizada e recuperação de migrações
**Data local:** 2026-11-19 (20/11 UTC) · **PR:** #207, rascunho

### Preservação
Todos os requisitos dos adendos 001–016 permanecem válidos: motor longitudinal curricular, formulário, imagens com hash/legenda/acessibilidade/direitos, rascunhos versionados, autonomias docentes, integrações Fato & Ordem/Sapiens e correções futuras.

### Autorização financeira e criação reais
- O usuário autorizou expressamente o valor **US$ 0,01344 por hora** de branch Supabase.
- A confirmação de custo foi registrada na plataforma e a branch `avalia360-homologacao-20261119` foi criada.
- Branch ID de gerenciamento: `6b667b1c-92a6-44e5-85ee-e239ef24b41e`.
- Projeto branch: `eagkkkclfcedzanuqckj`.
- Projeto de produção, intocado: `qvetbbmviatxxatzzuzc`.
- Branch criada sem cópia de dados de produção (`with_data=false`).

### Estado encontrado na homologação
A branch passou ao estado `MIGRATIONS_FAILED`. Consultas SQL confirmaram que não existem `public.vertice_courses`, `vertice_app.curriculum_builds` nem `public.vertice_learning_staff_scope` e que não havia migrações restauradas na branch. Portanto, a plataforma de origem e seus controles de autorização **não estão reproduzidos nessa branch**.

### Recuperação controlada
A ação `reset_branch` foi executada uma única vez e retornou `success=true`. Na inspeção imediata seguinte, a branch voltou a `CREATING_PROJECT`, ainda com zero migrações e sem as tabelas essenciais. A recuperação não pode ser considerada concluída até inspeção posterior.

### Regras de segurança
- Não executar os scripts Avalia 360° sobre um Supabase desprovido da estrutura de autorização da Vértice.
- Não criar usuários ou dados institucionais artificiais na produção.
- Não fazer merge da branch nem publicar funções sem restauração íntegra, revisão RLS/grants e testes autenticados.
- A criação da branch autorizada iniciou um recurso potencialmente cobrado por hora. Avaliar encerramento se o reset falhar e não houver plano viável de recuperação, evitando custo inútil.

### Evidências anteriores preservadas
GitHub Actions #44641929603: 60 testes unitários e 18 testes PostgreSQL isolados aprovados. São testes sintéticos; não representam execução Auth/Storage real.

### Pendências e próximos passos
- [x] Custo explicitamente autorizado e confirmado.
- [x] Branch criada sem dados de produção.
- [x] Falha de restauração identificada e registrada.
- [x] Um reset controlado solicitado.
- [ ] Confirmar estado final do reset e contar migrações restauradas.
- [ ] Diagnosticar discrepância entre migrações versionadas e banco da origem.
- [ ] Apenas depois aplicar RPC/bucket/Edge Function no ambiente isolado.
- [ ] Upload de imagem real com JWT/MFA por docente e validação multi-IES/curso.
- [ ] Homologação de prova real com PPC e imagens e publicação controlada.

### Atualização de recuperação, Storage e Edge Function — evidência efetiva
- Após o reset controlado, o Supabase informou `FUNCTIONS_FAILED` na branch. Consulta ao log `workflow_run_logs` revelou falha ao tentar publicar uma função existente, `vertice-source-pdf-preview`: `script_size=35.78MB`, rejeitada com **HTTP 413 request entity too large**. Essa função não pertence ao Avalia 360°.
- A sequência de logs também informou `Pulling migrations from database` e `All migrations are up to date`, embora consultas posteriores confirmassem **zero migrações na branch** e ausência das tabelas institucionais `public.vertice_courses`, `vertice_app.curriculum_builds` e `public.vertice_learning_staff_scope`. Assim, a restauração do contexto de autorização está incompleta e não pode ser considerada homologada.
- Foi aplicada **exclusivamente na branch `eagkkkclfcedzanuqckj`** a migração `avalia360_private_storage_bucket_staging`. Consulta subsequente a `storage.buckets` confirmou o bucket `avalia360-private`, `public=false`, máximo de `10485760` bytes e MIME permitidos `image/png`, `image/jpeg`, `image/webp`.
- Foi implantada **exclusivamente na branch** a Edge Function `vertice-avalia-media`, status `ACTIVE`, versão 1, `verify_jwt=true`. Isso demonstra implantação, **não execução autenticada bem-sucedida**.
- Consulta posterior a `to_regprocedure` confirmou que `public.vertice_avalia_media` e `public.vertice_avalia_draft` **não existem na branch**. As RPCs de autorização e persistência não foram aplicadas; a função não consegue completar a preparação/confirmacão de upload.
- Não foram realizados testes reais com usuário MFA/AAL2 nem envio de imagens ao Storage. Uma tentativa externa de acesso à URL da função via ambiente de terminal falhou por indisponibilidade de resolução DNS, não constituindo resposta HTTP da função.
- **Não houve alterações no projeto de produção `qvetbbmviatxxatzzuzc`.**

### Novo status dos itens
- [x] Branch criada com custo expressamente aprovado de US$ 0,01344/hora.
- [x] Bucket privado criado e conferido na branch real.
- [x] Edge Function de imagem implantada na branch, JWT obrigatório.
- [x] Falha da clonagem automática localizada em função de 35,78 MB, HTTP 413.
- [ ] Restaurar tabelas institucionais e autorizações de forma fiel, sem criar ambiente artificial que falseie a homologação.
- [ ] Aplicar SQL das RPCs de rascunho/imagens somente após restabelecer dependências.
- [ ] Testar fluxo real em Supabase Auth/Storage com MFA, perfis/curso e imagens.
- [ ] Avaliar redução do pacote `vertice-source-pdf-preview` ou exclusão seletiva dessa função **apenas na configuração de homologação**, sem tocar produção.
- [ ] Controlar custo horário e decidir manutenção ou encerramento da branch se o bloqueio perdurar.

### Critério de relato
**A camada Storage + deploy da função teve avanço real; a homologação da integração completa continua bloqueada.** O estado `ACTIVE` de uma Edge Function não equivale a sucesso de suas RPCs ou do upload.

### Checklist reprodutível e custo controlado
- O novo arquivo `docs/avalia360/sql/HOMOLOGACAO_PRECHECK_READONLY.sql` contém consultas **somente leitura** para inspecionar nove pré-requisitos de homologação, sem depender de dados pessoais.
- Execução direta na branch Supabase `eagkkkclfcedzanuqckj`: **2/9 checks verdadeiros** (`bucket_privado` e `storage_rls_ativo`); sete falsos (`autorizacao_institucional`, `cursos_institucionais`, `lotacao_docente`, `matriz_curricular`, `rpc_finalizacao_imagens`, `rpc_imagens`, `rpc_rascunhos`).
- A análise de segurança do Supabase para a branch retornou **zero alertas**; isso NÃO supera os sete itens ausentes nem substitui testes reais de autenticação.
- Para reduzir exposição à cobrança por hora enquanto a clonagem automática permanece bloqueada, foi solicitada a ação `pause_project` **somente para a branch do Avalia 360°**. A ferramenta confirmou `success=true` e a listagem posterior mostrou `preview_project_status=PAUSING` (pausa solicitada; confirmação de `INACTIVE` ainda pendente). **A produção não foi pausada.**
- Quando o problema de base for resolvido, a branch deverá ser restaurada antes de prosseguir com RPCs/Storage. A fatura efetiva deve ser conferida no Supabase, pois a cotação horária não é comprovante de cobrança.
