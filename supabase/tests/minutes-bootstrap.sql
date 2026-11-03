-- ONLY in a new disposable local PostgreSQL database. Never run against Supabase.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create table auth.users(id uuid primary key,email text);
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
grant usage on schema auth to authenticated;
grant execute on all functions in schema auth to authenticated;
create schema storage;
create table storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
\ir ../migrations/202610260001_access_foundation.sql
-- Production helper contracts from 202610300001_area_real.sql, also read back
-- from hosted pg_proc on 2026-11-03. No role assignments are changed by feature.
create function vertice_private.member_role(target uuid) returns text language sql stable security definer set search_path='' as $$
 select case when not coalesce((select auth.jwt()->>'aal')='aal2',false) then null when vertice_private.is_master() then 'master' else (select m.role from public.vertice_memberships m where m.user_id=auth.uid() and m.institution_id=target) end;
$$;
create function vertice_private.has_role(target uuid,roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(vertice_private.member_role(target)='master' or vertice_private.member_role(target)=any(roles),false);
$$;
revoke all on function vertice_private.member_role(uuid),vertice_private.has_role(uuid,text[]) from public,anon;
grant execute on function vertice_private.member_role(uuid),vertice_private.has_role(uuid,text[]) to authenticated;
\ir ../migrations/20261101224102_institutional_inep_library.sql
