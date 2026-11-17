# Contrato de rastreabilidade por resultado — Vértice ENADE 360°
Versão 0.1 | 2026-11-17 | Especificação executável isolada, sem implantação nem publicação.

## Cadeia obrigatória
Um resultado rastreável liga **result_id → fonte identificada/versão/SHA-256 → indicador/edição/área/IES/curso → metodologia e versão → estado do resultado → rótulo epistêmico → evidências → parecer humano → status de publicação**.

Campos mínimos do envelope: trace_id, result_id, indicator, edition_year, academic_degree, area_code, institution_code, course_code, methodology_id, methodology_reference, methodology_version, engine_version, source_id, source_version, source_url, source_sha256, retrieved_at, state, value, epistemic_label, evidence_refs, decision, publication_status.

A trilha é identificada como `traceability_version: "0.1"`, ligada ao array `result_traces`. A incorporação ainda é **opt-in** para evitar que relatórios legados sejam falsamente marcados como auditados. A migração que tornará a trilha obrigatória deve ter execução controlada e testes de regressão.

## Decisão humana
decision.status: PENDING / APPROVED / REJECTED. Um aceite exige reviewer_id, reviewed_at, justification e evidence_digest; uma rejeição exige justificativa. Mesmo uma aprovação com metadados completos não permite publicação automática. A verificação criptográfica do digest da evidência ainda não foi implementada — sua presença no contrato não comprova assinatura eletrônica.

## Estados de indisponibilidade
AVAILABLE pode registrar zero real. SC, MISSING, PENDING, NOT_APPLICABLE e NOT_PUBLISHED não devem conter valor numérico. As justificativas específicas desses estados continuam sob `result-state-controls.cjs`; por enquanto, o envelope de rastreabilidade exige enum e coerência numérica, mas a validação interna completa de cada estado depende da integração de todos os consumidores R1–R7.

## Proteções de publicação
`publication_status` somente aceita `DRAFT_ONLY` neste protótipo. `APPROVED` não equivale a publicar. Fontes substituídas bloqueiam aprovação e requerem nova conciliação. Diferenças entre escopo do relatório e os IDs rastreados são rejeitadas. Duplicação de trace_id é rejeitada.

## Segurança e limites
Não há armazenamento imutável de eventos, assinatura digital, controle real de acesso por perfil, persistência no Supabase, trilha de auditoria do banco nem integração à aplicação Vértice nesta fase. O SHA-256 no envelope é validado quanto ao formato; **não foi confrontado com os binários oficiais**.

## Portões de integração controlada futura
1. Políticas de acesso por instituição/curso implementadas e testadas no banco.
2. Schema da trilha versionado e migração reversível, sem modificar resultados oficiais.
3. Testes reais de vínculo entre IDs de IES/curso e dados do INEP.
4. Encadeamento e armazenamento inviolável ou detectável de eventos com prova de integridade.
5. Revisão humana com registro verificável de decisão e justificativa.
6. Aprovação acadêmico-metodológica e autorização específica antes de qualquer publicação.
7. Reprodução oficial dos indicadores, condição indispensável à homologação científica.

Pendências P-ZIP-001, P-NT-001, P-REF-001 e P-TOL-001 preservadas. Nova pendência P-TRACE-001: tornar obrigatória a cadeia auditável R1–R7 após completar integração, segurança e prova de integridade. P-CROSS-001 permanece parcial.
