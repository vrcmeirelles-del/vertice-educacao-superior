# Automação 360° — plano de reversão

Situação em 24/11/2026: as três migrações **foram aplicadas em produção** por autorização expressa e estão em `supabase/migrations/`. O módulo `GEST_AUTOMACAO360` está com `active=false` e nenhuma configuração foi aprovada. A reversão do nível 3 exige nova migração de reversão.

## Níveis, do menos ao mais invasivo

| Nível | Quando | Como | Preserva histórico | Evidência |
|---|---|---|---|---|
| 0. Suspender a regra ou o escopo | alerta indevido, fonte suspeita | nova revisão com `enabled=false` (proposta + aprovação por outra pessoa) em `vertice_automation_propose_config`/`approve_config` | sim: revisões, execuções e eventos são imutáveis | teste `reversão: nova revisão desativada bloqueia execuções e preserva todo o histórico` (`scripts/tests/automacao360-sql/nucleo.test.mjs`): `record_run` passa a ser recusado |
| 1. Ocultar o módulo | interface indevida | suspender ou cancelar a ativação da IES em `public.vertice_module_activations` (`module_code='GEST_AUTOMACAO360'`) pelo fluxo nativo do Master ou, enquanto o catálogo estiver oculto, por `update public.vertice_module_activations set status='suspenso', suspended_at=now() where module_code='GEST_AUTOMACAO360' and institution_id=<IES>`; a aba depende de `get_active_tabs`, que lê as ativações (não `vertice_module_catalog.active`) | sim | aba bloqueada pelo `isLocked` nativo |
| 2. Retirar a interface | defeito de UI | reverter o commit `fc8cf47` e republicar o portal | sim (banco intacto) | build estático e suítes do portal verdes sem a aba |
| 3. Retirar o banco da automação | decisão institucional de desistência | script abaixo, em transação, após exportar `vertice_automation.*` | **não** (exportar antes) | — |
| 4. Desfazer a correção do 5W2H | regressão nas funções `governance_*` | reaplicar `contratos-nativos/5w2h/20261111010933_governance_360_phase3_routing_5w2h.producao.sql` (MD5 `8747e26bef720c5f73b6c46d651cc6f0`) | sim | restaura o estado anterior, que **já era quebrado** (ver README da pasta) |

Nenhum nível apaga ações 5W2H já criadas em `vertice_actions`: são decisões humanas aprovadas e pertencem ao planejamento. O nível 3 só remove o vínculo de origem.

## Script do nível 3 (não executar sem autorização)

```sql
begin;
-- 0. Pré-condição: exportar o schema vertice_automation (dump) e registrar o responsável.
-- 1. Ações já encaminhadas permanecem; a origem passa a 'manual' para caber na restrição original.
update public.vertice_actions set origin_type = 'manual' where origin_type = 'automacao_360';
drop index if exists public.vertice_actions_automacao360_origin;
alter table public.vertice_actions drop constraint vertice_actions_origin_type_check;
alter table public.vertice_actions add constraint vertice_actions_origin_type_check check (origin_type = any (array[
  'nde','colegiado','coordenacao','cpa','bi_academico','egressos','inclusao','acompanhamento_especial','comply','auditoria','demanda_institucional','manual']));
-- 2. RPCs públicas e permissão privada.
drop function if exists public.vertice_automation_propose_config(uuid, uuid, text[], boolean, text, integer, integer, text);
drop function if exists public.vertice_automation_approve_config(bigint, text);
drop function if exists public.vertice_automation_record_run(jsonb);
drop function if exists public.vertice_automation_decide(uuid, text, integer, text, uuid, timestamptz, text);
drop function if exists public.vertice_automation_handoff_5w2h(uuid, uuid, text, text);
drop function if exists public.vertice_automation_dashboard(uuid, uuid);
drop function if exists public.vertice_automation_source_documentary(uuid, uuid);
drop function if exists public.vertice_automation_source_planning(uuid, uuid);
drop function if exists vertice_private.automation_can(uuid, uuid, text);
-- 3. Catálogo e schema próprio.
delete from public.vertice_module_catalog where code = 'GEST_AUTOMACAO360';
drop schema vertice_automation cascade;
commit;
```

Observação: a mudança de `origin_type` para `'manual'` perde a marca de origem; o dump do passo 0 é a prova de rastreabilidade. As linhas de `supabase_migrations.schema_migrations` seguem `supabase/MIGRACOES.md` (nova migração de reversão, nunca edição de histórico).
