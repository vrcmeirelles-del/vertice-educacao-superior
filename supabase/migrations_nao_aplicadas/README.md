# Migrações que nunca foram aplicadas em produção

Retiradas de `supabase/migrations/` na reconciliação com o histórico do Supabase (2026-11-21),
para que a CLI (`supabase db push`) não as aplique por engano. Ficam aqui para consulta e decisão.

| Arquivo | Situação verificada em produção |
|---|---|
| `20261105010000_rbac_11_profiles.sql` | **Não aplicada.** Das 10 estruturas que cria, 9 não existem (`vertice_memberships.course_id`, campos de validação em `vertice_repository_files`, `vertice_private.all_roles/can_read_course/can_record/full_access_roles/is_full_access`). É por isso que `vertice_memberships` só aceita gestor/equipe/leitor. A função por curso (coordenação/NDE) é atendida por `20261122170000_course_staff_functions`; aplicar este arquivo mudaria o modelo de papéis de todo o portal e exige decisão própria. |
| `20261111170001_prevalidation_rls_policies.sql` | **Não aplicada como está.** As tabelas da pré-validação têm políticas equivalentes com outros nomes (`il_*`, `pv_*`, `ic_read`, `io_read`, `mal_read`, `svc_write_*`), criadas por outra via. |
| `20261119223000_student_support_rls_hardening.sql` | **Superada.** Suas políticas (`sip_*`, `spa_*`, `ssc_*`, `ssr_*`) não existem; `20261120120000_support_special_rls_hardening` recriou as políticas dessas tabelas (`*_select/_insert/_update/_delete`). |

Antes de aplicar qualquer uma, compare com o estado atual do banco.
