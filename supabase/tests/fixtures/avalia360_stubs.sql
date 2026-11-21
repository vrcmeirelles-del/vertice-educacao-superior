create role anon; create role authenticated;
create schema auth; create schema storage; create schema vertice_private; create schema vertice_app;
create extension if not exists pgcrypto;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}') $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table public.vertice_institutions(id uuid primary key,tier text,name text default 'IES de teste');
create table public.vertice_courses(id uuid primary key,institution_id uuid,name text default 'Curso de teste');
create table public.vertice_student_registry(id uuid primary key,institution_id uuid,course_id uuid,enrollment_code text,full_name text,academic_status text,verified boolean,current_semester smallint);
create table public.vertice_audit(actor uuid,table_name text,action text,record_id text);
create table vertice_app.institutions(id uuid primary key,slug text,name text,status text,activated_at timestamptz);
create table vertice_app.courses(id uuid primary key,institution_id uuid references vertice_app.institutions(id),code text,name text);
create table vertice_app.curriculum_builds(id uuid primary key default gen_random_uuid(),institution_id uuid references vertice_app.institutions(id),course_id uuid references vertice_app.courses(id),
 version int not null default 1,status text not null default 'draft' check (status in ('draft','published','archived')),graduate_profile text,dcn_reference text,created_by uuid,
 created_at timestamptz default now(),updated_at timestamptz default now(),graduate_profile_source text,dcn_document_url text);
create table vertice_app.curriculum_competencies(id uuid primary key default gen_random_uuid(),build_id uuid not null references vertice_app.curriculum_builds(id) on delete cascade,code text not null,title text not null,description text,sort_order int default 0);
create table vertice_app.curriculum_discipline_links(id uuid primary key default gen_random_uuid(),competency_id uuid not null references vertice_app.curriculum_competencies(id) on delete cascade,discipline_name text not null,category text not null default 'profissional' check (category in ('profissional','instrumental','basica')),source text default 'manual',sort_order int default 0);
create table public.acl(user_id uuid,inst uuid,course uuid,mode text);
create function vertice_private.teaching_access(inst uuid,course uuid,mode text) returns boolean language sql stable as $$
 select (auth.jwt()->>'aal')='aal2' and exists(select 1 from public.acl a where a.user_id=auth.uid() and a.inst=$1 and a.course=$2 and (a.mode=$3 or (a.mode='validate')))$$;
create function vertice_private.audit_change() returns trigger language plpgsql as $$begin insert into public.vertice_audit values(auth.uid(),tg_table_name,tg_op,to_jsonb(new)->>'id'); return new; end$$;
insert into auth.users values('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222'),('33333333-3333-3333-3333-333333333333');
insert into public.vertice_institutions values('aaaaaaaa-0000-0000-0000-000000000001','superior');
insert into public.vertice_courses values('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001');
insert into public.acl values('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','record'),
 ('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','validate');
insert into public.vertice_student_registry(id,institution_id,course_id,full_name,academic_status,verified,current_semester) values(gen_random_uuid(),'aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','Bruna','active',true,3),
 (gen_random_uuid(),'aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','Ana','active',true,3),
 (gen_random_uuid(),'aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','Caio','inactive',true,3);
create table public.vertice_tcc_works(id uuid primary key,stage text,stage_deadline timestamptz);
create table public.vertice_tcc_participants(work_id uuid,enrollment_id text);
create table public.vertice_internship_placements(student_id uuid,lifecycle text);
create view public.v_ac_student_balance as select null::uuid student_id,0::bigint credited_minutes,0::bigint remaining_minutes,0::int total_required_minutes,0::bigint submissions_total where false;
create function vertice_private.can_read_institution(target uuid) returns boolean language sql stable as $$ select (auth.jwt()->>'aal')='aal2' and exists(select 1 from public.acl a where a.user_id=auth.uid() and a.inst=target) $$;
create view public.v_student_evasion_risk with (security_invoker=true) as
 SELECT sr.id AS student_id, sr.institution_id, sr.course_id, sr.full_name, sr.enrollment_code, sr.academic_status,
    COALESCE(bal.credited_minutes, 0::bigint) AS ac_credited_minutes,
    COALESCE(bal.remaining_minutes, bal.total_required_minutes::bigint, 0::bigint) AS ac_remaining_minutes,
    COALESCE(bal.submissions_total, 0::bigint) AS ac_submissions,
    0::bigint AS tcc_active, 0::bigint AS tcc_overdue, 0::bigint AS estagio_active, 0::bigint AS estagio_completed,
    0::integer AS risk_score, 'low'::text AS risk_level
 FROM vertice_student_registry sr LEFT JOIN v_ac_student_balance bal ON bal.student_id = sr.id;

-- Papéis por IES (espelha vertice_private.member_role: exige AAL2) e vínculo de curso.
create table public.role_stub(user_id uuid,inst uuid,role text);
create table public.vertice_learning_staff_scope(institution_id uuid,course_id uuid,subject_code text,user_id uuid,granted_by uuid,granted_at timestamptz,active boolean);
create function vertice_private.member_role(target uuid) returns text language sql stable as $$
 select case when (auth.jwt()->>'aal') is distinct from 'aal2' then null else (select r.role from public.role_stub r where r.user_id=auth.uid() and r.inst=target) end $$;
insert into vertice_app.institutions(id,slug,name,status) values('aaaaaaaa-0000-0000-0000-000000000001','teste','IES de teste','active');
insert into vertice_app.courses(id,institution_id,code,name) values('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','C1','Curso de teste');
