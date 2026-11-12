-- Synthetic fixture for a fresh disposable local PostgreSQL cluster only.

create role anon; create role authenticated;
create schema auth; create schema vertice_private;
create table public.vertice_admins(user_id uuid primary key);
create table public.vertice_memberships(user_id uuid,institution_id uuid,role text);
create table public.vertice_courses(id uuid primary key,institution_id uuid);
create table public.vertice_goals(id uuid primary key,institution_id uuid);
create table public.governance_bodies(id uuid primary key,institution_id uuid,course_id uuid,body_type text,status text);
create table public.governance_meetings(id uuid primary key,institution_id uuid,body_id uuid,status text);
create table public.governance_deliberations(id uuid primary key,institution_id uuid,body_id uuid,meeting_id uuid,action_id uuid,goal_id uuid,duplicate_of uuid,subject text,full_text text,protocol text,decision_type text,status text,responsible_name text,responsible_user_id uuid,due_date date,updated_at timestamptz default now());
create table public.vertice_actions(id uuid primary key default gen_random_uuid(),institution_id uuid not null,course_id uuid,goal_id uuid,what text not null check(length(what) between 1 and 500),why text check(length(why)<=2000),who text check(length(who)<=250),due_date date,status text not null check(status in ('nao_iniciada','em_andamento','concluida','bloqueada','cancelada')),progress int check(progress between 0 and 100),origin_type text check(origin_type in ('nde','colegiado','cpa','demanda_institucional')),origin_ref uuid,origin_label text,deliberation_id uuid,responsible_user_id uuid,created_by uuid);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function vertice_private.can_read_institution(target uuid) returns boolean language sql stable security definer as $$select current_setting('test.aal',true)='aal2' and (exists(select 1 from public.vertice_admins where user_id=auth.uid()) or exists(select 1 from public.vertice_memberships where user_id=auth.uid() and institution_id=target))$$;
create function vertice_private.has_role(target uuid,roles text[]) returns boolean language sql stable security definer as $$select exists(select 1 from public.vertice_admins where user_id=auth.uid()) or exists(select 1 from public.vertice_memberships where user_id=auth.uid() and institution_id=target and (role=any(roles) or role='master'))$$;
insert into vertice_memberships values('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','gestor');
insert into governance_bodies values('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001',null,'cpa','ativo');
insert into governance_meetings values('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','realizada');

insert into governance_deliberations(id,institution_id,body_id,meeting_id,subject,full_text,decision_type,status,protocol) values('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005','TESTE FICTÍCIO','Texto fictício','deliberacao_aprovada','registrada','TESTE-1');
