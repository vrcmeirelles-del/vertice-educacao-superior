-- CANDIDATO. Não ativa cron nem modifica dados acadêmicos.
-- Observações técnicas agregadas; nenhuma nota, nome ou identificador de aluno é copiado.
begin;
create table public.vertice_integration_observations(
 id bigint generated always as identity primary key,
 institution_id uuid not null references public.vertice_institutions(id) on delete restrict,
 observed_hour timestamptz not null,
 captured_at timestamptz not null default now(),
 rule_version text not null check(rule_version='integration-monitor-v1'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 unique(institution_id,observed_hour)
);
alter table public.vertice_integration_observations enable row level security;
revoke all on public.vertice_integration_observations from public,anon,authenticated;
create or replace function vertice_private.integration_is_master()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal','')='aal2'
 and exists(select 1 from public.vertice_admins where user_id=auth.uid());
$$;
revoke all on function vertice_private.integration_is_master() from public,anon;
grant execute on function vertice_private.integration_is_master() to authenticated;
create policy integration_observations_master_read on public.vertice_integration_observations
 for select to authenticated using((select vertice_private.integration_is_master()));
grant select on public.vertice_integration_observations to authenticated;
grant select,insert,delete on public.vertice_integration_observations to service_role;
grant usage,select on sequence public.vertice_integration_observations_id_seq to service_role;
create index integration_recent_event_observation on vertice_private.learning_events(institution_id,imported_at desc);

create or replace function vertice_private.integration_count(n bigint)
returns text language sql immutable set search_path='' as $$
 select case when n=0 then '0' when n<5 then '1–4' when n>10000 then '10000+' else n::text end;
$$;
revoke all on function vertice_private.integration_count(bigint) from public,anon,authenticated;

create or replace function vertice_private.integration_snapshot(target uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
 event_n bigint; links_n bigint; groups_n bigint; paired_n bigint; pending_n bigint; overdue_n bigint;
 last_import timestamptz; last_metric timestamptz; last_diagnosis timestamptz; last_briefing timestamptz;
 sync_state text; sync_at timestamptz; modules_json jsonb; flags text[]:='{}';
begin
 if not exists(select 1 from public.vertice_institutions i where i.id=target and i.status='ativa' and i.tier='superior'
  and i.name !~* '(teste|fict[ií]ci|demonstr|sint[eé]tic)'
  and lower(trim(i.name)) not in ('faculdade vértice','centro universitário vértice','universidade vértice')) then
  raise exception 'Instituição fora do escopo operacional' using errcode='22023';
 end if;
 -- Amostra limitada, por data de ingestão; não conta alunos nem soma participantes de grupos.
 with recent as materialized(
  select module,imported_at from vertice_private.learning_events
  where institution_id=target and imported_at>=now()-interval '7 days'
  order by imported_at desc limit 10001
 ) select count(*),max(imported_at) into event_n,last_import from recent;
 select count(*) into links_n from vertice_private.learning_students where institution_id=target and active and verified_at is not null;
 select count(*),count(*) filter(where paired_students>=5 and curricular_average is not null and external_accuracy is not null),max(updated_at)
  into groups_n,paired_n,last_metric from public.vertice_learning_course_metrics where institution_id=target;
 select r.state,coalesce(r.finished_at,r.started_at) into sync_state,sync_at
  from vertice_private.learning_sync_runs r where r.institution_id=target order by r.started_at desc,r.id desc limit 1;
 select max(created_at) into last_diagnosis from public.vertice_sapiens_diagnoses where institution_id=target;
 select max(generated_at) into last_briefing from public.vertice_sapiens_briefings where institution_id=target;
 select count(*) into pending_n from public.vertice_sapiens_interventions where institution_id=target and status='proposed';
 select count(*) into overdue_n from public.vertice_sapiens_goals where institution_id=target and status='active' and due_at<current_date;
 if event_n=0 then flags:=array_append(flags,'no_recent_events');end if;
 if links_n=0 then flags:=array_append(flags,'no_verified_active_links');end if;
 if event_n>0 and groups_n=0 then flags:=array_append(flags,'mapping_or_sample_pending');end if;
 if paired_n=0 then flags:=array_append(flags,'no_comparable_groups');end if;
 if sync_state='failed' then flags:=array_append(flags,'sync_failed');end if;
 if sync_state='running' and sync_at<now()-interval '2 hours' then flags:=array_append(flags,'sync_long_running');end if;
 if last_import<now()-interval '24 hours' or last_metric<now()-interval '24 hours' then flags:=array_append(flags,'source_older_24h');end if;
 if overdue_n>0 then flags:=array_append(flags,'goals_overdue');end if;
 if event_n>10000 then flags:=array_append(flags,'recent_sample_limited');end if;
 with coverage(id,mods) as (values
  ('oab1',array['oab']),('oab2',array[]::text[]),('carreiras',array['delegado','pf','estadual','federal','defensoria','mp']),
  ('cfc',array['cfc']),('enade',array['enade']),('enamed',array['enamed']),('residencia',array['residencia'])
 ), recent as materialized(
  select module from vertice_private.learning_events where institution_id=target and imported_at>=now()-interval '7 days'
  order by imported_at desc limit 10001
 ) select jsonb_agg(jsonb_build_object('id',c.id,
  'source_scope',case when c.id='oab1' then 'oab_generic_phase_unconfirmed' when c.id='oab2' then 'contract_unconfirmed' else 'known_source_module' end,
  'recent_events',vertice_private.integration_count((select count(*) from recent e where e.module=any(c.mods))),
  'metric_groups',vertice_private.integration_count((select count(*) from public.vertice_learning_course_metrics m where m.institution_id=target and m.module=any(c.mods))),
  'comparable_groups',vertice_private.integration_count((select count(*) from public.vertice_learning_course_metrics m where m.institution_id=target and m.module=any(c.mods) and m.paired_students>=5 and m.curricular_average is not null and m.external_accuracy is not null))
 ) order by c.id) into modules_json from coverage c;
 return jsonb_build_object(
  'rule_version','integration-monitor-v1','captured_at',now(),'source','existing_learning_and_sapiens_tables',
  'evidence_level','observed_metadata_only','human_homologation','pending',
  'recent_window_days',7,'recent_sample_limit',10000,'recent_events',vertice_private.integration_count(event_n),
  'verified_active_links',vertice_private.integration_count(links_n),'metric_groups',vertice_private.integration_count(groups_n),
  'comparable_groups',vertice_private.integration_count(paired_n),'last_import_at',date_trunc('hour',last_import),
  'last_metric_at',date_trunc('hour',last_metric),'last_sync_state',sync_state,'last_sync_at',date_trunc('hour',sync_at),
  'last_diagnosis_at',date_trunc('hour',last_diagnosis),'last_briefing_at',date_trunc('hour',last_briefing),
  'pending_approvals',vertice_private.integration_count(pending_n),'overdue_goals',vertice_private.integration_count(overdue_n),
  'modules',coalesce(modules_json,'[]'::jsonb),'flags',to_jsonb(flags)
 );
end;$$;
revoke all on function vertice_private.integration_snapshot(uuid) from public,anon,authenticated;

create or replace function vertice_private.capture_integration_observations()
returns integer language plpgsql security definer set search_path='' as $$
declare inst record; inserted_n integer:=0; step_n integer;
begin
 if not pg_try_advisory_xact_lock(hashtext('vertice-integration-observe-hourly')) then return 0;end if;
 for inst in select id from public.vertice_institutions where status='ativa' and tier='superior'
  and name !~* '(teste|fict[ií]ci|demonstr|sint[eé]tic)'
  and lower(trim(name)) not in ('faculdade vértice','centro universitário vértice','universidade vértice') loop
  insert into public.vertice_integration_observations(institution_id,observed_hour,rule_version,payload)
   values(inst.id,date_trunc('hour',now()),'integration-monitor-v1',vertice_private.integration_snapshot(inst.id))
   on conflict(institution_id,observed_hour) do nothing;
  get diagnostics step_n=row_count;inserted_n:=inserted_n+step_n;
 end loop;
 -- Retenção proposta: apenas observações técnicas; não toca os registros acadêmicos.
 delete from public.vertice_integration_observations where captured_at<now()-interval '90 days';
 return inserted_n;
end;$$;
revoke all on function vertice_private.capture_integration_observations() from public,anon,authenticated;
grant execute on function vertice_private.capture_integration_observations() to service_role;

-- Wrapper de leitura: único acesso às agregações privadas, protegido também dentro da função.
create or replace function public.vertice_integration_monitor_read(p_institution uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare history_json jsonb; enabled_job boolean:=false; schedule_job text; last_run text; live_json jsonb;
begin
 if not vertice_private.integration_is_master() then raise exception 'Master com MFA necessário' using errcode='42501';end if;
 live_json:=vertice_private.integration_snapshot(p_institution);
 select coalesce(jsonb_agg(x.payload order by x.captured_at desc),'[]'::jsonb) into history_json
  from (select payload,captured_at from public.vertice_integration_observations where institution_id=p_institution order by captured_at desc limit 24) x;
 if to_regclass('cron.job') is not null then
  execute 'select coalesce(bool_or(active),false),min(schedule) filter(where active) from cron.job where jobname=$1' into enabled_job,schedule_job using 'vertice-integration-observe-hourly';
 end if;
 if to_regclass('cron.job_run_details') is not null then
  execute 'select r.status from cron.job_run_details r join cron.job j on j.jobid=r.jobid where j.jobname=$1 order by r.start_time desc limit 1' into last_run using 'vertice-integration-observe-hourly';
 end if;
 return jsonb_build_object('live',live_json,'history',history_json,'scheduler_enabled',coalesce(enabled_job,false),'scheduler_schedule',schedule_job,'last_job_status',last_run,'refresh_minutes',5,'retention_days',90);
end;$$;
revoke all on function public.vertice_integration_monitor_read(uuid) from public,anon;
grant execute on function public.vertice_integration_monitor_read(uuid) to authenticated;
commit;
