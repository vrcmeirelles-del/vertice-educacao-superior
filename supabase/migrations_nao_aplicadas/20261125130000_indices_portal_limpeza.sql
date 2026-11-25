-- Portal Vértice — limpeza de índices (CANDIDATA; não aplicar sem autorização expressa).
-- Origem: docs/banco/LEVANTAMENTO_INDICES_20261125.md (leitura de produção em 25/11/2026).
-- Parte A remove só duplicatas exatas; mantém sempre o índice que sustenta restrição ou chave estrangeira,
-- e, entre dois sem restrição, o que tem uso registrado. Nenhum índice de esquema gerenciado (auth) é tocado.
-- Parte B cria índice para as chaves estrangeiras sem cobertura em tabelas com 250+ linhas.
-- Tabelas pequenas (todas abaixo de 1.500 linhas): DROP/CREATE simples, bloqueio de milissegundos.
begin;

-- A. Duplicatas exatas (mesma tabela, colunas, expressão, predicado e classe de operador).
drop index if exists public.idx_eorbit_compl_notas_inst;     -- fica idx_eorbit_comp_notas_inst (27 usos)
drop index if exists public.idx_eorbit_compl_notas_sem;      -- fica idx_eorbit_comp_notas_semestre
drop index if exists public.idx_eorbit_compl_plano_inst;     -- fica idx_eorbit_comp_plano_inst (26 usos)
drop index if exists public.idx_eorbit_compl_plano_sem;      -- fica idx_eorbit_comp_plano_semestre
drop index if exists public.idx_eorbit_diario_inst;          -- fica idx_eorbit_diario_instituicao (27 usos)
drop index if exists public.idx_eorbit_diario_prof;          -- fica idx_eorbit_diario_professor
drop index if exists public.idx_diario_classe_upsert;        -- fica a restrição única ..._semestre_id_curso_id_professor_key
drop index if exists public.idx_quantitativo_upsert;         -- fica a restrição única ..._semestre_id_curso_id_grade_id_i_key
drop index if exists public.idx_eorbit_vest_editais_inst;    -- fica idx_eorbit_vest_edit_inst (2 usos)
drop index if exists public.vertice_courses_institution_id_pair; -- fica vertice_courses_scope_key (sustenta chaves estrangeiras)
drop index if exists public.idx_avalia_questions_assess;     -- coberto pela restrição única (assessment_id, question_number)
drop index if exists public.captacao_connection_ies;         -- coberto pela restrição única (institution_id, id)
drop index if exists public.idx_ext_imports_hash;            -- coberto pela restrição única (institution_id, file_hash)
drop index if exists public.idx_student_identity_pseudo;     -- coberto pela restrição única (institution_id, pseudonym_hash)
drop index if exists vertice_app.enrollments_course_semester_idx; -- coberto pela restrição única (institution_id, course_id, semester)

-- B. Chaves estrangeiras sem índice em tabelas com dados (250+ linhas em 25/11/2026).
create index if not exists vertice_repository_requests_goal_fk_idx on public.vertice_repository_requests(goal_id);
create index if not exists vertice_repository_requests_nsa_by_fk_idx on public.vertice_repository_requests(nsa_by);
create index if not exists dd_workflow_audit_matter_fk_idx on public.dd_workflow_audit(matter_id);
create index if not exists dd_requirement_state_requirement_fk_idx on public.dd_requirement_state(requirement_id);
create index if not exists vertice_goals_course_fk_idx on public.vertice_goals(course_id);
create index if not exists vertice_eorbit_quantitativo_grade_fk_idx on public.vertice_eorbit_quantitativo(grade_id);
create index if not exists vertice_repository_files_classified_by_fk_idx on public.vertice_repository_files(classified_by);
create index if not exists vertice_migration_catalog_tables_catalog_fk_idx on public.vertice_migration_catalog_tables(catalog_id, institution_id);
create index if not exists dd_document_links_matter_fk_idx on public.dd_document_links(matter_id);
create index if not exists dd_document_links_document_fk_idx on public.dd_document_links(document_id);
create index if not exists dd_evidence_checks_matter_fk_idx on public.dd_evidence_checks(matter_id);
create index if not exists vertice_eorbit_enade_curso_fk_idx on public.vertice_eorbit_enade(curso_id);
create index if not exists dd_reviews_matter_fk_idx on public.dd_reviews(matter_id);
create index if not exists vertice_student_registry_course_fk_idx on public.vertice_student_registry(course_id);
commit;
