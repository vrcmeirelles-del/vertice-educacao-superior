-- Colunas copiadas de information_schema de produção em 24/11/2026 (somente as usadas pelas funções)
create schema auth; create function auth.uid() returns uuid language sql as $$ select '00000000-0000-4000-8000-000000000001'::text::uuid $$;
create table vertice_memberships(user_id uuid, institution_id uuid, role text);
create table governance_bodies(id uuid primary key, course_id uuid, name text, acronym text, body_type text);
create table governance_meetings(id uuid primary key, scheduled_date date, meeting_type text, meeting_number int);
create table governance_deliberations(id uuid primary key, institution_id uuid, body_id uuid, meeting_id uuid, subject text, due_date date, status text, action_id uuid, goal_id uuid, created_at timestamptz default now());
create table governance_workflow_events(id serial, deliberation_id uuid, institution_id uuid, event_type text, from_actor uuid, from_sector text, to_actor uuid, to_sector text, status_before text, status_after text, event_note text, occurred_at timestamptz default now());
create table governance_evidence(deliberation_id uuid);
create table vertice_goals(id uuid primary key default gen_random_uuid(), institution_id uuid, course_id uuid, title text, indicator text, target numeric, direction text, unit text, baseline numeric, due_date date, frequency text, owner_name text, owner_user_id uuid, status text, created_by uuid);
create table vertice_actions(id uuid primary key default gen_random_uuid(), institution_id uuid, course_id uuid, goal_id uuid, what text, why text, where_at text, who text, how text, how_much text, start_date date, due_date date, status text, progress int, responsible_user_id uuid, created_by uuid, deliberation_id uuid);
create table vertice_action_governance(action_id uuid primary key, institution_id uuid, review_status text not null default 'rascunho' check (review_status in ('rascunho','enviado','aprovado','devolvido')));
insert into vertice_memberships values ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-0000000000a1','leitor');
insert into governance_bodies values ('00000000-0000-4000-8000-0000000000b1',null,'Colegiado','COL','colegiado');
insert into governance_deliberations(id,institution_id,body_id,subject,due_date,status) values ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000b1','Revisar PPC','2026-12-31','registrada');
