-- Additive foundation. No legacy MySQL or demonstration data are imported.
begin;
create schema if not exists vertice_private;
revoke all on schema vertice_private from public;
grant usage on schema vertice_private to authenticated;
create table if not exists public.vertice_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table if not exists public.vertice_institutions (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(name) between 1 and 250),
 created_at timestamptz not null default now()
);
create table if not exists public.vertice_memberships (
 user_id uuid not null references auth.users(id) on delete cascade,
 institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
 role text not null check (role in ('gestor','equipe','leitor')),
 created_at timestamptz not null default now(),
 primary key(user_id,institution_id)
);
create index if not exists vertice_memberships_institution_idx on public.vertice_memberships(institution_id);
create table if not exists public.vertice_courses (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
 name text not null check (length(name) between 1 and 250),
 code text,
 created_at timestamptz not null default now()
);
create index if not exists vertice_courses_institution_idx on public.vertice_courses(institution_id);
create table if not exists public.vertice_audit (
 id bigint generated always as identity primary key,
 actor uuid, table_name text not null, action text not null,
 record_id text, occurred_at timestamptz not null default now()
);
create or replace function vertice_private.is_master() returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce((select auth.jwt()->>'aal') = 'aal2',false)
 and exists(select 1 from public.vertice_admins where user_id = (select auth.uid()));
$$;
create or replace function vertice_private.can_read_institution(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce((select auth.jwt()->>'aal') = 'aal2',false) and
 (vertice_private.is_master() or exists(select 1 from public.vertice_memberships where user_id=(select auth.uid()) and institution_id=target));
$$;
revoke all on function vertice_private.is_master() from public, anon;
revoke all on function vertice_private.can_read_institution(uuid) from public, anon;
grant execute on function vertice_private.is_master(), vertice_private.can_read_institution(uuid) to authenticated;
alter table public.vertice_admins enable row level security;
alter table public.vertice_institutions enable row level security;
alter table public.vertice_memberships enable row level security;
alter table public.vertice_courses enable row level security;
alter table public.vertice_audit enable row level security;
revoke all on public.vertice_admins,public.vertice_institutions,public.vertice_memberships,public.vertice_courses,public.vertice_audit from anon,authenticated;
grant select on public.vertice_admins,public.vertice_institutions,public.vertice_memberships,public.vertice_courses,public.vertice_audit to authenticated;
-- Membership and master assignments can only be made via the administrative DB connection.
create policy vertice_admin_self on public.vertice_admins for select to authenticated using(user_id=(select auth.uid()));
create policy vertice_institution_read on public.vertice_institutions for select to authenticated using(vertice_private.can_read_institution(id));
create policy vertice_course_read on public.vertice_courses for select to authenticated using(vertice_private.can_read_institution(institution_id));
create policy vertice_membership_read on public.vertice_memberships for select to authenticated using((select auth.jwt()->>'aal')='aal2' and (user_id=(select auth.uid()) or vertice_private.is_master()));
create policy vertice_audit_read on public.vertice_audit for select to authenticated using(vertice_private.is_master());
create or replace function vertice_private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.vertice_audit(actor,table_name,action,record_id)
 values(auth.uid(),tg_table_name,tg_op,coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'user_id',to_jsonb(old)->>'id',to_jsonb(old)->>'user_id'));
 return coalesce(new,old);
end; $$;
revoke all on function vertice_private.audit_change() from public,anon,authenticated;
create trigger vertice_audit_institutions after insert or update or delete on public.vertice_institutions for each row execute function vertice_private.audit_change();
create trigger vertice_audit_memberships after insert or update or delete on public.vertice_memberships for each row execute function vertice_private.audit_change();
create trigger vertice_audit_courses after insert or update or delete on public.vertice_courses for each row execute function vertice_private.audit_change();
create trigger vertice_audit_admins after insert or update or delete on public.vertice_admins for each row execute function vertice_private.audit_change();
commit;
