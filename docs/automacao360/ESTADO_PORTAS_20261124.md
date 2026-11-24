# Estado real das portas de liberação — 24/11/2026

Cruzamento das oito portas de `assessRelease` (Bloco 12) com o que foi efetivamente verificado neste repositório. Nenhuma porta pode ser marcada `passed: true` hoje, porque nenhuma foi verificada no banco real; **as 40 regras continuam bloqueadas**. Atualizado após a missão de integração (mesma data). Este documento é evidência de situação, não de aprovação.

`inventory()`: 40 regras; 37 com família de adaptador mapeada; 3 sem adaptador (`cpa.pending`, `pei.overdue`, `school.attendance`); 0 com estado operacional verificado.

| Porta | Situação | Evidência existente | Falta |
|---|---|---|---|
| `native_adapter` | **parcial** | adaptadores SQL `vertice_automation_source_documentary` (repo.overdue/due) e `vertice_automation_source_planning` (pei.overdue, cpa.pending) testados em PGlite com o esquema de produção, ponta a ponta até `shadowRun` (`scripts/tests/automacao360-sql/nucleo.test.mjs`); destino 5W2H em `vertice_actions` com origem `automacao_360` e índice único | adaptadores das demais 36 regras; 9 regras sem fonte (`MATRIZ_REGRAS.md`); execução contra o banco real de homologação |
| `rls` | **corrigida no candidato; não homologada** | migração `20261124210000`: as 3 falhas do Bloco 08 corrigidas (FK composta curso/IES sobre o índice existente `vertice_courses_scope_key`; gatilhos de imutabilidade; `run_guard` exige revisão vigente aprovada e ativa). Isolamento entre IES, coordenador fora do curso, sem MFA e chamada direta às tabelas recusados nos testes | executar com JWT real (aal1/aal2) em homologação autorizada |
| `transaction` | **atendida em ambiente descartável** | CAS de revisão, advisory lock, idempotência de `record_run` e `handoff_5w2h`; 3 corridas reais em PostgreSQL 16 (`concorrencia-pg.sh`) | repetir em homologação |
| `ui_build` | **atendida no repositório** | Central de Automação integrada ao Master e à área da IES (`source-overrides/client/src/components/automacao360/`); `npm run build:static` completo, verificação TypeScript sem erros, 14 testes de interface; suítes do portal 510 + 452 + 45 + 35 aprovadas | validação visual com usuários reais; acessibilidade com leitor de tela |
| `shadow_comparison` | não atendida | execução sombra sintética ponta a ponta | sombra com dados reais exige autorização e controles de proteção de dados |
| `cost_budget` | não atendida | nenhum custo novo criado (sem job, Edge Function, serviço ou API externa) | orçamento aprovado e medição em produção |
| `rollback_drill` | **ensaiada em ambiente descartável** | revisão desativada bloqueia `record_run` e preserva histórico (teste de reversão); plano em `REVERSAO.md` | ensaio em homologação |
| `human_review` | não atendida | segregação implementada (autor ≠ aprovador, verificação independente, justificativa no encerramento) | revisão humana real por regra, IES e curso |

Pré-requisitos fora das portas: equivalência SHA-256 em Deno **feita** (9 chaves idênticas, `scripts/tests/automacao360/equivalencia-runtime.mjs`); mapeamento das permissões `automation.*` aos papéis nativos **feito** em `vertice_private.automation_can`; reconciliação das nove rotinas cron **feita** (`RECONCILIACAO_CRON_20261124.md`).
