# Vértice Automação 360°

Situação: **pacote v0.6 (Blocos 01 a 06) integrado ao repositório, inativo.** Nenhuma migração, cron, Edge Function, UI ou chamada externa foi criada.

| Peça | Local |
|---|---|
| Motor determinístico (`evaluate`) | `supabase/functions/_shared/automacao360/engine.mjs` |
| Catálogo versionado (40 regras propostas, opt-in) | `supabase/functions/_shared/automacao360/catalog.mjs` |
| Bloco 02, documental (`documentaryRun`, `evidenceChecklist`) | `supabase/functions/_shared/automacao360/documentary.mjs` |
| Bloco 03, pedagógico (`pedagogicalRun`) | `supabase/functions/_shared/automacao360/pedagogical.mjs` |
| Bloco 04, gestão acadêmica (`academicRun`: Estágio, TCC, Extensão, Ensino, AC) | `supabase/functions/_shared/automacao360/academic.mjs` |
| Bloco 05, estratégico e comercial (`strategicRun`: captação, concorrência, mercado, Due Diligence, financeiro, egressos) | `supabase/functions/_shared/automacao360/strategic.mjs` |
| Bloco 06, governança (`configure`, `approveConfig`, `queue`, `transition`, `planningProposal`, `effectiveness`) | `supabase/functions/_shared/automacao360/governance.mjs` |
| Testes (220) | `scripts/tests/automacao360/` |
| CI | `.github/workflows/verify-automacao360.yml` |
| Norma do módulo | `BIBLIA-MESTRA.md` |
| Contrato para o desenvolvedor | `INTEGRACAO.md` |

Executar: `node --test scripts/tests/automacao360/*.test.mjs`

Os módulos ficam em `_shared` porque só podem rodar no servidor (Edge Function/Deno ou worker Node). Não importar no cliente. Eles não leem banco, não gravam, não agendam e não enviam nada: recebem um snapshot já autorizado e devolvem propostas `pending_review` com `requiresHumanApproval: true` e motivos de abstenção. Completude da fonte, autoria do parecer e verificação dos motores existentes (Avalia, Permanência) precisam ser atestadas pelo servidor.

Próximos passos: Onda 0 da Bíblia (inventário de jobs, triggers, workers e Edge Functions; mapeamento das fontes reais), equivalência SHA-256 em Deno e integração incremental em ambiente isolado (portas de integração do Bloco 06 em `INTEGRACAO.md`). Merge, migração e ativação são autorizações separadas.
