# Vértice Automação 360°

**Situação em 24/11/2026: migrações aplicadas em produção (versões 20261124210000/1/2, em transação única, após ensaio desfeito no esquema real). Módulo `GEST_AUTOMACAO360` existe no catálogo com `active=false`; nenhuma revisão de configuração aprovada; nenhuma execução sombra; nenhuma regra ativa.** Três migrações candidatas em `supabase/migrations/`; módulo `GEST_AUTOMACAO360` nasce com `active=false`. Nenhum cron, Edge Function ou chamada externa foi criada. Relatório: `RELATORIO_FINAL_20261124.md`.

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
| Contrato nativo do 5W2H extraído de produção, com diagnóstico | `contratos-nativos/5w2h/` |
| Roteiro de homologação e estado real das oito portas | `HOMOLOGACAO.md`, `ESTADO_PORTAS_20261124.md` |
| Painéis React candidatos do pacote (referência histórica; substituídos pela Central) | `docs/automacao360/ui/` |
| DDL candidato do Bloco 08 (referência histórica; substituído pela migração `20261124210000`) | `docs/automacao360/sql/` |
| Migrações (núcleo, catálogo, correção do 5W2H) — aplicadas em produção em 24/11/2026 | `supabase/migrations/20261124210000*`, `…210001*`, `…210002*` |
| Mapa de fontes reais das 40 regras e matriz gerada | `supabase/functions/_shared/automacao360/source-map.mjs`, `MATRIZ_REGRAS.md` |
| Central de Automação no portal (Master e IES) | `source-overrides/client/src/components/automacao360/` |
| Reversão e reconciliação do cron | `REVERSAO.md`, `RECONCILIACAO_CRON_20261124.md` |
| Testes do motor (334) | `scripts/tests/automacao360/` |
| Testes SQL (25, PGlite) e concorrência (3, PostgreSQL 16) | `scripts/tests/automacao360-sql/` |
| CI | `.github/workflows/verify-automacao360.yml` |
| Norma do módulo | `BIBLIA-MESTRA.md` |
| Contrato para o desenvolvedor | `INTEGRACAO.md` |

Executar: `node --test scripts/tests/automacao360/*.test.mjs`

Os módulos ficam em `_shared` porque só podem rodar no servidor (Edge Function/Deno ou worker Node). Não importar no cliente. Eles não leem banco, não gravam, não agendam e não enviam nada: recebem um snapshot já autorizado e devolvem propostas `pending_review` com `requiresHumanApproval: true` e motivos de abstenção. Completude da fonte, autoria do parecer e verificação dos motores existentes (Avalia, Permanência) precisam ser atestadas pelo servidor.

Executar SQL: `cd scripts/tests/automacao360-sql && npm ci && node --test *.test.mjs`

Próximos passos: autorizações separadas para (1) merge, (2) aplicar as três migrações em homologação e depois em produção, (3) publicar o portal com o módulo inativo, (4) execução sombra com dados reais sob controles de proteção de dados, (5) ativar o módulo por IES. Pendências técnicas: adaptadores das 36 regras restantes, 9 regras sem fonte, testes com JWT real. Ver `ESTADO_PORTAS_20261124.md`.
