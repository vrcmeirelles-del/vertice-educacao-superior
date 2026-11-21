-- Stubs das tabelas de Trilhas (mesmas colunas de produção) para 20261122250000.
create table vertice_app.formation_trails(id uuid primary key default gen_random_uuid(),institution_id uuid not null,course_id uuid not null,code text not null,name text not null,
 description text,curriculum_competency_id uuid,keywords text[],created_at timestamptz default now(),updated_at timestamptz default now());
create table vertice_app.trail_question_links(id uuid primary key default gen_random_uuid(),trail_id uuid not null references vertice_app.formation_trails(id) on delete cascade,
 enade_year int,question_number int,question_text text,national_correct_pct numeric,ies_correct_pct numeric,discrepancy numeric,source text,created_at timestamptz default now());
create table vertice_app.trail_analysis_snapshots(id uuid primary key default gen_random_uuid(),institution_id uuid not null,course_id uuid not null,analysis_date date,
 trail_rankings jsonb not null,weakest_disciplines jsonb,summary text,created_by uuid,created_at timestamptz default now());
create view vertice_app.v_trail_diagnostic as SELECT t.institution_id,t.course_id,t.id AS trail_id,t.code,t.name,count(q.id) AS question_count,
 round(avg(q.national_correct_pct),1) AS avg_national_pct,round(avg(q.ies_correct_pct),1) AS avg_ies_pct,round(sum(q.discrepancy),1) AS total_discrepancy,
 round(avg(q.discrepancy),1) AS avg_discrepancy,CASE WHEN avg(q.discrepancy)<-10 THEN 'critico' WHEN avg(q.discrepancy)<-3 THEN 'atencao' WHEN avg(q.discrepancy)<3 THEN 'estavel' ELSE 'forte' END AS status
 FROM vertice_app.formation_trails t LEFT JOIN vertice_app.trail_question_links q ON q.trail_id=t.id GROUP BY t.id,t.institution_id,t.course_id,t.code,t.name;
