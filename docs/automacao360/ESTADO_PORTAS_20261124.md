# Estado real das portas de liberação — 24/11/2026

Cruzamento das oito portas de `assessRelease` (Bloco 12) com o que foi efetivamente verificado neste repositório. Nenhuma porta pode ser marcada `passed: true` hoje; **as 40 regras estão bloqueadas**. Este documento é evidência de situação, não de aprovação.

`inventory()`: 40 regras; 37 com família de adaptador mapeada; 3 sem adaptador (`cpa.pending`, `pei.overdue`, `school.attendance`); 0 com estado operacional verificado.

| Porta | Situação | Evidência existente | Falta |
|---|---|---|---|
| `native_adapter` | não atendida | contrato de `vertice_integration_monitor_read` conferido contra a migração `20261115012658` (Bloco 07) | adaptadores reais das quatro famílias; contrato do 5W2H (migração `20261111010933` sem SQL no repositório) |
| `rls` | **reprovada no candidato** | DDL executado em PostgreSQL 16 descartável: RLS fechada funciona, mas 3 falhas de integridade (`sql/verificacao/RESULTADO_20261124.md`) | corrigir curso de outra IES, auditoria mutável, execução com configuração não aprovada; testar com papéis nativos |
| `transaction` | não atendida | replay conflitante e duplicidade recusados por chave no DDL candidato | RPC transacional com CAS de revisão; teste de concorrência real |
| `ui_build` | parcial | dois painéis compilados em modo estrito e renderizados fora do portal (`ui/VERIFICACAO_20261124.md`) | integrar ao layout Master/IES, build do portal e testes `*.ui.test.tsx` |
| `shadow_comparison` | não atendida | — | adaptadores reais e execução sombra autorizada |
| `cost_budget` | não atendida | — | orçamento aprovado e medição |
| `rollback_drill` | não atendida | — | mecanismo de suspensão implementado e ensaiado |
| `human_review` | não atendida | — | revisão independente por regra, IES e curso |

Pré-requisitos fora das portas: equivalência SHA-256 em Deno; mapeamento das permissões `automation.*` aos papéis nativos (`vertice_admins` com `aal2`; `vertice_memberships`: `gestor`, `equipe`, `leitor`); reconciliação com as nove rotinas cron registradas em 24/11/2026.
