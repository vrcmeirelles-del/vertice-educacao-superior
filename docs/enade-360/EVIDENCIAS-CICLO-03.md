# Evidências do Ciclo 03 — vínculos reais e RLS descartável
Data 2026-11-17. Produção: consultas de metadados/agregados somente leitura.

## Ação 1 — Conciliação em fonte real
Supabase Vértice: `vertice_eorbit_enade` possui 289 linhas, 241 com curso_id bigint, 48 sem; entre as que têm ID existem 62 pares distintos IES/curso. `vertice_enade_course_config`: zero linhas. 196 linhas em `vertice_courses`; dez em `vertice_enade360_records`; `vertice_learning_staff_scope` zero concessões; `vertice_impacto_roles` zero concessões ativas com papel coordenador_curso/nde na consulta realizada. Não houve conciliação automática; P-MAP-001 exige validação dos 62 pares.

## Ação 2 — Arquivos
- `validator/test-rls-postgres-disposable.sql`: fixtures fictícias, roles diferentes, policy SELECT RLS, assertivas de escopo e rollback.
- Workflow: `disposable-postgres-rls` com `postgres:17` efêmero no GitHub Actions, sem conexão com Supabase Vértice.

## Ação 3 — Evidência CI
GitHub Actions run **44048407509**, commit **7a3672384565bd078b30e137e06248d7a5582b96**, concluído com success em `contract-tests` e `disposable-postgres-rls`.
- JS/Python: **266/266** testes sintéticos aprovados.
- PostgreSQL RLS: cenários de Master/Reitoria/Coordenação/NDE/CPA, ausência de concessão e MFA sintético; verificação de concessão sem escrita e ROLLBACK; retorno `PASS: disposable PostgreSQL RLS cases and transaction rollback`.
- URL: https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44048407509

## O que NÃO foi comprovado
Não se replicou o schema real do Supabase no banco descartável. Não se testou RLS efetivo `enade360_read`, `auth.uid()`, JWT de usuário, MFA real, segregação real por curso, API de produção ou migração. O teste demonstra uma política modelo em PostgreSQL real, não homologação dos controles Vértice existentes.

## Pendências
P-MAP-001: validar manualmente/por evidência os 62 pares distintos.
P-RLS-REAL-001: clonar schema/sem dados pessoais, reproduzir funções/policies RLS efetivas em banco isolado e executar papéis com sessão de teste.
P-ACCESS-001, P-TRACE-001, P-API-001, P-CROSS-001, P-ZIP-001, P-NT-001, P-REF-001, P-TOL-001 preservadas.
**Núcleo genérico NÃO HOMOLOGADO; produção intocada.**
