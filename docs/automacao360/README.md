# Vértice Automação 360°

Situação: **pacote v1.0-rc.1 (Blocos 01 a 12) integrado ao repositório, inativo. Especificação candidata encerrada; homologação operacional não iniciada.** Nenhuma migração, cron, Edge Function, UI ou chamada externa foi criada.

| Peça | Local |
|---|---|
| Motor determinístico (`evaluate`) | `supabase/functions/_shared/automacao360/engine.mjs` |
| Catálogo versionado (40 regras propostas, opt-in) | `supabase/functions/_shared/automacao360/catalog.mjs` |
| Bloco 02, documental (`documentaryRun`, `evidenceChecklist`) | `supabase/functions/_shared/automacao360/documentary.mjs` |
| Bloco 03, pedagógico (`pedagogicalRun`) | `supabase/functions/_shared/automacao360/pedagogical.mjs` |
| Bloco 04, gestão acadêmica (`academicRun`: Estágio, TCC, Extensão, Ensino, AC) | `supabase/functions/_shared/automacao360/academic.mjs` |
| Bloco 05, estratégico e comercial (`strategicRun`: captação, concorrência, mercado, Due Diligence, financeiro, egressos) | `supabase/functions/_shared/automacao360/strategic.mjs` |
| Bloco 06, governança (`configure`, `approveConfig`, `queue`, `transition`, `planningProposal`, `effectiveness`) | `supabase/functions/_shared/automacao360/governance.mjs` |
| Bloco 07, integração nativa (`shadowRun` em modo sombra; `readIntegrationHealth` sobre o RPC existente `vertice_integration_monitor_read`) | `supabase/functions/_shared/automacao360/native-integration.mjs` |
| Bloco 08, recibo de execução sombra (`prepareShadowReceipt`, `persistShadowReceipt`) | `supabase/functions/_shared/automacao360/persistence.mjs` |
| Bloco 09, modelo do painel Master somente leitura (`loadMasterDashboard`, `filterRules`) | `supabase/functions/_shared/automacao360/master-dashboard.mjs` |
| Bloco 10, modelo do painel por IES/curso (`loadInstitutionDashboard`, `proposeInstitutionConfig`, `reviewInstitutionConfig`) | `supabase/functions/_shared/automacao360/institution-dashboard.mjs` |
| Bloco 11, integração transversal (`prepareIntervention`, `reviewIntervention`, `handoffIntent`, `compareIntervention`, `biSummary`), sem envio | `supabase/functions/_shared/automacao360/transversal.mjs` |
| Bloco 12, inventário e avaliação de elegibilidade (`inventory`, `assessRelease`); não ativa nada | `supabase/functions/_shared/automacao360/release.mjs` |
| Roteiro de homologação e estado real das oito portas | `HOMOLOGACAO.md`, `ESTADO_PORTAS_20261124.md` |
| Painéis React candidatos, Master e institucional (não ligados ao portal), e sua verificação | `docs/automacao360/ui/` |
| DDL candidato (não é migração; não aplicar) e sua verificação em PostgreSQL descartável | `docs/automacao360/sql/` |
| Testes (334) | `scripts/tests/automacao360/` |
| CI | `.github/workflows/verify-automacao360.yml` |
| Norma do módulo | `BIBLIA-MESTRA.md` |
| Contrato para o desenvolvedor | `INTEGRACAO.md` |

Executar: `node --test scripts/tests/automacao360/*.test.mjs`

Os módulos ficam em `_shared` porque só podem rodar no servidor (Edge Function/Deno ou worker Node). Não importar no cliente. Eles não leem banco, não gravam, não agendam e não enviam nada: recebem um snapshot já autorizado e devolvem propostas `pending_review` com `requiresHumanApproval: true` e motivos de abstenção. Completude da fonte, autoria do parecer e verificação dos motores existentes (Avalia, Permanência) precisam ser atestadas pelo servidor.

Próximos passos: Onda 0 da Bíblia (inventário de jobs, triggers, workers e Edge Functions; mapeamento das fontes reais), equivalência SHA-256 em Deno; corrigir as três falhas do DDL candidato, RPC transacional de gravação, projeção real e adaptadores; ajustes do painel e integração ao layout Master; extrair o contrato nativo do 5W2H aplicado só em produção; seguir `HOMOLOGACAO.md` a partir do estado em `ESTADO_PORTAS_20261124.md`. Merge, migração e ativação são autorizações separadas.
