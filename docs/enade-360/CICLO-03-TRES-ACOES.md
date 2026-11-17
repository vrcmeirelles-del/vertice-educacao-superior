# ENADE 360° — Ciclo 03: conciliação de vínculos, RLS SQL e reversibilidade
Data: 2026-11-17 | Foco: três ações independentes do ZIP | Sem alterações no Supabase de produção.

## Ação 1 — Inventário do banco real em somente leitura
Consultas agregadas e catálogos em `vertice-educacao-superior`, sem leitura de CPF, nomes ou dados pessoais:
- `vertice_eorbit_enade`: 289 linhas, sendo 241 com `curso_id` bigint e 48 sem identificador de curso, abrangendo 1 IES; 62 pares distintos (instituicao_id,curso_id) com identificador.
- `vertice_enade_course_config`: 0 linhas. Consequentemente, as 241 linhas com ID de curso não possuem correspondência por essa tabela; isso NÃO equivale a 241 cursos distintos e NÃO comprova falta de correspondência no cadastro geral.
- `vertice_courses`: 196 linhas, chave UUID; `vertice_enade360_records`: 10 linhas.
- `vertice_learning_staff_scope`: 0 linhas e 0 ativos; `vertice_impacto_roles` com `coordenador_curso` ou `nde` ativos: 0 (contagem agregada, não prova ausência de papéis em outros mecanismos).
- Tabela `vertice_enade_course_config` já prevê `course_id` UUID e `eorbit_curso_id` bigint, mas sem linhas. A conciliação manual/verificada dos 62 pares é P-MAP-001.
Não inferir equivalência por nome; usar checagem de instituição, código, grau e confirmação humana.

## Ação 2 — Prova SQL proposta
Criado `validator/test-rls-postgres-disposable.sql`: banco sintético PostgreSQL 17, tabela de grants controlados, evidências por instituição e curso, política RLS SELECT, papéis de teste Master, Reitoria, Coordenação, NDE, CPA, sem concessão e sem MFA; testes de contagens positivas/negativas, nenhuma escrita de clientes e rollback transacional.
O arquivo é exclusivamente de teste; NÃO é migração Supabase e NÃO deve ser aplicado ao projeto Vértice. Não usa JWT real, `auth.uid()` do Supabase, policies atuais nem dados existentes.
O workflow `.github/workflows/enade360-contracts.yml` foi estendido com job separado `disposable-postgres-rls`, Postgres 17 no serviço temporário do CI. Seu resultado será registrado após confirmação do GitHub Actions.

## Ação 3 — Execução independente da produção
O CI monta um Postgres descartável, executa a fixture e termina sem persistência. Critérios de aceitação: testes RLS positivos e negativos, isolamento por curso e IES, CPA somente agregados, MFA representado por grant de teste, bloqueio de escrita e rollback comprovado. O resultado efetivo só será declarado após checagem do log e status final da execução.

## Limites e próximo ciclo
A segurança demonstrada na fixture é uma validação do **modelo proposto**, não das políticas reais da Vértice. RLS existente continuará somente em leitura até aceitação da matriz de papéis, vinculação de cursos, autorização dos responsáveis e testes reais em ambiente clonado.
Pendências P-MAP-001 (62 pares a mapear com evidência), P-ACCESS-001 (papéis reais), P-TRACE-001 (persistência), P-API-001, P-RLS-REAL-001 (testes na réplica isolada da estrutura real), P-ZIP-001, P-REF-001, P-NT-001, P-TOL-001. Nenhum indicador oficial reproduzido, núcleo científico NÃO HOMOLOGADO.

## Confirmação da Ação 3 — PostgreSQL descartável, CI concluído
GitHub Actions `ENADE 360 - Contract Tests`, run **44048407509**, commit **7a3672384565bd078b30e137e06248d7a5582b96**, `completed/success` nos dois jobs:
- `contract-tests`: suíte JS/Python previamente versionada, **266/266 testes sintéticos**, sem falhas.
- `disposable-postgres-rls`: PostgreSQL 17 temporário. Log `PASS: disposable PostgreSQL RLS cases and transaction rollback`. Foram executados sete cenários de identidades (Master, Reitoria, Coordenação, NDE, CPA, sem permissão e sem MFA na fixture), verificação de ausência de INSERT para Master e rollback de uma gravação temporária.
O teste SQL mede comportamento real de RLS em **fixture isolada**, não uma cópia da política Supabase. O valor da MFA foi representado em concessão controlada de teste, não sessão Supabase `auth.jwt()`; resultado não autoriza implantação. P-RLS-SQL-001 foi atendida **para o modelo sintético**. Abre-se P-RLS-REAL-001 para executar as regras efetivas com sessão autenticada em banco clonado/descartável e comprovar regressões, após preparar ambiente seguro.
