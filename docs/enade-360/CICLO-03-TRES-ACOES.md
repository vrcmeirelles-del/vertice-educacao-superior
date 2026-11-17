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
