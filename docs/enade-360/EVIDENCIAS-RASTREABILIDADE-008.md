# Evidência 008 — Rastreabilidade auditável por resultado (protótipo)
Data: 2026-11-17 | Status: EXECUTADO em testes sintéticos de CI; **não** homologado com dados reais.

## Artefatos
- `validator/traceability-controls.cjs`: valida fonte e versão, hash SHA-256 sintático, indicador, edição, metodologia, área/curso/IES, estado, classificação epistêmica, decisão humana e status de publicação.
- `validator/test-traceability.cjs`: 28 casos sintéticos.
- `validator/test-trace-integration.cjs`: seis casos em relatório R1 end-to-end (vinculação ao gate).
- `validator/integrated-gate.cjs`: invoca os controles de rastreabilidade na mesma instância do relatório quando `traceability_version: "0.1"` estiver presente.
- `CONTRATO-RASTREABILIDADE-RESULTADOS.md`: especificação do envelope, pendências de segurança e aceitação.

## Evidência do GitHub Actions
Run: **44044766932**; job: **133907618976**; commit: **e55e2ac5c60276c63c2d2030e65d7eda03f233d4**; conclusão: `completed/success`.
Logs: 26/26 contratos básicos, 34/34 por edição, 26/26 intercampos, 23/23 R2–R6, 29/29 estados, 28/28 rastreabilidade, 6/6 integração de trilha, 40/40 validação Draft 2020-12 + Node = **212/212 casos sintéticos aprovados**, zero falhas.
URL: https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44044766932

## Principais aceitações e bloqueios sintéticos
- Fonte, URL, versão e hash de formato válido; edição, curso, IES, metodologia e indicador identificados.
- Dados ausentes não se convertem em zero; dado zero real é permitido sob AVAILABLE.
- Decisão APPROVED exige revisor, data, justificativa e digest da evidência.
- Aprovação sobre estado não disponível, fonte substituída ou hipótese sem pressupostos/limites é rejeitada.
- `publication_status` só permite `DRAFT_ONLY` mesmo com aprovação humana.
- Duplicações de trace_id e inconsistências com o escopo do relatório são rejeitadas.
- Um relatório legado sem envelope de rastreabilidade ainda é aceito: a exigência plena depende de migração planejada.

## Limitações metodológicas e de segurança
- Os 212 casos são sintéticos. Não comprovam autenticidade do SHA-256 perante o documento oficial, permissão institucional real, assinatura do revisor, armazenamento inviolável, ou recomputação do Conceito Enade.
- A verificação de formato da data não equivale a uma assinatura temporal verificável.
- O digest de evidências é campo obrigatório para aprovação, mas seu conteúdo não é checado criptograficamente neste protótipo.
- Integração com Supabase, Render, front-end, APIs ou isolamento multi-IES NÃO executada.
- O envelope é opt-in; nenhum relatório legado pode ser tratado como auditado sem migração e replay dos testes.
- Não há autorização de deploy/publicação nesta etapa.

## Pendências
P-TRACE-001: migração controlada e prova real de rastreabilidade fim a fim, controles de acesso e integridade de evidências.
P-CROSS-001: integração com dados reais e contratos R1–R7.
P-ZIP-001: fornecimento dos microdados oficiais pelo usuário.
P-NT-001: metodologia integral por edição.
P-REF-001: planilhas oficiais versionadas.
P-TOL-001: tolerâncias e arredondamentos confirmados documentalmente.
Núcleo genérico **NÃO HOMOLOGADO**; especialização por curso bloqueada.
