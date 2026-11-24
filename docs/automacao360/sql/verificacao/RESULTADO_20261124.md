# Verificação do DDL candidato (Bloco 08) em PostgreSQL descartável

- Data: 24/11/2026. Servidor: PostgreSQL 16.15, instância local temporária, sem dados reais, desligada ao final.
- Ordem: `00_stubs.sql` (papéis `anon`, `authenticated`, `service_role` com BYPASSRLS; `vertice_institutions` e `vertice_courses` na forma de `supabase/migrations/202610260001_access_foundation.sql`), depois `../001_candidate.sql`, depois `10_checks.sql`.
- O DDL candidato aplicou sem erro. Reaplicá-lo falha (`schema already exists`): não é idempotente, o que é aceitável para migração única.

| # | Caso | Resultado |
|---|---|---|
| 1 | configuração com aprovador distinto | aceita |
| 2 | autoaprovação | recusada (23514) |
| 3 | aprovador sem data | recusada (23514) |
| 4 | revisão duplicada no escopo institucional (`course_id` NULL) | recusada (23505), `NULLS NOT DISTINCT` funciona |
| 5 | revisão zero | recusada (23514) |
| 6 | **IES A com curso da IES B** | **aceita — falha de integridade** |
| 7 | digest fora do formato; status `live`; prioridade `P9` | recusados (23514) |
| 8 | mesmo `run_id` com digest diferente | recusado (23505) |
| 9 | alerta duplicado na mesma execução | recusado (23505) |
| 10 | auditoria sem evidência | recusada (23514) |
| 11 | **UPDATE em `audit_event` pelo proprietário** | **aceito — trilha não é imutável no banco** |
| 12 | `authenticated`, `anon` e `service_role` lendo ou gravando | recusados (42501), inclusive `service_role` com BYPASSRLS |
| 13 | **execução sombra ligada a configuração não aprovada e desativada** | **aceita — depende do RPC** |

Correções sugeridas antes de virar migração (não aplicadas):
- Caso 6 (**premissa corrigida em 24/11/2026**: produção tem o índice único `vertice_courses_scope_key` em `(id, institution_id)`, migração `20261106234208`; a correção adotada é FK composta na migração `20261124210000`. Texto original mantido abaixo): `vertice_courses` não tem `UNIQUE (id, institution_id)`; sem isso não há FK composta. Alternativa sem tocar a tabela central: gatilho `BEFORE INSERT OR UPDATE` que confira `course_id` contra `institution_id`.
- Caso 11: gatilho que recuse `UPDATE` e `DELETE` em `audit_event` (e em `shadow_run`/`shadow_alert`), já que RLS não restringe o proprietário.
- Caso 13: o RPC transacional deve conferir `approved_by IS NOT NULL AND enabled` da revisão vigente; ou gatilho equivalente em `shadow_run`.
