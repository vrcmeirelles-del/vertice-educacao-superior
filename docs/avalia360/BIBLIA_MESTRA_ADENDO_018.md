# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 018 — Recuperação parcial real do Supabase e validação transacional
**Data:** 2026-11-19 (data local; logs em 20/11 UTC) | **PR:** #207 (rascunho)
**Escopo:** somente branch `eagkkkclfcedzanuqckj`; produção `qvetbbmviatxxatzzuzc` inalterada.

### Preservação obrigatória
Todos os requisitos/adendos 001–017 permanecem vigentes: avaliação diagnóstica/formativa/somativa; integração PDI/PPC/Construção Curricular; longitudinalidade interdisciplinar; curadoria pedagógica consultiva e autonomia docente; imagens com posição, legenda e direitos; QR/OMR/Discursiva 360°; Fato & Ordem, Sapiens 360°, planejamento e psicometria futura quando cabível.

### Causa do bloqueio da branch
1. Supabase Branching reconstrói o esquema por migrations em vez de clonar todas as tabelas de produção. O projeto principal possuía 226 migrações registradas, mas a branch nasceu sem os esquemas institucionais; o estado de provisionamento ficou em MIGRATIONS_FAILED e, após reset, FUNCTIONS_FAILED.
2. Logs de clonagem registraram rejeição HTTP 413 ao tentar restaurar a Edge Function existente `vertice-source-pdf-preview`, com pacote de 35,78 MB. Essa função depende de `pdfjs-dist@5.4.624`; o arquivo TypeScript de origem é pequeno, mas o bundle reportado é grande.
3. O problema PDF é separado da estrutura SQL e NÃO foi resolvido. A branch pode conter funções específicas do Avalia testadas separadamente, embora seu estado agregado continue FUNCTIONS_FAILED.
4. Referências: https://supabase.com/docs/guides/deployment/branching e https://supabase.com/kb/troubleshooting/branch-in-migrations-failed-status.

### Recuperação realizada, somente na branch
- `202610260001_access_foundation.sql` original do GitHub aplicado como migração de staging; recuperadas instituições, cursos, memberships, funções de base, RLS e trilha institucional.
- `STAGING_AUTH_SCOPE_RECOVERY_REVIEW.sql`: recuperada função `vertice_private.member_role` e `has_role` com lógica conferida na produção, e tabela `public.vertice_learning_staff_scope` com constraints/políticas conferidas em produção. Quatro políticas RLS de lotação docente foram confirmadas no ambiente isolado.
- `STAGING_CURRICULUM_STRUCTURE_ONLY.sql`: espelho **estrutural limitado** das tabelas `vertice_app.institutions`, `courses`, `curriculum_builds`, `curriculum_competencies`, `curriculum_discipline_links`, sem copiar dados. RLS default-deny deliberadamente mais restritivo do que as políticas curriculares de produção.
- Migração de rascunhos `RASCUNHOS_RPC_STAGING_V1.sql` aplicada após correção de delimitador PL/pgSQL; grava revisões e snapshots e bloqueia cursos de outra instituição.
- Migração de imagens `IMAGENS_PRIVADAS_STAGING_V1.sql` aplicada; tickets, escopo docente, mídias e finalização exclusiva para serviço.
- Bucket `avalia360-private` privado (PNG, JPEG, WebP; limite 10 MiB) e Edge Function `vertice-avalia-media` ACTIVE/JWT exigido foram criados previamente nessa mesma branch.
- O checklist `HOMOLOGACAO_PRECHECK_READONLY.sql` retornou **9/9 verificações positivas**, que significam presença de dependências e controles estruturais, NÃO paridade da plataforma inteira nem funcionamento HTTP/Auth/Storage ponta a ponta.

### Correção científica de interpretação
Consulta inicial em pg_constraint mostrava apenas PK(id) de `public.vertice_courses` e levou à afirmação errônea de que não existia índice único composto. Inspeção posterior em pg_index comprovou os índices únicos `vertice_courses_institution_id_pair` e `vertice_courses_scope_key` sobre (id,institution_id). Portanto a FK composta original era tecnicamente válida na produção. O contrato atual utiliza FK simples por id + trigger de validação de instituição como defesa adicional, e o fixture PGlite foi ajustado para usar PK(id). Corrigir afirmações anteriores que confundiram índice UNIQUE com constraint UNIQUE.

### Evidências de teste
- GitHub Actions **#44647253280**: 60/60 Vitest, 19/19 PostgreSQL isolado e TypeScript isolado aprovados.
- `STAGING_AUTH_RPC_TRANSACTIONAL_SMOKE.sql`: execução real no PostgreSQL da branch retornou `transactional_smoke=PASS` e criação temporária de 1 rascunho; cobriu criar/ler/atualizar, revisão concorrente, curso não autorizado e rejeição de AAL1 **com claims simuladas**. Consulta após ROLLBACK: 0 usuários, 0 instituições e 0 rascunhos sintéticos.
- `STAGING_MEDIA_RPC_TRANSACTIONAL_SMOKE.sql`: retorno `media_rpc_simulated_smoke=PASS`; cobriu preparar ticket, simular finalização no papel service_role e salvar/reabrir rascunho com mídia. Após ROLLBACK: 0 mídias, 0 rascunhos e 0 usuários sintéticos.
- Privilégios reais: authenticated executa `vertice_avalia_draft` e `vertice_avalia_media`; anon não executa; authenticated não executa `vertice_avalia_media_finalize` nem SELECT nas tabelas privadas.
- **LIMITAÇÃO MATERIAL:** claims de usuário/MFA foram simuladas no SQL transacional. Isso não é teste com JWT assinado emitido pelo Auth e tampouco representa upload real de bytes por URL assinada.

### Alertas do Security Advisor
- 8 avisos INFO `rls_enabled_no_policy`: 5 tabelas `vertice_app` e 3 `vertice_avalia` com RLS e sem políticas. Na branch isso é default-deny intencional, a revisar para o futuro gateway.
- 2 WARN `authenticated_security_definer_function_executable`: RPCs públicas `vertice_avalia_draft` e `vertice_avalia_media`. Executabilidade para authenticated é intencional, mas exige revisão independente contra IDOR, claims falsificados, busca transversal e mudança de escopo. Não considerar o alerta aprovado apenas porque o teste sintético passou.
- Referências de remediação: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy e https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable.

### Estado e bloqueios verdadeiros
- [x] Banco isolado reativado e dependências mínimas recuperadas.
- [x] RPCs e RLS inspecionados diretamente no Supabase de homologação.
- [x] Testes transacionais com role/claims simulados e rollback.
- [x] Edge Function publicada somente na branch e bucket privado criado.
- [ ] Restauração integral de todas as 226 migrações da plataforma e solução do bundle PDF HTTP 413.
- [ ] Paridade de políticas curriculares com produção — o espelho é deliberadamente reduzido e bloqueia acesso direto.
- [ ] Usuários Auth de teste com JWT/AAL2 REAL, vínculos legítimos de curso e MFA, sem contas ou dados de produção.
- [ ] Teste HTTP real: ticket -> uploadToSignedUrl -> download -> SHA-256 -> vínculo -> reabertura.
- [ ] Validação de PPC e provas institucionais reais; acervo de construção curricular consultado na produção estava vazio.
- [ ] Revisão de segurança dos dois SECURITY DEFINER, teste navegador/E2E e aprovação pedagógica.
- [ ] Merge e publicação: não autorizados.

### Próxima decisão técnica
Reduzir/segregar o bundle de `vertice-source-pdf-preview` no fluxo de clonagem (sem alterar sua funcionalidade em produção), sincronizar migrações fonte↔produção e criar credenciais Auth de homologação por perfil, com MFA. Depois testar a Edge Function e o Storage por HTTP em ambiente isolado. Pausar a branch após os testes enquanto a etapa HTTP depender de credenciais/provisionamento, para controlar cobrança por hora.
