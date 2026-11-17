# ENADE 360° — Arquitetura proposta de auditoria persistente e leitura de evidências
Versão de projeto: 0.1 | 2026-11-17 | STATUS: ESPECIFICAÇÃO; nenhum banco alterado

## Objetivo
Preservar eventos cumulativos por resultado/IES/curso, permitindo reprodução, revisão, rejeição e revalidação. Preparar o Supabase para leitura segregada, sem expor eventos ao público nem antecipar publicação acadêmica.

## Modelo lógico proposto (não é migração executada)
- `enade_audit_streams`: stream_id, tenant_id, institution_id, course_id nullable, result_id, edition_year, indicator, created_at, status DRAFT_ONLY.
- `enade_audit_events`: event_id, stream_id, sequence (monotônica por stream), event_type, event_at, actor_id, actor_role, source_id, source_version, source_sha256, methodology_id, payload_digest, previous_hash, event_hash, correlation_id, idempotency_key. Unicidade de (stream_id, sequence) e (stream_id, idempotency_key). Inserção somente via operação transacional de backend autorizado.
- `enade_audit_sources`: source_id, URL, original_filename, edition_year, file_version, sha256, captured_at, supersedes_source_id, checked_by.
- `enade_audit_decisions`: decision_id, event_id, reviewer_id, reviewer_role, decision (APPROVED/REJECTED), justification, evidence_digest, decided_at. Nenhuma decisão isolada altera status de publicação.
- `enade_audit_access_grants`: principal_id, tenant_id, institution_id, optional course_id, role, validity, grant_version; origem deve ser autoridade institucional confiável, jamais `user_metadata`.

## Invariantes de persistência e integridade
1. Event log *append-only*: UPDATE/DELETE/TRUNCATE proibidos ao cliente. Correção é evento novo; nenhum evento anterior é apagado.
2. Alocação de `sequence`, `previous_hash` e `event_hash` ocorre atomicamente dentro do mesmo stream sob lock transacional. Canonicalização JSON determinística e algoritmo/documentação versionados.
3. `event_hash` é evidência de detecção de alteração relativa à cadeia, mas **não comprova imutabilidade contra administrador de banco**. Para evidência independente, ancorar periodicamente digest em destino isolado e testar restauração.
4. Não persistir dados individuais desnecessários; payload público deve ser separado dos anexos protegidos.
5. Chaves de IES e curso devem ser conciliadas com cadastro institucional antes de criar vínculos.
6. DRAFT_ONLY continua único estado permitido pelo protótipo. Publicação externa requer fluxo específico, fora do escopo desta etapa.

## Estratégia Supabase (somente planejamento)
Preferir schema privado não exposto à Data API; RLS como segunda camada. `anon` e `authenticated` sem privilégios diretos nas tabelas de eventos; a API autenticada verificará identidade e permissão institucional do usuário, com consultas parametrizadas e registros de acesso. A implementação em serviço privilegiado demanda testes de escopo e limites; nunca expor service role no navegador. Para eventuais views expostas, usar segurança adequada ao PostgreSQL e restringir grants.

**Nenhuma migração SQL foi gerada, aplicada ou autorizada nesta etapa.** O desenho precisa ser confrontado com o schema real, versões existentes, chaves/índices, backfills, rotinas de backup e regras de autorização da Vértice antes de uma migração reversível.

## Contrato de API exclusivamente de leitura (proposta)
`GET /internal/enade360/audit/streams/{stream_id}/events?cursor=...&limit=...`
`GET /internal/enade360/audit/results/{result_id}/evidence`
`GET /internal/enade360/audit/results/{result_id}/decisions`

Regras: autenticação obrigatória, authorization server-side por tenant/IES/curso, limites de paginação, 404 ou resposta neutra para recursos sem permissão, ordenação por (sequence, event_id), sem parâmetros de bypass, sem rotas POST/PUT/PATCH/DELETE externas. Cada resposta inclui `traceability_version`, `source_version`, `methodology_id`, `evidence_digest`, `decision_status`, `publication_status=DRAFT_ONLY`, e motivo de ausência quando aplicável.

## Matriz de acesso proposta
| Perfil | Escopo de leitura | Pode revisar | Pode publicar |
|---|---|---|---|
| Master | Tenants autorizados formalmente, administração/auditoria | Apenas perfis com competência expressa; Master não substitui parecer técnico | Não |
| Reitoria | Instituição autorizada, todos os seus cursos | Parecer/validação no nível institucional conforme delegação | Não |
| Coordenação | Somente curso(s) autorizados e sua IES | Parecer sobre o próprio curso | Não |
| NDE | Somente curso(s) com participação autorizada | Parecer técnico do curso quando designado | Não |
| CPA | Dados institucionais agregados e evidências autorizadas, dados pessoais minimizados | Parecer conforme atribuições da CPA | Não |
| Sem perfil / externo | Nenhum | Não | Não |

A separação não dispensa RLS e testes de isolamento entre IES. Dados pessoais de concluintes não são automaticamente autorizados a nenhum desses perfis por esta matriz.

## Portões futuros
P-TRACE-001: schema persistente real, hashes computados e verificados, testes adversariais de permissões, migração reversível, logs de consultas e comprovação de segregação.
P-ACCESS-001: confrontar os papéis propostos com o cadastro efetivo da Vértice e homologar cada permissionamento com usuários de teste.
P-API-001: implementar contrato de API somente leitura após validação de RLS/grants.
P-ZIP-001, P-NT-001, P-REF-001, P-TOL-001 continuam; núcleo científico NÃO HOMOLOGADO.
