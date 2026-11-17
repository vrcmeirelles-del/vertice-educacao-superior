-- Isolated PostgreSQL: production migrations/functions, synthetic identities.
-- This is NOT a Supabase Auth session or scientific INEP validation.
create role anon;
create role authenticated;
create schema auth;
create schema vertice_private;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create table public.vertice_admins(user_id uuid);
create table public.vertice_memberships(user_id uuid,institution_id uuid,role text);
create table public.vertice_impacto_roles(user_id uuid,institution_id uuid,course_id uuid,role text,active boolean,expires_at timestamptz);
create table public.vertice_institutions(id uuid primary key);
create table public.vertice_courses(id uuid primary key,institution_id uuid);
grant usage on schema public,auth,vertice_private to authenticated,anon;
grant select on public.vertice_memberships,public.vertice_admins,public.vertice_impacto_roles to authenticated;
\i docs/enade-360/validator/live-auth-helpers.snapshot.sql
\i supabase/migrations/20261107200000_enade360_continuous_quality.sql
insert into public.vertice_institutions values ('10000000-0000-4000-8000-000000000001'),('20000000-0000-4000-8000-000000000001');
insert into public.vertice_courses values
 ('10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001');
insert into auth.users select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,7)n;
insert into public.vertice_admins values ('00000000-0000-4000-8000-000000000001');
insert into public.vertice_memberships values ('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','gestor');
insert into public.vertice_impacto_roles values
 ('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','coordenador_curso',true,null),
 ('00000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','nde',true,null),
 ('00000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001',null,'cpa',true,null),
 ('00000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001',null,'reitor',true,null);
insert into public.vertice_enade360_records(id,institution_id,course_id,kind,title) values
 ('10000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','evidencia','Evidence one'),
 ('10000000-0000-4000-8000-000000000022','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000012','evidencia','Evidence two'),
 ('20000000-0000-4000-8000-000000000021','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000011','evidencia','Other institution');
\i supabase/migrations/20261117084920_enade360_private_audit_history_and_read_gate.sql
\i supabase/migrations/20261117091542_enade360_verifiable_audit_and_scientific_hold.sql
create function public.enade_test_assert(ok boolean,label text) returns void language plpgsql as $$
 begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
select public.enade_test_assert((select count(*)=3 from vertice_enade_audit.record_events),'existing baselines preserved');
update public.vertice_enade360_records set title='Updated evidence' where id='10000000-0000-4000-8000-000000000021';
update public.vertice_enade360_records set notes='Second revision' where id='10000000-0000-4000-8000-000000000021';
select public.enade_test_assert((select count(*)=2 from vertice_enade_audit.record_events where hash_version=2),'two v2 events captured');
select public.enade_test_assert((select bool_and(e.event_sha256=encode(extensions.digest(convert_to(vertice_enade_audit.canonical_event(e),'UTF8'),'sha256'),'hex')) from vertice_enade_audit.record_events e where hash_version=2),'v2 event hashes reproduced from persisted fields');
set timezone='America/Sao_Paulo';
select public.enade_test_assert((select bool_and(e.event_sha256=encode(extensions.digest(convert_to(vertice_enade_audit.canonical_event(e),'UTF8'),'sha256'),'hex')) from vertice_enade_audit.record_events e where hash_version=2),'v2 hashes independent of session timezone');
select public.enade_test_assert((select bool_and(previous_event_sha256 is not distinct from expected) from (select previous_event_sha256,lag(event_sha256) over(partition by record_id order by id) expected from vertice_enade_audit.record_events)t),'chain links match previous events');
select public.enade_test_assert(not has_table_privilege('authenticated','vertice_enade_audit.record_events','SELECT'),'private events cannot be selected directly');
select public.enade_test_assert(not has_function_privilege('anon','public.vertice_enade360_audit_history(uuid)','EXECUTE'),'anonymous RPC execution denied');
set role authenticated;
select set_config('request.jwt.claims','{"aal":"aal2"}',false);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.enade_test_assert((select count(*)=3 from public.vertice_enade360_records),'Master records with MFA');
select public.enade_test_assert((select count(*)=3 from public.vertice_enade360_audit_history('10000000-0000-4000-8000-000000000021')),'Master history');
select set_config('request.jwt.claims','{"aal":"aal1"}',false);
select public.enade_test_assert((select count(*)=0 from public.vertice_enade360_records),'Master records denied without MFA');
select public.enade_test_assert((select count(*)=0 from public.vertice_enade360_audit_history('10000000-0000-4000-8000-000000000021')),'history denied without MFA');
select set_config('request.jwt.claims','{"aal":"aal2"}',false);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
select public.enade_test_assert((select count(*)=2 from public.vertice_enade360_records),'gestor institution isolation');
select public.enade_test_assert((select count(*)=0 from public.vertice_enade360_audit_history('20000000-0000-4000-8000-000000000021')),'other institution history denied');
update public.vertice_enade360_records set notes='Authorized institutional edit' where id='10000000-0000-4000-8000-000000000021';
select public.enade_test_assert((select count(*)=4 from public.vertice_enade360_audit_history('10000000-0000-4000-8000-000000000021')),'authorized edit is audited');
do $$ begin
 begin
  update public.vertice_enade360_records set kind='resultado_oficial',source_kind='oficial',source_ref='https://www.gov.br/inep',validation_status='validado',validated_by=auth.uid(),validated_at=now() where id='10000000-0000-4000-8000-000000000021';
  raise exception 'FAIL: official validation was accepted';
 exception when check_violation then
  if sqlerrm not like 'ENADE360_SCIENTIFIC_HOLD:%' then raise; end if;
 end;
end $$;
select public.enade_test_assert((select count(*)=0 from public.vertice_enade360_records where kind='resultado_oficial' and validation_status='validado'),'scientific hold rejects institutional validation');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
select public.enade_test_assert((select count(*)=4 from public.vertice_enade360_audit_history('10000000-0000-4000-8000-000000000021')),'coordinator assigned-course RPC');
select public.enade_test_assert((select count(*)=0 from public.vertice_enade360_audit_history('10000000-0000-4000-8000-000000000022')),'coordinator other-course denied');
select public.enade_test_assert((select count(*)=0 from public.vertice_enade360_records),'existing coordinator record-list limitation retained');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
select public.enade_test_assert((select count(*)=4 from public.vertice_enade360_audit_history('10000000-0000-4000-8000-000000000021')),'NDE assigned-course RPC');
select public.enade_test_assert((select count(*)=0 from public.vertice_enade360_audit_history('10000000-0000-4000-8000-000000000022')),'NDE other-course denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',false);
select public.enade_test_assert((select count(*)=0 from public.vertice_enade360_audit_history('10000000-0000-4000-8000-000000000021')),'CPA does not gain raw audit access');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',false);
select public.enade_test_assert((select count(*)=4 from public.vertice_enade360_audit_history('10000000-0000-4000-8000-000000000021')),'Reitoria own institution RPC');
select public.enade_test_assert((select count(*)=0 from public.vertice_enade360_audit_history('20000000-0000-4000-8000-000000000021')),'Reitoria other institution denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',false);
select public.enade_test_assert((select count(*)=0 from public.vertice_enade360_audit_history('10000000-0000-4000-8000-000000000021')),'unassigned identity denied');
reset role;
