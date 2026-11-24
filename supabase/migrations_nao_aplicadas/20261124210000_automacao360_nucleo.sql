-- Vértice Automação 360° — núcleo de persistência, governança e adaptadores de leitura.
-- CANDIDATA. NÃO APLICAR EM PRODUÇÃO SEM AUTORIZAÇÃO EXPRESSA. Testada em PGlite (PostgreSQL 17)
-- por scripts/tests/automacao360-sql. Ver docs/automacao360/HOMOLOGACAO.md.
--
-- Decisões (registradas na Bíblia-Mestra, seção "Integração ao repositório"):
-- * Reutiliza o RBAC nativo: vertice_private.member_role (exige MFA aal2), course_function
--   (coordenador/NDE por curso) e a lista de papéis da política vertice_actions_insert.
--   Não cria papéis nem permissões paralelas.
-- * Não reutiliza vertice_app.alerts: é específica do motor de Permanência (record_id obrigatório
--   para retention_records, papel vertice_api). pei_alerts é do Plano Educacional Individualizado.
--   Nenhuma tabela existente comporta configuração por regra, execução sombra e fila genérica.
-- * Corrige as três falhas do DDL candidato do Bloco 08: FK composta curso/IES; auditoria e
--   execuções imutáveis por gatilho; execução só com a revisão vigente aprovada e ativada.
-- * Tudo nasce desativado e em modo sombra. Nenhum cron é criado.
begin;

create schema if not exists vertice_automation;
revoke all on schema vertice_automation from public, anon, authenticated;

-- 1. Catálogo versionado (espelho de supabase/functions/_shared/automacao360/catalog.mjs).
create table vertice_automation.rules(
  id text primary key check (id ~ '^[a-z0-9]+\.[a-z0-9]+$'),
  version text not null,
  module text not null,
  priority text not null check (priority in ('P0','P1','P2')),
  cadence text not null check (cadence in ('daily','weekly','monthly')),
  family text check (family in ('documentary','pedagogical','academic','strategic','planning','cpa','schools')),
  source_status text not null default 'pendente' check (source_status in ('validada','identificada','pendente'))
);

-- 2. Configuração por IES (course_id nulo) ou por curso; revisões imutáveis.
create table vertice_automation.config_revision(
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.vertice_institutions(id) on delete restrict,
  course_id uuid,
  revision integer not null check (revision > 0),
  enabled boolean not null default false,
  mode text not null default 'shadow' check (mode in ('shadow','operational')),
  rule_ids text[] not null default '{}',
  max_age_hours integer not null default 24 check (max_age_hours between 1 and 720),
  configured_by uuid not null,
  configured_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  foreign key (course_id, institution_id) references public.vertice_courses(id, institution_id) on delete restrict,
  check ((approved_by is null and approved_at is null) or (approved_by is not null and approved_at is not null and approved_by <> configured_by and approved_at >= configured_at)),
  unique nulls not distinct (institution_id, course_id, revision)
);

-- 3. Execuções (sombra ou operacionais) e alertas observados por execução.
create table vertice_automation.run(
  run_id uuid primary key,
  config_id bigint not null references vertice_automation.config_revision(id) on delete restrict,
  institution_id uuid not null,
  course_id uuid,
  mode text not null check (mode in ('shadow','operational')),
  as_of timestamptz not null,
  status text not null check (status in ('evaluated','partial')),
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  source_count integer not null check (source_count >= 0),
  unmapped_count integer not null check (unmapped_count >= 0),
  alert_count integer not null check (alert_count >= 0 and alert_count <= 10000),
  duration_ms integer check (duration_ms >= 0),
  recorded_at timestamptz not null default now()
);
create table vertice_automation.run_alert(
  run_id uuid not null references vertice_automation.run(run_id) on delete restrict,
  alert_key text not null check (alert_key ~ '^[a-f0-9]{64}$'),
  rule_id text not null references vertice_automation.rules(id),
  rule_version text not null,
  priority text not null check (priority in ('P0','P1','P2')),
  primary key (run_id, alert_key)
);

-- 4. Fila operacional (só recebe alertas de execuções em modo operational aprovado).
create table vertice_automation.alert(
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  course_id uuid,
  rule_id text not null references vertice_automation.rules(id),
  rule_version text not null,
  priority text not null check (priority in ('P0','P1','P2')),
  idempotency_key text not null check (idempotency_key ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected','in_progress','completed','verified','closed_admin')),
  revision integer not null default 0,
  owner_id uuid,
  due_at timestamptz,
  completed_by uuid,
  evidence jsonb not null default '{}'::jsonb,
  source_run uuid not null references vertice_automation.run(run_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (course_id, institution_id) references public.vertice_courses(id, institution_id) on delete restrict,
  unique nulls not distinct (institution_id, course_id, idempotency_key)
);

-- 5. Trilha append-only de decisões.
create table vertice_automation.event(
  id bigint generated always as identity primary key,
  institution_id uuid not null,
  course_id uuid,
  entity text not null check (entity in ('config','alert','handoff')),
  entity_ref text not null,
  action text not null,
  from_status text,
  to_status text,
  actor_id uuid,
  reason text check (reason is null or length(reason) between 5 and 2000),
  evidence_ref text check (evidence_ref is null or length(evidence_ref) between 1 and 300),
  at timestamptz not null default now()
);

alter table vertice_automation.rules enable row level security;
alter table vertice_automation.config_revision enable row level security;
alter table vertice_automation.run enable row level security;
alter table vertice_automation.run_alert enable row level security;
alter table vertice_automation.alert enable row level security;
alter table vertice_automation.event enable row level security;
revoke all on all tables in schema vertice_automation from public, anon, authenticated, service_role;
revoke all on all sequences in schema vertice_automation from public, anon, authenticated, service_role;

-- Imutabilidade: RLS não restringe o proprietário; os gatilhos sim.
create function vertice_automation.forbid_change() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'registro imutável: %', tg_table_name using errcode = '42501'; end $$;
create trigger event_immutable before update or delete on vertice_automation.event for each row execute function vertice_automation.forbid_change();
create trigger run_immutable before update or delete on vertice_automation.run for each row execute function vertice_automation.forbid_change();
create trigger run_alert_immutable before update or delete on vertice_automation.run_alert for each row execute function vertice_automation.forbid_change();
create trigger config_no_delete before delete on vertice_automation.config_revision for each row execute function vertice_automation.forbid_change();
create trigger alert_no_delete before delete on vertice_automation.alert for each row execute function vertice_automation.forbid_change();

-- Revisão aprovada não pode ser reescrita; só a aprovação de uma revisão pendente é aceita.
create function vertice_automation.config_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from unnest(new.rule_ids) r where r not in (select id from vertice_automation.rules)) then
    raise exception 'regra desconhecida' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then
    if old.approved_by is not null then raise exception 'revisão aprovada é imutável' using errcode = '42501'; end if;
    if (new.institution_id, new.course_id, new.revision, new.enabled, new.mode, new.rule_ids, new.max_age_hours, new.configured_by, new.configured_at)
       is distinct from (old.institution_id, old.course_id, old.revision, old.enabled, old.mode, old.rule_ids, old.max_age_hours, old.configured_by, old.configured_at) then
      raise exception 'somente a aprovação pode alterar uma revisão pendente' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger config_guard before insert or update on vertice_automation.config_revision for each row execute function vertice_automation.config_guard();

-- Revisão vigente de um escopo = a maior revisão aprovada.
create function vertice_automation.current_config(inst uuid, course uuid) returns vertice_automation.config_revision
language sql stable set search_path = '' as $$
  select c.* from vertice_automation.config_revision c
  where c.institution_id = inst and c.course_id is not distinct from course and c.approved_by is not null
  order by c.revision desc limit 1
$$;

-- Execução só com a revisão vigente, aprovada, ativada e do mesmo escopo e modo.
create function vertice_automation.run_guard() returns trigger language plpgsql set search_path = '' as $$
declare c vertice_automation.config_revision;
begin
  select * into c from vertice_automation.config_revision where id = new.config_id;
  if c.id is null or c.approved_by is null or not c.enabled then
    raise exception 'configuração não aprovada ou desativada' using errcode = '42501';
  end if;
  if c.institution_id <> new.institution_id or c.course_id is distinct from new.course_id or c.mode <> new.mode then
    raise exception 'escopo ou modo divergente da configuração' using errcode = '42501';
  end if;
  if c.id <> (vertice_automation.current_config(c.institution_id, c.course_id)).id then
    raise exception 'configuração não é a revisão vigente' using errcode = '40001';
  end if;
  return new;
end $$;
create trigger run_guard before insert on vertice_automation.run for each row execute function vertice_automation.run_guard();

-- Autorização derivada do RBAC nativo. member_role já exige aal2 (MFA).
create function vertice_private.automation_can(inst uuid, course uuid, op text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select auth.uid()) is not null
    and vertice_private.member_role(inst) is not null
    and (course is null or exists (select 1 from public.vertice_courses c where c.id = course and c.institution_id = inst))
    and case op
      when 'read' then course is null or vertice_private.member_role(inst) <> 'leitor' or vertice_private.course_function(inst, course) is not null
      when 'configure' then vertice_private.member_role(inst) in ('master','gestor')
           or (course is not null and vertice_private.course_function(inst, course) = 'coordenador')
      when 'approve' then vertice_private.member_role(inst) in ('master','gestor','reitor','diretor_geral')
      when 'review' then vertice_private.member_role(inst) in ('master','gestor','reitor','diretor_geral','diretor_pedagogico')
           or (course is not null and vertice_private.course_function(inst, course) = 'coordenador')
      when 'execute' then vertice_private.member_role(inst) in ('master','gestor','equipe','reitor','diretor_geral','diretor_pedagogico','procurador')
           or (course is not null and vertice_private.course_function(inst, course) = 'coordenador')
      when 'verify' then vertice_private.member_role(inst) in ('master','gestor','reitor','diretor_geral')
      when 'handoff' then vertice_private.member_role(inst) in ('master','gestor','equipe','reitor','diretor_geral','diretor_pedagogico','procurador')
      else false end, false)
$$;
revoke all on function vertice_private.automation_can(uuid, uuid, text) from public, anon, authenticated;

create function vertice_automation.log(inst uuid, course uuid, ent text, ref text, act text, st_from text, st_to text, why text, ev text)
returns void language sql set search_path = '' as $$
  insert into vertice_automation.event(institution_id, course_id, entity, entity_ref, action, from_status, to_status, actor_id, reason, evidence_ref)
  values (inst, course, ent, ref, act, st_from, st_to, (select auth.uid()), why, ev)
$$;

-- RPC: propõe nova revisão (sempre não aprovada). CAS pela revisão esperada.
create function public.vertice_automation_propose_config(
  p_institution uuid, p_course uuid, p_rule_ids text[], p_enabled boolean, p_mode text,
  p_max_age_hours integer, p_expected_revision integer, p_reason text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_current integer; v_id bigint;
begin
  if not vertice_private.automation_can(p_institution, p_course, 'configure') then
    raise exception 'acesso negado ou MFA pendente' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('automation_config:' || p_institution || ':' || coalesce(p_course::text, '-'), 0));
  select coalesce(max(revision), 0) into v_current from vertice_automation.config_revision
   where institution_id = p_institution and course_id is not distinct from p_course;
  if v_current <> coalesce(p_expected_revision, -1) then
    raise exception 'revisão concorrente: esperada %, atual %', p_expected_revision, v_current using errcode = '40001';
  end if;
  if array_length(p_rule_ids, 1) is not null and (select count(distinct x) from unnest(p_rule_ids) x) <> array_length(p_rule_ids, 1) then
    raise exception 'regra repetida' using errcode = '22023';
  end if;
  insert into vertice_automation.config_revision(institution_id, course_id, revision, enabled, mode, rule_ids, max_age_hours, configured_by)
  values (p_institution, p_course, v_current + 1, coalesce(p_enabled, false), coalesce(p_mode, 'shadow'), coalesce(p_rule_ids, '{}'), coalesce(p_max_age_hours, 24), auth.uid())
  returning id into v_id;
  perform vertice_automation.log(p_institution, p_course, 'config', v_id::text, 'propose', null, 'pending', p_reason, null);
  return v_id;
end $$;

-- RPC: aprova revisão pendente; pessoa distinta de quem configurou; só a última revisão.
create function public.vertice_automation_approve_config(p_config_id bigint, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare c vertice_automation.config_revision;
begin
  select * into c from vertice_automation.config_revision where id = p_config_id for update;
  if c.id is null or not vertice_private.automation_can(c.institution_id, c.course_id, 'approve') then
    raise exception 'acesso negado ou MFA pendente' using errcode = '42501';
  end if;
  if c.configured_by = auth.uid() then raise exception 'autoaprovação proibida' using errcode = '42501'; end if;
  if c.approved_by is not null then raise exception 'revisão já aprovada' using errcode = '22023'; end if;
  if c.revision <> (select max(revision) from vertice_automation.config_revision where institution_id = c.institution_id and course_id is not distinct from c.course_id) then
    raise exception 'revisão superada' using errcode = '40001';
  end if;
  update vertice_automation.config_revision set approved_by = auth.uid(), approved_at = now() where id = c.id;
  perform vertice_automation.log(c.institution_id, c.course_id, 'config', c.id::text, 'approve', 'pending', case when c.enabled then c.mode else 'disabled' end, p_reason, null);
end $$;

-- RPC do executor (somente service_role, chamado no servidor). Idempotente por run_id+digest.
create function public.vertice_automation_record_run(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb; v_run uuid := (p_payload->>'runId')::uuid; v_existing text; c vertice_automation.config_revision;
begin
  select digest into v_existing from vertice_automation.run where run_id = v_run;
  if v_existing is not null then
    if v_existing = p_payload->>'digest' then return jsonb_build_object('runId', v_run, 'digest', v_existing, 'status', 'existing'); end if;
    raise exception 'run_id existente com digest diferente' using errcode = '23505';
  end if;
  c := vertice_automation.current_config((p_payload->>'institutionId')::uuid, nullif(p_payload->>'courseId', '')::uuid);
  if c.id is null or c.revision <> (p_payload->>'configRevision')::integer then
    raise exception 'configuração vigente divergente' using errcode = '40001';
  end if;
  insert into vertice_automation.run(run_id, config_id, institution_id, course_id, mode, as_of, status, digest, source_count, unmapped_count, alert_count, duration_ms)
  values (v_run, c.id, c.institution_id, c.course_id, c.mode, (p_payload->>'asOf')::timestamptz, p_payload->>'status', p_payload->>'digest',
          (p_payload->>'sourceCount')::integer, (p_payload->>'unmappedCount')::integer, jsonb_array_length(coalesce(p_payload->'alerts', '[]')),
          nullif(p_payload->>'durationMs', '')::integer);
  for r in select * from jsonb_array_elements(coalesce(p_payload->'alerts', '[]')) loop
    if not ((r->>'rule') = any(c.rule_ids)) then raise exception 'regra fora da configuração' using errcode = '22023'; end if;
    if not exists (select 1 from vertice_automation.rules x where x.id = r->>'rule' and x.version = r->>'version' and x.priority = r->>'priority') then
      raise exception 'versão ou prioridade divergente do catálogo' using errcode = '22023';
    end if;
    insert into vertice_automation.run_alert(run_id, alert_key, rule_id, rule_version, priority) values (v_run, r->>'key', r->>'rule', r->>'version', r->>'priority');
    -- Sombra nunca vira fila operacional.
    if c.mode = 'operational' then
      insert into vertice_automation.alert(institution_id, course_id, rule_id, rule_version, priority, idempotency_key, source_run)
      values (c.institution_id, c.course_id, r->>'rule', r->>'version', r->>'priority', r->>'key', v_run)
      on conflict (institution_id, course_id, idempotency_key) do nothing;
    end if;
  end loop;
  return jsonb_build_object('runId', v_run, 'digest', p_payload->>'digest', 'status', 'inserted');
end $$;

-- RPC: transição de alerta com CAS de revisão e trilha append-only.
create function public.vertice_automation_decide(
  p_alert uuid, p_action text, p_expected_revision integer, p_reason text,
  p_owner uuid default null, p_due_at timestamptz default null, p_evidence_ref text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare a vertice_automation.alert; v_to text; v_op text; v_from_ok text[];
begin
  select * into a from vertice_automation.alert where id = p_alert for update;
  if a.id is null then raise exception 'alerta inexistente' using errcode = '42501'; end if;
  case p_action
    when 'approve' then v_to := 'approved'; v_op := 'review'; v_from_ok := array['pending_review'];
    when 'reject' then v_to := 'rejected'; v_op := 'review'; v_from_ok := array['pending_review'];
    when 'start' then v_to := 'in_progress'; v_op := 'execute'; v_from_ok := array['approved'];
    when 'complete' then v_to := 'completed'; v_op := 'execute'; v_from_ok := array['in_progress'];
    when 'verify' then v_to := 'verified'; v_op := 'verify'; v_from_ok := array['completed'];
    when 'close' then v_to := 'closed_admin'; v_op := 'review'; v_from_ok := array['pending_review','approved','in_progress'];
    else raise exception 'ação inválida' using errcode = '22023';
  end case;
  if not vertice_private.automation_can(a.institution_id, a.course_id, v_op) then raise exception 'acesso negado ou MFA pendente' using errcode = '42501'; end if;
  if a.revision <> p_expected_revision then raise exception 'revisão concorrente' using errcode = '40001'; end if;
  if not (a.status = any(v_from_ok)) then raise exception 'transição inválida de %', a.status using errcode = '22023'; end if;
  if p_reason is null or length(btrim(p_reason)) < 5 then raise exception 'justificativa obrigatória' using errcode = '22023'; end if;
  if p_action = 'approve' and (p_owner is null or p_due_at is null or p_due_at <= now()) then raise exception 'responsável e prazo futuro obrigatórios' using errcode = '22023'; end if;
  if p_action = 'approve' and not exists (select 1 from public.vertice_memberships m where m.user_id = p_owner and m.institution_id = a.institution_id) then
    raise exception 'responsável sem vínculo com a IES' using errcode = '22023';
  end if;
  if p_action in ('complete','verify') and p_evidence_ref is null then raise exception 'evidência obrigatória' using errcode = '22023'; end if;
  if p_action = 'verify' and a.completed_by = auth.uid() then raise exception 'verificação independente obrigatória' using errcode = '42501'; end if;
  update vertice_automation.alert set status = v_to, revision = revision + 1, updated_at = now(),
    owner_id = case when p_action = 'approve' then p_owner else owner_id end,
    due_at = case when p_action = 'approve' then p_due_at else due_at end,
    completed_by = case when p_action = 'complete' then auth.uid() else completed_by end
  where id = a.id;
  perform vertice_automation.log(a.institution_id, a.course_id, 'alert', a.id::text, p_action, a.status, v_to, p_reason, p_evidence_ref);
  return a.revision + 1;
end $$;

-- Origem própria da automação em vertice_actions (rastreável e sem duplicidade).
alter table public.vertice_actions drop constraint vertice_actions_origin_type_check;
alter table public.vertice_actions add constraint vertice_actions_origin_type_check check (origin_type = any (array[
  'nde','colegiado','coordenacao','cpa','bi_academico','egressos','inclusao','acompanhamento_especial','comply','auditoria','demanda_institucional','manual','automacao_360']));
create unique index vertice_actions_automacao360_origin on public.vertice_actions(origin_ref) where origin_type = 'automacao_360';

-- RPC: alerta aprovado -> rascunho de ação 5W2H. Não usa governance_route_to_action (quebrada).
-- Como e quanto ficam nulos; revisão começa em 'rascunho'. Idempotente pela origem.
create function public.vertice_automation_handoff_5w2h(p_alert uuid, p_goal uuid, p_what text, p_why text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a vertice_automation.alert; v_action uuid;
begin
  select * into a from vertice_automation.alert where id = p_alert;
  if a.id is null or not vertice_private.automation_can(a.institution_id, a.course_id, 'handoff') then raise exception 'acesso negado ou MFA pendente' using errcode = '42501'; end if;
  if a.status <> 'approved' then raise exception 'somente alerta aprovado' using errcode = '22023'; end if;
  if p_goal is not null and not exists (select 1 from public.vertice_goals g where g.id = p_goal and g.institution_id = a.institution_id and g.status = 'ativa') then
    raise exception 'meta ativa da mesma IES obrigatória' using errcode = '22023';
  end if;
  select id into v_action from public.vertice_actions where origin_type = 'automacao_360' and origin_ref = a.id;
  if v_action is not null then return v_action; end if;
  insert into public.vertice_actions(institution_id, course_id, goal_id, what, why, who, how, how_much, due_date, status, progress, responsible_user_id, created_by, origin_type, origin_ref, origin_label)
  values (a.institution_id, a.course_id, p_goal, left(coalesce(nullif(btrim(p_what), ''), 'Revisar ocorrência ' || a.rule_id), 500),
          left(coalesce(nullif(btrim(p_why), ''), 'Proposta da Automação 360° (' || a.rule_id || ' ' || a.rule_version || '), aprovada por revisão humana.'), 2000),
          null, null, null, a.due_at::date, 'nao_iniciada', 0, a.owner_id, auth.uid(), 'automacao_360', a.id, a.rule_id || ' ' || a.rule_version)
  returning id into v_action;
  insert into public.vertice_action_governance(action_id, institution_id, review_status) values (v_action, a.institution_id, 'rascunho') on conflict (action_id) do nothing;
  perform vertice_automation.log(a.institution_id, a.course_id, 'handoff', a.id::text, '5w2h_draft', 'approved', 'approved', 'Rascunho 5W2H criado: ' || v_action, null);
  return v_action;
end $$;

-- RPC de leitura para os painéis: nunca transforma ausência em zero.
create function public.vertice_automation_dashboard(p_institution uuid, p_course uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c vertice_automation.config_revision; v_last vertice_automation.run;
begin
  if not vertice_private.automation_can(p_institution, p_course, 'read') then raise exception 'acesso negado ou MFA pendente' using errcode = '42501'; end if;
  c := vertice_automation.current_config(p_institution, p_course);
  select * into v_last from vertice_automation.run where institution_id = p_institution and course_id is not distinct from p_course order by recorded_at desc limit 1;
  return jsonb_build_object(
    'institutionId', p_institution, 'courseId', p_course, 'readOnly', false,
    'config', case when c.id is null then null else jsonb_build_object('revision', c.revision, 'enabled', c.enabled, 'mode', c.mode, 'ruleIds', to_jsonb(c.rule_ids), 'approvedAt', c.approved_at) end,
    'pendingConfig', (select jsonb_build_object('id', p.id, 'revision', p.revision) from vertice_automation.config_revision p
                      where p.institution_id = p_institution and p.course_id is not distinct from p_course and p.approved_by is null
                        and p.revision > coalesce(c.revision, 0) order by p.revision desc limit 1),
    'rules', (select jsonb_agg(jsonb_build_object('id', r.id, 'version', r.version, 'module', r.module, 'priority', r.priority, 'cadence', r.cadence,
                'sourceStatus', r.source_status,
                'state', case when c.id is null or not (r.id = any(c.rule_ids)) then 'inactive' when not c.enabled then 'inactive'
                              when r.source_status <> 'validada' then 'blocked' when c.mode = 'shadow' then 'shadow' else 'active' end) order by r.module, r.id)
              from vertice_automation.rules r),
    'lastRun', case when v_last.run_id is null then null else jsonb_build_object('at', v_last.recorded_at, 'asOf', v_last.as_of, 'status', v_last.status, 'mode', v_last.mode, 'alerts', v_last.alert_count, 'durationMs', v_last.duration_ms) end,
    'pending', case when c.mode = 'operational' and c.enabled then (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'ruleId', a.rule_id, 'priority', a.priority, 'status', a.status, 'revision', a.revision) order by a.priority, a.created_at), '[]'::jsonb)
                    from vertice_automation.alert a where a.institution_id = p_institution and a.course_id is not distinct from p_course and a.status in ('pending_review','approved','in_progress')) else null end,
    'events', (select coalesce(jsonb_agg(jsonb_build_object('at', e.at, 'entity', e.entity, 'action', e.action, 'to', e.to_status) order by e.id desc), '[]'::jsonb)
               from (select * from vertice_automation.event where institution_id = p_institution and course_id is not distinct from p_course order by id desc limit 20) e)
  );
end $$;

-- Adaptador de leitura do Repositório (família documental). Só metadados, sem nomes nem arquivos.
-- Status: algum arquivo 'validado' -> validated; algum 'enviado' -> submitted; nenhum -> open.
-- not_applicable e inativos ficam de fora. Revisão muda com prazo, status ou arquivos.
create function public.vertice_automation_source_documentary(p_institution uuid, p_course uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_rows jsonb; v_count integer;
begin
  if not (auth.role() = 'service_role' or vertice_private.automation_can(p_institution, p_course, 'read')) then
    raise exception 'acesso negado ou MFA pendente' using errcode = '42501';
  end if;
  select count(*), coalesce(jsonb_agg(x order by x->>'id'), '[]'::jsonb) into v_count, v_rows from (
    select jsonb_build_object(
      'institutionId', q.institution_id, 'courseId', q.course_id, 'id', q.id::text,
      'revision', left(md5(concat_ws('|', q.due_date, st.status, st.files, q.updated_at)), 32),
      'status', st.status, 'dueDate', to_char(q.due_date, 'YYYY-MM-DD')) x
    from public.vertice_repository_requests q
    cross join lateral (
      select case when bool_or(f.status = 'validado') then 'validated' when bool_or(f.status = 'enviado') then 'submitted' else 'open' end as status,
             count(f.id) as files
      from public.vertice_repository_files f where f.request_id = q.id and f.institution_id = q.institution_id) st
    where q.institution_id = p_institution and q.course_id is not distinct from p_course and q.active and not coalesce(q.not_applicable, false)
  ) s;
  if v_count > 2500 then raise exception 'volume acima do lote: paginar antes de habilitar' using errcode = '54000'; end if;
  return jsonb_build_object('institutionId', p_institution, 'courseId', p_course, 'id', 'repository', 'observedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'complete', true, 'requests', v_rows);
end $$;

revoke all on function public.vertice_automation_propose_config(uuid, uuid, text[], boolean, text, integer, integer, text) from public, anon;
revoke all on function public.vertice_automation_approve_config(bigint, text) from public, anon;
revoke all on function public.vertice_automation_decide(uuid, text, integer, text, uuid, timestamptz, text) from public, anon;
revoke all on function public.vertice_automation_handoff_5w2h(uuid, uuid, text, text) from public, anon;
revoke all on function public.vertice_automation_dashboard(uuid, uuid) from public, anon;
revoke all on function public.vertice_automation_record_run(jsonb) from public, anon, authenticated;
revoke all on function public.vertice_automation_source_documentary(uuid, uuid) from public, anon, authenticated;
grant execute on function public.vertice_automation_propose_config(uuid, uuid, text[], boolean, text, integer, integer, text) to authenticated;
grant execute on function public.vertice_automation_approve_config(bigint, text) to authenticated;
grant execute on function public.vertice_automation_decide(uuid, text, integer, text, uuid, timestamptz, text) to authenticated;
grant execute on function public.vertice_automation_handoff_5w2h(uuid, uuid, text, text) to authenticated;
grant execute on function public.vertice_automation_dashboard(uuid, uuid) to authenticated;
grant execute on function public.vertice_automation_record_run(jsonb) to service_role;
grant execute on function public.vertice_automation_source_documentary(uuid, uuid) to service_role;

commit;
