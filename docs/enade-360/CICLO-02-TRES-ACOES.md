# CICLO 02 — Três ações executadas, sem mutação de produção
Data: 2026-11-17 | Supabase: projeto vertice-educacao-superior | Status: consulta de metadados em leitura, proposta sem DDL e testes isolados de contrato.

## Ação 1: confronto do esquema efetivo
Consultadas somente estruturas de catálogo PostgreSQL (`pg_class`, `pg_policies`, `information_schema.columns`, `pg_constraint` e definições das funções selecionadas), sem acessar registros pessoais.
**Comprovado no banco:** `public.vertice_enade360_records`, `vertice_courses`, `vertice_memberships`, `vertice_eorbit_enade`, `vertice_enade_course_config`, `vertice_impacto_roles` e `vertice_learning_staff_scope` existem, com RLS habilitada.
- `vertice_enade360_records` já possui FK composta (course_id,institution_id) para `vertice_courses`.
- Sua policy `enade360_read` usa `can_read_institution(institution_id)` e `has_role(...)`, **sem predicado explícito por curso**.
- `vertice_memberships.role` aceita `gestor/equipe/leitor`; `vertice_impacto_roles.role` admite também `coordenador_curso` e `nde`; `vertice_learning_staff_scope` relaciona user_id, institution_id e course_id, com FK composta.
- `vertice_eorbit_enade.curso_id` é bigint, `vertice_courses.id` é uuid; `vertice_enade_course_config` já prevê ambos, porém a confiabilidade dos vínculos reais não foi testada.
- `can_read_institution` e `member_role` são `SECURITY DEFINER`; a última verifica MFA aal2, mas o resultado de autorização sob sessões reais não foi homologado.

## Ação 2: correspondência de papéis e proposta de migração
A matriz de negócios Master/Reitoria/Coordenação/NDE/CPA NÃO pode ser mapeada automaticamente a `vertice_memberships` ou `vertice_impacto_roles`. **Decisão: mapear permissões de negócio em relação a um catálogo confiável de grants por IES/curso, com validade, MFA, cargo e escopo.** Consultar as tabelas de vínculos existentes antes de adicionar outra.
- Master: instituições explicitamente autorizadas.
- Reitoria: própria IES.
- Coordenação/NDE: curso explicitamente concedido.
- CPA: somente agregados autorizados, sem liberação automática de dados pessoais.
- RLS do ENADE deverá exigir curso quando o ator não tiver perfil institucional autorizado, sem quebrar rotinas existentes até testes de regressão.
- Criar arquitetura aditiva em schema privado quando autorizada e após documentação de rollback. Nenhuma migração executável criada ou aplicada neste ciclo.

## Ação 3: testes de contrato isolados
Implementados `validator/rls-policy-contract.cjs` e `validator/test-rls-policy-contract.cjs` (24 cenários sintéticos). Testam MFA, concessão institucional, vínculo por curso, negações cruzadas e CPA agregado. Inclusão no workflow `.github/workflows/enade360-contracts.yml`.
**Limite importante:** os 24 cenários testam funções JS com dados sintéticos; NÃO invocam PostgreSQL, RLS, auth.uid, JWT reais, tampouco executam migração em banco descartável. A etapa literal de ensaios SQL de RLS em ambiente isolado fica P-RLS-SQL-001 pendente, em vez de ser declarada realizada.

## Pendências e próximos portões
- P-SCHEMA-REAL-001: catálogo alvo do ENADE conferido; falta inspeção completa de dependências e alterações recentes.
- P-ACCESS-001: papéis de negócio e escopos de curso reais ainda não homologados.
- P-RLS-SQL-001: teste efetivo de RLS em PostgreSQL descartável com usuários simulados e rollback.
- P-TRACE-001, P-API-001 e P-CROSS-001 continuam abertas/parciais.
- P-ZIP-001, P-NT-001, P-REF-001, P-TOL-001 preservadas.
- Sem alterações em produção. Núcleo genérico NÃO HOMOLOGADO. Especialização bloqueada.
