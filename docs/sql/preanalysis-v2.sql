-- LOCAL CANDIDATE ONLY. Never applied remotely; this file does not authorize deployment.
-- Activation: inspect live source schema/storage policies; generate migration using official CLI;
-- review/test in staging, deploy disabled, then authorize an exact provider/model and bounded quota.
-- queue_enabled is independent and defaults false. Events do not invoke providers.
-- No dependency on unapplied course-RBAC migrations. Only Superior gestor/master + MFA.
begin;
-- Verified existing dependency, intentionally not recreated or granted here. Run as its
-- postgres owner so private SECURITY DEFINER callers can use it without expanding access.
do $$ begin
 if not exists(select 1 from pg_catalog.pg_proc p where p.oid=to_regprocedure('vertice_private.ai_live_session(uuid,uuid)')
  and p.prorettype='boolean'::regtype and p.prosecdef and p.provolatile='s'
  and p.proowner=(select oid from pg_catalog.pg_roles where rolname=current_user) and current_user='postgres') then
  raise exception 'required_private_live_session_dependency_missing_or_incompatible';
 end if;
end; $$;
create table vertice_private.preanalysis_policy (
 institution_id uuid primary key references public.vertice_institutions(id),
 enabled boolean not null default false, queue_enabled boolean not null default false,
 provider text not null, model text not null, daily_limit integer not null default 0 check(daily_limit between 0 and 1000)
);
create table vertice_private.preanalysis_daily_usage (
 institution_id uuid not null, day date not null, used integer not null check(used>=0), primary key(institution_id,day)
);
create table vertice_private.preanalysis_actor_usage (
 institution_id uuid not null, actor uuid not null, day date not null, used integer not null check(used>=0), primary key(institution_id,actor,day)
);
create table public.vertice_evidence_preanalysis_runs (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.vertice_institutions(id),
 course_id uuid references public.vertice_courses(id), actor uuid not null,
 source_table text not null check(source_table in ('vertice_documents','vertice_repository_files','vertice_goals','vertice_goal_measurements','vertice_actions','vertice_diagnosis_items','vertice_enrollment_snapshots')),
 source_id uuid not null, source_version text not null, request_hash text not null, catalog_hash text not null,
 provider text not null, model text not null, state text not null check(state in ('processing','completed','failed')),
 result jsonb, error_code text, created_at timestamptz not null default now(), finished_at timestamptz,
 unique(institution_id,source_table,source_id,source_version,request_hash,catalog_hash,provider,model)
);
-- Do not expose session identifiers through the manager-readable run history.
create table vertice_private.preanalysis_run_authorizations (
 run_id uuid primary key references public.vertice_evidence_preanalysis_runs(id),
 actor_session_id uuid not null, actor_jwt_expires_at timestamptz not null
);
create table public.vertice_evidence_preanalysis_decisions (
 audit_sequence bigint generated always as identity unique,
 id uuid primary key default gen_random_uuid(), run_id uuid not null references public.vertice_evidence_preanalysis_runs(id),
 institution_id uuid not null, course_id uuid, object_key text,
 decision text not null check(decision in ('accepted','rejected')), reason text not null,
 actor uuid not null, created_at timestamptz not null default now(),
 validation_status text not null default 'pending' check(validation_status='pending'),
 check(object_key is not null or decision='rejected')
);
-- Decisions are append-only; accepted records are logical source references via run_id,
-- NEVER copied documents, regulatory validation, or changes to existing instrument evidence.
create table vertice_private.preanalysis_events (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null, source_table text not null,
 source_id uuid not null, source_version text not null, status text not null default 'pending' check(status='pending'),
 created_at timestamptz not null default now(), unique(source_table,source_id,source_version,status)
);
create function vertice_private.preanalysis_allowed(p_institution uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare claims jsonb; person uuid; session uuid;
begin
 claims:=auth.jwt(); person:=auth.uid();
 if person is null or coalesce(claims->>'aal','')<>'aal2'
  or coalesce(claims->>'exp','')!~'^[0-9]{1,12}$'
  or coalesce(claims->>'session_id','')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return false; end if;
 if to_timestamp((claims->>'exp')::double precision)<=clock_timestamp() then return false; end if;
 session:=(claims->>'session_id')::uuid;
 return coalesce(vertice_private.ai_live_session(person,session),false)
  and coalesce(vertice_private.is_master() or vertice_private.member_role(p_institution)='gestor',false)
  and exists(select 1 from public.vertice_institutions where id=p_institution and tier='superior');
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then return false;
end; $$;
create function vertice_private.preanalysis_source_core(p_institution uuid,p_source_table text,p_source_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s jsonb; r jsonb; o jsonb; c uuid; b text; path text; snapshot jsonb; version text; parent jsonb; parent_versions jsonb:='[]'::jsonb; parent_key text; parent_table text;
begin
 if p_source_table not in ('vertice_documents','vertice_repository_files','vertice_goals','vertice_goal_measurements','vertice_actions','vertice_diagnosis_items','vertice_enrollment_snapshots') or p_source_table is null then raise exception 'unsupported_source' using errcode='22023'; end if;
 execute format('select to_jsonb(s) from public.%I s where id=$1 and institution_id=$2',p_source_table) into s using p_source_id,p_institution;
 if s is null then raise exception 'source_not_found' using errcode='42501'; end if;
 if coalesce(s->>'segment','superior') in ('escolas','escola') then raise exception 'unsupported_segment'; end if;
 if s->>'status' in ('archived','superseded','arquivado','substituido','cancelada') or s->>'archived_at' is not null or s->>'superseded_by' is not null or coalesce(s->>'is_current','true')='false' then raise exception 'inactive_source'; end if;
 c:=nullif(s->>'course_id','')::uuid;
 -- Child sources inherit or exactly match the parent scope, never merely its institution.
 if p_source_table in ('vertice_goal_measurements','vertice_actions') then
  foreach parent_key in array array['goal_id','finding_id'] loop
   if s->>parent_key is null then continue; end if;
   parent_table:=case parent_key when 'goal_id' then 'vertice_goals' else 'vertice_diagnosis_items' end;
   execute format('select to_jsonb(x) from public.%I x where id=$1 and institution_id=$2',parent_table)
    into parent using (s->>parent_key)::uuid,p_institution;
   if parent is null then raise exception 'invalid_parent' using errcode='42501'; end if;
   if parent->>'status' in ('cancelada','archived','superseded') then raise exception 'inactive_parent'; end if;
   if p_source_table='vertice_goal_measurements' then c:=nullif(parent->>'course_id','')::uuid;
   elsif c is distinct from nullif(parent->>'course_id','')::uuid then raise exception 'invalid_parent_course' using errcode='42501'; end if;
   parent_versions:=parent_versions||jsonb_build_array(parent-'updated_at');
   if parent_key='goal_id' then r:=parent; end if;
  end loop;
  if p_source_table='vertice_goal_measurements' and r is null then raise exception 'invalid_parent'; end if;
 end if;
 if p_source_table='vertice_repository_files' then
  select to_jsonb(x) into r from public.vertice_repository_requests x where id=(s->>'request_id')::uuid and institution_id=p_institution;
  if r is null or coalesce(r->>'active','false')<>'true' or coalesce(r->>'not_applicable','false')='true' then raise exception 'inactive_request'; end if;
  c:=nullif(r->>'course_id','')::uuid;
  b:=case r->>'repository_section' when 'recredenciamento_2017' then 'vertice-recredenciamento-2017' when 'novo_instrumento_2026_institucional' then 'vertice-novo-instrumento-2026-institucional' when 'novo_instrumento_2026_curso' then 'vertice-novo-instrumento-2026-cursos' else 'vertice-repositorios' end;
  if (r->>'repository_section'='novo_instrumento_2026_institucional' and c is not null) or (r->>'repository_section'='novo_instrumento_2026_curso' and c is null) then raise exception 'invalid_scope'; end if;
  path:=s->>'storage_path';
  if path not like p_institution::text||'/'||(s->>'request_id')||'/'||p_source_id::text||'.%' then raise exception 'invalid_path'; end if;
 elsif p_source_table='vertice_documents' then
  b:='vertice-documents'; path:=s->>'storage_path';
  if split_part(path,'/',1) is distinct from p_institution::text then raise exception 'invalid_path'; end if;
 elsif p_source_table='vertice_goals' then
  snapshot:=jsonb_build_object('evidence_type','declared_target','direction',s->'direction','baseline',s->'baseline','baseline_date',s->'baseline_date','target',s->'target','due_date',s->'due_date','frequency',s->'frequency','status',s->'status','indicator_ref',p_source_id,'denominator',null);
 elsif p_source_table='vertice_goal_measurements' then
  snapshot:=jsonb_build_object('evidence_type','reported_measurement','goal_id',s->'goal_id','indicator_ref',s->'goal_id','measured_on',s->'measured_on','value',s->'value','denominator',null,'direction',r->'direction','baseline',r->'baseline','target',r->'target');
 elsif p_source_table='vertice_actions' then
  snapshot:=jsonb_build_object('evidence_type','declared_progress','goal_id',s->'goal_id','finding_id',s->'finding_id','start_date',s->'start_date','due_date',s->'due_date','status',s->'status','progress',s->'progress','unit','percent','denominator',100);
 elsif p_source_table='vertice_diagnosis_items' then
  -- Self-assessment is deliberately not exposed as a regulatory concept/quality score.
  snapshot:=jsonb_build_object('evidence_type','declared_diagnosis','assessed_on',s->'assessed_on','priority',s->'priority','status',s->'status','indicator_ref',p_source_id,'denominator',null);
 elsif p_source_table='vertice_enrollment_snapshots' then
  -- Only aggregate operational counts. No student/class label, source URL or individual data.
  -- Suppress small cells rather than reveal a one-person cohort through a structured adapter.
  if coalesce((s->>'enrolled')::int,0)<10 or coalesce((s->>'capacity')::int,0)<10 then raise exception 'small_cohort_suppressed'; end if;
  if c is null then raise exception 'invalid_course'; end if;
  snapshot:=jsonb_build_object('evidence_type','reported_aggregate','semester',s->'semester','source_report_at',s->'source_report_at','enrolled',s->'enrolled','capacity',s->'capacity','available',s->'available','reported_total',s->'reported_total','unit','students','denominator',s->'capacity','indicator_ref','enrollment_capacity','aggregation_scope','single_imported_cohort_without_label');
 else raise exception 'unsupported_source';
 end if;
 if snapshot is not null then
  snapshot:=snapshot||jsonb_build_object('source_table',p_source_table,'source_id',p_source_id,'institution_id',p_institution,'course_id',c,'quality_inference_allowed',false,'context_limitations','Free text, persons, URLs and unverified indicator/formula text withheld. Counts and declarations do not establish regulatory quality.');
  if p_source_table in ('vertice_goals','vertice_goal_measurements') then
   snapshot:=snapshot||jsonb_build_object('unit',case when coalesce(r->>'unit',s->>'unit') in ('%','percent','percentual','alunos','students','horas','hours','dias','days','unidades','count') then coalesce(r->>'unit',s->>'unit') else null end,'indicator_definition_available',false);
  end if;
 end if;
 if c is not null and not exists(select 1 from public.vertice_courses where id=c and institution_id=p_institution) then raise exception 'invalid_course' using errcode='42501'; end if;
 if b is not null then
  if path is null or path ~ '(^|/)\.\.(/|$)' then raise exception 'invalid_path'; end if;
  select jsonb_build_object('id',x.id,'bucket_id',x.bucket_id,'name',x.name,
   'version',to_jsonb(x)->'version','updated_at',to_jsonb(x)->'updated_at',
   'metadata',jsonb_build_object('size',x.metadata->'size','mimetype',x.metadata->'mimetype','eTag',x.metadata->'eTag','etag',x.metadata->'etag','version',x.metadata->'version'))
   into o from storage.objects x where bucket_id=b and name=path;
  if o is null then raise exception 'file_not_found'; end if;
 end if;
 version:=encode(sha256(convert_to(jsonb_build_array(s-array['ai_status','ai_summary','ai_findings','ai_compliance_score','ai_analyzed_at','ai_model_version','extracted_text','text_extracted_at','updated_at'],r,o,parent_versions)::text,'UTF8')),'hex');
 return jsonb_build_object('institution_id',p_institution,'course_id',c,'source_table',p_source_table,'source_id',p_source_id,'source_version',version,'kind',case when b is null then 'structured' else 'file' end,'storage_bucket',b,'storage_path',path,'file_name',s->'file_name','mime_type',coalesce(s->'mime_type',o->'metadata'->'mimetype'),'size_bytes',coalesce(s->'size_bytes',s->'file_size',o->'metadata'->'size'),'sha256',s->'sha256','snapshot',snapshot);
end; $$;
create function vertice_private.preanalysis_source(p_institution uuid,p_source_table text,p_source_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$ begin
 if not coalesce(vertice_private.preanalysis_allowed(p_institution),false) then raise exception 'forbidden' using errcode='42501'; end if;
 return vertice_private.preanalysis_source_core(p_institution,p_source_table,p_source_id);
end; $$;
create function vertice_private.preanalysis_policy_get(p_institution uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p jsonb; begin
 if not coalesce(vertice_private.preanalysis_allowed(p_institution),false) then raise exception 'forbidden' using errcode='42501'; end if;
 select jsonb_build_object('enabled',enabled,'provider',provider,'model',model,'daily_limit',daily_limit) into p from vertice_private.preanalysis_policy where institution_id=p_institution;
 return coalesce(p,'{"enabled":false,"daily_limit":0}'::jsonb);
end; $$;
create function vertice_private.preanalysis_reserve(p_institution uuid,p_source_table text,p_source_id uuid,p_source_version text,p_request_hash text,p_catalog_hash text,p_provider text,p_model text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb; p vertice_private.preanalysis_policy%rowtype; r public.vertice_evidence_preanalysis_runs%rowtype; n integer;
begin
 s:=vertice_private.preanalysis_source(p_institution,p_source_table,p_source_id);
 if s->>'source_version' is distinct from p_source_version then raise exception 'stale_source' using errcode='40001'; end if;
 if p_request_hash is null or p_catalog_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' or p_catalog_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_hash'; end if;
 -- One per-institution lock serializes policy changes, deduplication and quota reservation.
 select * into p from vertice_private.preanalysis_policy where institution_id=p_institution for update;
 if not found or not p.enabled or p.provider is distinct from p_provider or p.model is distinct from p_model then raise exception 'provider_disabled' using errcode='55000'; end if;
 -- A policy lock may have waited: recheck the live actor immediately before reuse/reservation.
 if not coalesce(vertice_private.preanalysis_allowed(p_institution),false) then raise exception 'forbidden' using errcode='42501'; end if;
 select * into r from public.vertice_evidence_preanalysis_runs where institution_id=p_institution and source_table=p_source_table and source_id=p_source_id and source_version=p_source_version and request_hash=p_request_hash and catalog_hash=p_catalog_hash and provider=p_provider and model=p_model;
 if found then return jsonb_build_object('run_id',r.id,'state',r.state,'result',r.result,'created',false); end if;
 insert into vertice_private.preanalysis_daily_usage values(p_institution,(now() at time zone 'UTC')::date,1)
 on conflict(institution_id,day) do update set used=vertice_private.preanalysis_daily_usage.used+1 where vertice_private.preanalysis_daily_usage.used<p.daily_limit returning used into n;
 if n is null or p.daily_limit<1 then raise exception 'daily_quota_exceeded' using errcode='53300'; end if;
 insert into vertice_private.preanalysis_actor_usage values(p_institution,auth.uid(),(now() at time zone 'UTC')::date,1)
 on conflict(institution_id,actor,day) do update set used=vertice_private.preanalysis_actor_usage.used+1 where vertice_private.preanalysis_actor_usage.used<p.daily_limit returning used into n;
 if n is null then raise exception 'actor_daily_quota_exceeded' using errcode='53300'; end if;
 insert into public.vertice_evidence_preanalysis_runs(institution_id,course_id,actor,source_table,source_id,source_version,request_hash,catalog_hash,provider,model,state)
 values(p_institution,(s->>'course_id')::uuid,auth.uid(),p_source_table,p_source_id,p_source_version,p_request_hash,p_catalog_hash,p_provider,p_model,'processing') returning * into r;
 insert into vertice_private.preanalysis_run_authorizations(run_id,actor_session_id,actor_jwt_expires_at)
 values(r.id,(auth.jwt()->>'session_id')::uuid,to_timestamp((auth.jwt()->>'exp')::double precision));
 return jsonb_build_object('run_id',r.id,'state',r.state,'created',true);
end; $$;
create function vertice_private.preanalysis_finalize(p_run_id uuid,p_expected_actor uuid,p_request_hash text,p_result jsonb,p_error_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.vertice_evidence_preanalysis_runs%rowtype; a vertice_private.preanalysis_run_authorizations%rowtype; current_source jsonb; invalid_code text;
begin
 -- EXECUTE is granted only to service_role, never authenticated/anon.
 select * into r from public.vertice_evidence_preanalysis_runs where id=p_run_id for update;
 if not found or r.actor is distinct from p_expected_actor or r.request_hash is distinct from p_request_hash or r.state<>'processing' then raise exception 'invalid_finalization' using errcode='42501'; end if;
 -- Service-role JWT claims cannot substitute for the originating user's saved session.
 begin
  select * into a from vertice_private.preanalysis_run_authorizations where run_id=r.id;
  if not found then invalid_code:='actor_session_missing';
  elsif a.actor_jwt_expires_at<=clock_timestamp() then invalid_code:='actor_session_expired';
  elsif not coalesce(vertice_private.ai_live_session(r.actor,a.actor_session_id),false) then invalid_code:='actor_session_revoked'; end if;
 exception when others then invalid_code:='actor_session_unavailable'; end;
 if not exists(select 1 from public.vertice_institutions where id=r.institution_id and tier='superior') or not (exists(select 1 from public.vertice_admins where user_id=r.actor) or exists(select 1 from public.vertice_memberships where user_id=r.actor and institution_id=r.institution_id and role='gestor')) then invalid_code:=coalesce(invalid_code,'actor_revoked'); end if;
 begin
  current_source:=vertice_private.preanalysis_source_core(r.institution_id,r.source_table,r.source_id);
  if current_source->>'source_version' is distinct from r.source_version then invalid_code:=coalesce(invalid_code,'stale_source'); end if;
 exception when others then invalid_code:=coalesce(invalid_code,'source_unavailable'); end;
 if invalid_code is not null then
  update public.vertice_evidence_preanalysis_runs set state='failed',error_code=invalid_code,result=null,finished_at=now() where id=r.id;
  return jsonb_build_object('run_id',r.id,'state','failed','error_code',invalid_code);
 end if;
 if (p_result is null)=(p_error_code is null) then raise exception 'invalid_result'; end if;
 if p_result is not null and (jsonb_typeof(p_result->'links') is distinct from 'array' or length(p_result::text)>1000000) then raise exception 'invalid_result'; end if;
 if p_result is not null then
  if jsonb_typeof(p_result) is distinct from 'object'
   or jsonb_typeof(p_result->'summary') is distinct from 'string'
   or coalesce(p_result->>'correlation','') not in ('potential','none','insufficient')
   or jsonb_typeof(p_result->'gaps') is distinct from 'array'
   or jsonb_typeof(p_result->'limitations') is distinct from 'array'
   or jsonb_typeof(p_result->'disclaimer') is distinct from 'string'
   or jsonb_array_length(p_result->'links')>100
   or exists(select 1 from jsonb_object_keys(p_result) k where k not in ('summary','correlation','links','gaps','limitations','disclaimer','provenance'))
   or exists(select 1 from jsonb_array_elements(p_result->'links') x where jsonb_typeof(x) is distinct from 'object' or length(coalesce(x->>'objectKey','')) not between 1 and 500)
   or (select count(*)<>count(distinct x->>'objectKey') from jsonb_array_elements(p_result->'links') x)
   then raise exception 'invalid_result'; end if;
 end if;
 if p_error_code is not null and p_error_code !~ '^[a-z_]{1,80}$' then raise exception 'invalid_error_code'; end if;
 update public.vertice_evidence_preanalysis_runs set result=p_result,error_code=p_error_code,state=case when p_result is null then 'failed' else 'completed' end,finished_at=now() where id=p_run_id returning * into r;
 return jsonb_build_object('run_id',r.id,'state',r.state);
end; $$;
create function vertice_private.preanalysis_review(p_run_id uuid,p_object_key text,p_decision text,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.vertice_evidence_preanalysis_runs%rowtype; s jsonb; d public.vertice_evidence_preanalysis_decisions%rowtype;
begin
 select * into r from public.vertice_evidence_preanalysis_runs where id=p_run_id for update;
 if not found or not coalesce(vertice_private.preanalysis_allowed(r.institution_id),false) then raise exception 'forbidden' using errcode='42501'; end if;
 s:=vertice_private.preanalysis_source(r.institution_id,r.source_table,r.source_id);
 if s->>'source_version' is distinct from r.source_version or (s->>'course_id')::uuid is distinct from r.course_id then raise exception 'stale_source' using errcode='40001'; end if;
 if r.state<>'completed' or p_decision is null or p_decision not in ('accepted','rejected') or length(trim(coalesce(p_reason,''))) not between 1 and 2000 then raise exception 'invalid_review'; end if;
 if p_object_key is null then
  if p_decision<>'rejected' then raise exception 'invalid_review'; end if;
 elsif not exists(select 1 from jsonb_array_elements(r.result->'links') x where x->>'objectKey'=p_object_key) then raise exception 'unknown_object'; end if;
 select * into d from public.vertice_evidence_preanalysis_decisions where run_id=r.id and object_key is not distinct from p_object_key order by audit_sequence desc limit 1;
 if found and d.actor=auth.uid() and d.decision=p_decision and d.reason=trim(p_reason) then return to_jsonb(d); end if;
 -- Destination is fixed to the authorized source institution/course. There is no cross-course input.
 insert into public.vertice_evidence_preanalysis_decisions(run_id,institution_id,course_id,object_key,decision,reason,actor)
 values(r.id,r.institution_id,r.course_id,p_object_key,p_decision,trim(p_reason),auth.uid()) returning * into d;
 return to_jsonb(d);
end; $$;
create function vertice_private.preanalysis_enqueue() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from vertice_private.preanalysis_policy p join public.vertice_institutions i on i.id=p.institution_id where p.institution_id=new.institution_id and p.queue_enabled and i.tier='superior') then
 insert into vertice_private.preanalysis_events(institution_id,source_table,source_id,source_version)
 values(new.institution_id,tg_table_name,new.id,encode(sha256(convert_to((to_jsonb(new)-array['ai_status','ai_summary','ai_findings','ai_compliance_score','ai_analyzed_at','ai_model_version','extracted_text','text_extracted_at','updated_at','approved_by','approved_at','reviewed_by','reviewed_at'])::text,'UTF8')),'hex')) on conflict do nothing;
 end if;
 return new;
end; $$;
-- Optional adapters do not prevent installation when their source module is absent.
do $$ declare t text; begin
 foreach t in array array['vertice_documents','vertice_repository_files','vertice_goals','vertice_goal_measurements','vertice_actions','vertice_diagnosis_items','vertice_enrollment_snapshots'] loop
  if to_regclass('public.'||t) is not null then
   execute format('create trigger preanalysis_source_event after insert or update on public.%I for each row execute function vertice_private.preanalysis_enqueue()',t);
  end if;
 end loop;
end $$;
-- Queue fingerprint is an event identity, not an authorization/source descriptor. A future worker
-- must obtain a fresh user-authorized descriptor. No automatic retries or provider worker shipped.
create function public.vertice_preanalysis_source(p_institution uuid,p_source_table text,p_source_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select vertice_private.preanalysis_source(p_institution,p_source_table,p_source_id); $$;
revoke all on function public.vertice_preanalysis_source(uuid,text,uuid),vertice_private.preanalysis_source(uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.vertice_preanalysis_source(uuid,text,uuid),vertice_private.preanalysis_source(uuid,text,uuid) to authenticated;
create function public.vertice_preanalysis_policy(p_institution uuid) returns jsonb
language sql security invoker set search_path='' as $$ select vertice_private.preanalysis_policy_get(p_institution); $$;
revoke all on function public.vertice_preanalysis_policy(uuid),vertice_private.preanalysis_policy_get(uuid) from public,anon,authenticated,service_role;
grant execute on function public.vertice_preanalysis_policy(uuid),vertice_private.preanalysis_policy_get(uuid) to authenticated;
create function public.vertice_preanalysis_reserve(p_institution uuid,p_source_table text,p_source_id uuid,p_source_version text,p_request_hash text,p_catalog_hash text,p_provider text,p_model text) returns jsonb
language sql security invoker set search_path='' as $$ select vertice_private.preanalysis_reserve(p_institution,p_source_table,p_source_id,p_source_version,p_request_hash,p_catalog_hash,p_provider,p_model); $$;
revoke all on function public.vertice_preanalysis_reserve(uuid,text,uuid,text,text,text,text,text),vertice_private.preanalysis_reserve(uuid,text,uuid,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.vertice_preanalysis_reserve(uuid,text,uuid,text,text,text,text,text),vertice_private.preanalysis_reserve(uuid,text,uuid,text,text,text,text,text) to authenticated;
create function public.vertice_preanalysis_finalize(p_run_id uuid,p_expected_actor uuid,p_request_hash text,p_result jsonb,p_error_code text) returns jsonb
language sql security invoker set search_path='' as $$ select vertice_private.preanalysis_finalize(p_run_id,p_expected_actor,p_request_hash,p_result,p_error_code); $$;
revoke all on function public.vertice_preanalysis_finalize(uuid,uuid,text,jsonb,text),vertice_private.preanalysis_finalize(uuid,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.vertice_preanalysis_finalize(uuid,uuid,text,jsonb,text),vertice_private.preanalysis_finalize(uuid,uuid,text,jsonb,text) to service_role;
create function public.vertice_preanalysis_review(p_run_id uuid,p_object_key text,p_decision text,p_reason text) returns jsonb
language sql security invoker set search_path='' as $$ select vertice_private.preanalysis_review(p_run_id,p_object_key,p_decision,p_reason); $$;
revoke all on function public.vertice_preanalysis_review(uuid,text,text,text),vertice_private.preanalysis_review(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.vertice_preanalysis_review(uuid,text,text,text),vertice_private.preanalysis_review(uuid,text,text,text) to authenticated;
grant usage on schema vertice_private to service_role;
revoke all on function vertice_private.preanalysis_source_core(uuid,text,uuid) from public,anon,authenticated,service_role;
revoke all on function vertice_private.preanalysis_enqueue() from public,anon,authenticated,service_role;
revoke all on function vertice_private.preanalysis_allowed(uuid) from public,anon,authenticated,service_role;
grant execute on function vertice_private.preanalysis_allowed(uuid) to authenticated;
alter table vertice_private.preanalysis_policy enable row level security;
revoke all on vertice_private.preanalysis_policy from public,anon,authenticated,service_role;
alter table vertice_private.preanalysis_run_authorizations enable row level security;
revoke all on vertice_private.preanalysis_run_authorizations from public,anon,authenticated,service_role;
alter table vertice_private.preanalysis_actor_usage enable row level security;
revoke all on vertice_private.preanalysis_actor_usage from public,anon,authenticated,service_role;
alter table vertice_private.preanalysis_daily_usage enable row level security;
revoke all on vertice_private.preanalysis_daily_usage from public,anon,authenticated,service_role;
alter table vertice_private.preanalysis_events enable row level security;
revoke all on vertice_private.preanalysis_events from public,anon,authenticated,service_role;
alter table public.vertice_evidence_preanalysis_runs enable row level security;
revoke all on public.vertice_evidence_preanalysis_runs from public,anon,authenticated,service_role;
alter table public.vertice_evidence_preanalysis_decisions enable row level security;
revoke all on public.vertice_evidence_preanalysis_decisions from public,anon,authenticated,service_role;
grant select on public.vertice_evidence_preanalysis_runs to authenticated;
create policy manager_read on public.vertice_evidence_preanalysis_runs for select to authenticated using(vertice_private.preanalysis_allowed(institution_id));
grant select on public.vertice_evidence_preanalysis_decisions to authenticated;
create policy manager_read on public.vertice_evidence_preanalysis_decisions for select to authenticated using(vertice_private.preanalysis_allowed(institution_id));
commit;
