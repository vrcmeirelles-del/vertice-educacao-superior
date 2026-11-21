-- Avalia 360° — bloco 5: prontidão ENADE/OAB e sinal de risco acadêmico (sem IA).
-- 1. Evidência por competência ganha o escopo do CURSO (todas as aplicações encerradas).
-- 2. Matriz do exame (vertice_avalia_exam_matrices): áreas com peso e competências (chave
--    'cmp:'), definida pela coordenação a partir do edital e validada por outra pessoa do colegiado.
--    A prontidão é calculada no cliente (readiness.ts).
-- 3. Série de notas por aluno (aplicações encerradas) para a tendência (academic-risk.ts).
-- 4. Sinais publicados (vertice_avalia_risk_signals) aparecem no alerta de evasão existente:
--    v_student_evasion_risk ganha colunas NO FINAL; a fórmula de risco atual não muda.
begin;

-- 1 ---------------------------------------------------------------------------------------
create or replace function public.vertice_avalia_competency_evidence(p_institution uuid,p_course uuid,p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid := auth.uid(); v_app uuid; v_student uuid; v_disc text; v_all boolean; validator boolean; result jsonb;
begin
 if uid is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Diagnóstico restrito à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 validator := vertice_private.avalia_access(p_institution,p_course,'validate');
 begin
  v_app := nullif(p_payload->>'applicationId','')::uuid;
  v_student := nullif(p_payload->>'studentId','')::uuid;
 exception when others then raise exception 'Identificador inválido.' using errcode='22023'; end;
 v_disc := vertice_private.avalia_discipline(p_payload->>'discipline');
 v_all := coalesce(p_payload->>'course','')='true';
 if num_nonnulls(v_app, v_student, v_disc, nullif(v_all,false)) <> 1 then
  raise exception 'Informe uma aplicação, uma disciplina, um aluno ou o curso.' using errcode='22023';
 end if;
 if v_app is not null then perform vertice_private.avalia_application_access(v_app,false); end if;

 with apps as (
  select a.id, a.applied_on, a.class_label, a.discipline, a.status, d.title, v.snapshot
  from public.vertice_avalia_applications a
  join public.vertice_avalia_drafts d on d.id=a.draft_id
  join public.vertice_avalia_draft_revisions v on v.draft_id=a.draft_id and v.revision=a.revision
  where a.institution_id=p_institution and a.course_id=p_course
    and (d.created_by=uid or a.created_by=uid or validator)
    and ((v_app is not null and a.id=v_app)
      or (v_disc is not null and a.status='closed' and lower(a.discipline)=lower(v_disc))
      or ((v_student is not null or v_all) and a.status='closed'))
 ), comp as (
  select apps.id app, apps.applied_on, c->>'id' cid, c->>'code' code, c->>'title' title,
   case when (c->>'period') ~ '^\d+$' then (c->>'period')::int end period,
   vertice_private.avalia_competency_key(p_course, c) ckey
  from apps, jsonb_array_elements(coalesce(apps.snapshot->'meta'->'declaredPedagogy'->'competencies','[]'::jsonb)) c
 ), qc as (
  select apps.id app, q->>'id' qid, cid
  from apps, jsonb_array_elements(apps.snapshot->'questions') q, jsonb_array_elements_text(coalesce(q->'competencyIds','[]'::jsonb)) cid
 ), ev as (
  select s.student_id, coalesce(st.full_name, s.student_label) label, i.application_id app, comp.ckey,
   i.score::numeric score, i.max_score::numeric mx
  from public.vertice_avalia_item_scores i
  join public.vertice_avalia_sheets s on s.id=i.sheet_id
  left join public.vertice_student_registry st on st.id=s.student_id
  join qc on qc.app=i.application_id and qc.qid=i.question_id
  join comp on comp.app=qc.app and comp.cid=qc.cid
  where i.outcome<>'pending'
    and (v_student is null or s.student_id=v_student)
    and (v_app is not null or s.student_id is not null)
 ), rel as (
  select distinct cs.ckey source, ct.ckey target, r->>'kind' kind
  from apps cross join lateral jsonb_array_elements(coalesce(apps.snapshot->'meta'->'declaredPedagogy'->'relations','[]'::jsonb)) r
  join comp cs on cs.app=apps.id and cs.cid=r->>'sourceCompetencyId'
  join comp ct on ct.app=apps.id and ct.cid=r->>'targetCompetencyId'
  where r->>'kind' in ('prerequisito','aprofundamento','interdisciplinar') and cs.ckey<>ct.ckey
 )
 select jsonb_build_object(
  'scope', case when v_app is not null then 'application' when v_disc is not null then 'discipline' when v_all then 'course' else 'student' end,
  'applications', coalesce((select jsonb_agg(jsonb_build_object('id',id,'appliedOn',applied_on,'classLabel',class_label,
     'discipline',discipline,'title',title,'status',status) order by applied_on) from apps),'[]'::jsonb),
  'competencies', coalesce((select jsonb_agg(x order by x->>'code', x->>'key') from (
     select distinct on (ckey) jsonb_build_object('key',ckey,'code',code,'title',title,'period',period) x
     from comp order by ckey, applied_on desc) z),'[]'::jsonb),
  'relations', coalesce((select jsonb_agg(jsonb_build_object('source',source,'target',target,'kind',kind) order by source,target,kind) from rel),'[]'::jsonb),
  'rows', coalesce((select jsonb_agg(jsonb_build_object('studentId',student_id,'label',label,'applicationId',app,
     'competency',ckey,'score',score,'max',mx,'items',n) order by label, app, ckey)
   from (select student_id, label, app, ckey, sum(score) score, sum(mx) mx, count(*) n from ev group by 1,2,3,4) g),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.vertice_avalia_competency_evidence(uuid,uuid,jsonb) from public,anon;
grant execute on function public.vertice_avalia_competency_evidence(uuid,uuid,jsonb) to authenticated;

-- 2 ---------------------------------------------------------------------------------------
create table public.vertice_avalia_exam_matrices (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id) on delete restrict,
 course_id uuid not null references public.vertice_courses(id) on delete restrict,
 exam text not null check (exam in ('enade','oab','outro')),
 label text not null check (length(btrim(label)) between 3 and 200),
 edition text not null check (length(btrim(edition)) between 2 and 60),
 source_ref text not null check (length(btrim(source_ref)) between 5 and 500),
 areas jsonb not null,
 status text not null default 'draft' check (status in ('draft','validated','archived')),
 created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 validated_by uuid references auth.users(id) on delete restrict,
 validated_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint avalia_matrix_validation check ((status='validated')=(validated_at is not null and validated_by is not null) or status='archived')
);
create index vertice_avalia_exam_matrices_course on public.vertice_avalia_exam_matrices(institution_id,course_id,exam,status);
alter table public.vertice_avalia_exam_matrices enable row level security;
revoke all on public.vertice_avalia_exam_matrices from public, anon, authenticated;
create trigger avalia_exam_matrices_audit after insert or update on public.vertice_avalia_exam_matrices for each row execute function vertice_private.audit_change();
comment on table public.vertice_avalia_exam_matrices is 'Matriz do exame (ENADE, OAB) por curso: áreas, pesos e competências, com a fonte (edital/portaria). Base do índice de prontidão do Avalia 360°.';

create function vertice_private.avalia_valid_areas(p jsonb) returns boolean
language sql immutable set search_path='' as $$
 select jsonb_typeof(p)='array' and jsonb_array_length(p) between 1 and 40
  and not exists(select 1 from jsonb_array_elements(p) a where
     jsonb_typeof(a)<>'object' or length(btrim(coalesce(a->>'label','')))<2 or length(a->>'label')>200
     or coalesce(a->>'key','') !~ '^[a-z0-9_-]{1,60}$'
     or jsonb_typeof(a->'weight')<>'number' or (a->>'weight')::numeric<=0 or (a->>'weight')::numeric>1000
     or jsonb_typeof(a->'competencies')<>'array' or jsonb_array_length(a->'competencies')>80
     or exists(select 1 from jsonb_array_elements(a->'competencies') c where jsonb_typeof(c)<>'string' or (c#>>'{}') !~ '^cmp:'))
  and (select count(distinct a->>'key') from jsonb_array_elements(p) a)=jsonb_array_length(p)
$$;

create function public.vertice_avalia_exam_matrix(p_institution uuid,p_course uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); validator boolean; m public.vertice_avalia_exam_matrices;
begin
 if uid is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Matrizes de exame restritas à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 validator := vertice_private.avalia_access(p_institution,p_course,'validate');
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Requisição inválida.' using errcode='22023'; end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'exam',x.exam,'label',x.label,'edition',x.edition,'sourceRef',x.source_ref,
     'areas',x.areas,'status',x.status,'mine',x.created_by=uid,'validatedAt',x.validated_at,'updatedAt',x.updated_at) order by x.exam, x.status, x.updated_at desc)
   from public.vertice_avalia_exam_matrices x where x.institution_id=p_institution and x.course_id=p_course and x.status<>'archived'),'[]'::jsonb);
 end if;
 if p_action='save' then
  if not validator then raise exception 'A matriz do exame é definida pela coordenação, pelo NDE ou pela gestão.' using errcode='42501'; end if;
  if not vertice_private.avalia_valid_areas(p_payload->'areas') then
   raise exception 'Áreas inválidas: de 1 a 40, cada uma com chave, nome, peso positivo e competências (chave cmp:).' using errcode='22023';
  end if;
  if coalesce(p_payload->>'exam','') not in ('enade','oab','outro') then raise exception 'Exame inválido.' using errcode='22023'; end if;
  if nullif(p_payload->>'id','') is null then
   insert into public.vertice_avalia_exam_matrices(institution_id,course_id,exam,label,edition,source_ref,areas,created_by)
   values(p_institution,p_course,p_payload->>'exam',btrim(p_payload->>'label'),btrim(p_payload->>'edition'),btrim(p_payload->>'sourceRef'),p_payload->'areas',uid)
   returning * into m;
  else
   update public.vertice_avalia_exam_matrices set exam=p_payload->>'exam',label=btrim(p_payload->>'label'),edition=btrim(p_payload->>'edition'),
    source_ref=btrim(p_payload->>'sourceRef'),areas=p_payload->'areas',updated_at=now()
   where id::text=p_payload->>'id' and institution_id=p_institution and course_id=p_course and status='draft'
   returning * into m;
   if not found then raise exception 'Somente matriz em rascunho pode ser alterada.' using errcode='23514'; end if;
  end if;
  return jsonb_build_object('id',m.id,'status',m.status);
 end if;
 select * into m from public.vertice_avalia_exam_matrices x where x.id::text=p_payload->>'id' and x.institution_id=p_institution and x.course_id=p_course for update;
 if not found then raise exception 'Matriz não localizada.' using errcode='P0002'; end if;
 if p_action='validate' then
  if not validator then raise exception 'Validação restrita à coordenação, ao NDE e à gestão.' using errcode='42501'; end if;
  if m.created_by=uid then raise exception 'Quem cadastrou a matriz não pode validá-la.' using errcode='42501'; end if;
  if m.status<>'draft' then raise exception 'A matriz não está em rascunho.' using errcode='23514'; end if;
  update public.vertice_avalia_exam_matrices set status='archived',updated_at=now()
   where institution_id=m.institution_id and course_id=m.course_id and exam=m.exam and status='validated';
  update public.vertice_avalia_exam_matrices set status='validated',validated_by=uid,validated_at=now(),updated_at=now() where id=m.id;
  return jsonb_build_object('id',m.id,'status','validated');
 end if;
 if p_action='archive' then
  if not validator then raise exception 'Restrito à coordenação, ao NDE e à gestão.' using errcode='42501'; end if;
  update public.vertice_avalia_exam_matrices set status='archived',updated_at=now() where id=m.id;
  return jsonb_build_object('id',m.id,'status','archived');
 end if;
 raise exception 'Ação inválida.' using errcode='22023';
end $$;
revoke all on function public.vertice_avalia_exam_matrix(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.vertice_avalia_exam_matrix(uuid,uuid,text,jsonb) to authenticated;

-- 3 ---------------------------------------------------------------------------------------
create function public.vertice_avalia_score_series(p_institution uuid,p_course uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid := auth.uid(); validator boolean;
begin
 if uid is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Série de notas restrita à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 validator := vertice_private.avalia_access(p_institution,p_course,'validate');
 return coalesce((select jsonb_agg(jsonb_build_object('studentId',sid,'label',label,'series',series) order by label) from (
  select s.student_id sid, st.full_name label,
   jsonb_agg(jsonb_build_object('appliedOn',a.applied_on,'discipline',a.discipline,'total',s.total_score,'max',s.max_score) order by a.applied_on, a.id) series
  from public.vertice_avalia_sheets s
  join public.vertice_avalia_applications a on a.id=s.application_id
  join public.vertice_avalia_drafts d on d.id=a.draft_id
  join public.vertice_student_registry st on st.id=s.student_id
  where a.institution_id=p_institution and a.course_id=p_course and a.status='closed' and s.max_score>0
    and (d.created_by=uid or a.created_by=uid or validator)
    and not exists(select 1 from public.vertice_avalia_item_scores i where i.sheet_id=s.id and i.outcome='pending')
  group by 1,2) x),'[]'::jsonb);
end $$;
revoke all on function public.vertice_avalia_score_series(uuid,uuid) from public,anon;
grant execute on function public.vertice_avalia_score_series(uuid,uuid) to authenticated;

-- 4 ---------------------------------------------------------------------------------------
create table public.vertice_avalia_risk_signals (
 student_id uuid not null references public.vertice_student_registry(id) on delete cascade,
 institution_id uuid not null references public.vertice_institutions(id) on delete restrict,
 course_id uuid not null references public.vertice_courses(id) on delete restrict,
 level text not null check (level in ('alto','atencao')),
 reasons jsonb not null check (jsonb_typeof(reasons)='array'),
 rules_version text not null,
 published_by uuid not null references auth.users(id) on delete restrict,
 computed_at timestamptz not null default now(),
 primary key (student_id, course_id)
);
create index vertice_avalia_risk_signals_course on public.vertice_avalia_risk_signals(institution_id,course_id);
alter table public.vertice_avalia_risk_signals enable row level security;
revoke all on public.vertice_avalia_risk_signals from public, anon, authenticated;
grant select on public.vertice_avalia_risk_signals to authenticated;
-- Mesma visibilidade do cadastro de alunos (a view de risco é security_invoker).
create policy avalia_risk_signals_read on public.vertice_avalia_risk_signals for select to authenticated
 using (vertice_private.can_read_institution(institution_id));
comment on table public.vertice_avalia_risk_signals is 'Sinal de risco acadêmico publicado pelo Avalia 360° (tendência das notas e competências críticas). Integra o alerta de evasão sem alterar a fórmula existente.';

create function public.vertice_avalia_risk_publish(p_institution uuid,p_course uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); s jsonb; n integer := 0;
begin
 if uid is null or not vertice_private.avalia_access(p_institution,p_course,'validate') then
  raise exception 'Publicação restrita à coordenação, ao NDE e à gestão, com MFA.' using errcode='42501';
 end if;
 if jsonb_typeof(p_payload->'signals') is distinct from 'array' or jsonb_array_length(p_payload->'signals')>5000 then
  raise exception 'Lista de sinais inválida.' using errcode='22023';
 end if;
 -- Publicação é um retrato: substitui os sinais anteriores do curso.
 delete from public.vertice_avalia_risk_signals where institution_id=p_institution and course_id=p_course;
 for s in select value from jsonb_array_elements(p_payload->'signals') loop
  if coalesce(s->>'level','') not in ('alto','atencao') or jsonb_typeof(s->'reasons')<>'array' or jsonb_array_length(s->'reasons') not between 1 and 10 then
   raise exception 'Sinal inválido.' using errcode='22023';
  end if;
  if not exists(select 1 from public.vertice_student_registry r where r.id::text=s->>'studentId' and r.institution_id=p_institution and r.course_id=p_course) then
   raise exception 'Aluno fora do cadastro deste curso.' using errcode='22023';
  end if;
  insert into public.vertice_avalia_risk_signals(student_id,institution_id,course_id,level,reasons,rules_version,published_by)
  values((s->>'studentId')::uuid,p_institution,p_course,s->>'level',
   (select jsonb_agg(left(x,300)) from jsonb_array_elements_text(s->'reasons') x),left(coalesce(p_payload->>'rulesVersion',''),20),uid);
  n := n+1;
 end loop;
 return jsonb_build_object('published',n);
end $$;
revoke all on function public.vertice_avalia_risk_publish(uuid,uuid,jsonb) from public,anon;
grant execute on function public.vertice_avalia_risk_publish(uuid,uuid,jsonb) to authenticated;

-- 5 ---------------------------------------------------------------------------------------
-- Mesma definição anterior; apenas três colunas novas no final.
create or replace view public.v_student_evasion_risk with (security_invoker=true) as
 SELECT sr.id AS student_id,
    sr.institution_id,
    sr.course_id,
    sr.full_name,
    sr.enrollment_code,
    sr.academic_status,
    COALESCE(bal.credited_minutes, 0::bigint) AS ac_credited_minutes,
    COALESCE(bal.remaining_minutes, bal.total_required_minutes::bigint, 0::bigint) AS ac_remaining_minutes,
    COALESCE(bal.submissions_total, 0::bigint) AS ac_submissions,
    ( SELECT count(*) AS count
           FROM vertice_tcc_works w
             JOIN vertice_tcc_participants p ON p.work_id = w.id AND p.enrollment_id = sr.id::text
          WHERE w.stage <> ALL (ARRAY['cancelled'::text, 'archived'::text, 'deposited'::text])) AS tcc_active,
    ( SELECT count(*) AS count
           FROM vertice_tcc_works w
             JOIN vertice_tcc_participants p ON p.work_id = w.id AND p.enrollment_id = sr.id::text
          WHERE (w.stage <> ALL (ARRAY['cancelled'::text, 'archived'::text, 'deposited'::text])) AND w.stage_deadline IS NOT NULL AND w.stage_deadline < now()) AS tcc_overdue,
    ( SELECT count(*) AS count
           FROM vertice_internship_placements ip
          WHERE ip.student_id = sr.id AND (ip.lifecycle <> ALL (ARRAY['posting_confirmed'::text, 'academic_rejected'::text, 'cancelled'::text]))) AS estagio_active,
    ( SELECT count(*) AS count
           FROM vertice_internship_placements ip
          WHERE ip.student_id = sr.id AND ip.lifecycle = 'posting_confirmed'::text) AS estagio_completed,
    LEAST(100,
        CASE
            WHEN COALESCE(bal.remaining_minutes, 0::bigint) > 0 AND COALESCE(bal.submissions_total, 0::bigint) = 0 THEN 30
            ELSE 0
        END +
        CASE
            WHEN (( SELECT count(*) AS count
               FROM vertice_tcc_works w
                 JOIN vertice_tcc_participants p ON p.work_id = w.id AND p.enrollment_id = sr.id::text
              WHERE (w.stage <> ALL (ARRAY['cancelled'::text, 'archived'::text, 'deposited'::text])) AND w.stage_deadline < now())) > 0 THEN 30
            ELSE 0
        END +
        CASE
            WHEN (( SELECT count(*) AS count
               FROM vertice_internship_placements ip
              WHERE ip.student_id = sr.id)) = 0 THEN 20
            ELSE 0
        END +
        CASE
            WHEN sr.academic_status = ANY (ARRAY['trancado'::text, 'cancelado'::text, 'jubilado'::text]) THEN 20
            ELSE 0
        END) AS risk_score,
        CASE
            WHEN COALESCE(bal.remaining_minutes, 0::bigint) > 0 AND COALESCE(bal.submissions_total, 0::bigint) = 0 AND (( SELECT count(*) AS count
               FROM vertice_tcc_works w
                 JOIN vertice_tcc_participants p ON p.work_id = w.id AND p.enrollment_id = sr.id::text
              WHERE (w.stage <> ALL (ARRAY['cancelled'::text, 'archived'::text, 'deposited'::text])) AND w.stage_deadline < now())) > 0 THEN 'critical'::text
            WHEN COALESCE(bal.remaining_minutes, 0::bigint) > 0 AND COALESCE(bal.submissions_total, 0::bigint) = 0 THEN 'high'::text
            WHEN (( SELECT count(*) AS count
               FROM vertice_tcc_works w
                 JOIN vertice_tcc_participants p ON p.work_id = w.id AND p.enrollment_id = sr.id::text
              WHERE (w.stage <> ALL (ARRAY['cancelled'::text, 'archived'::text, 'deposited'::text])) AND w.stage_deadline < now())) > 0 THEN 'high'::text
            WHEN (( SELECT count(*) AS count
               FROM vertice_internship_placements ip
              WHERE ip.student_id = sr.id)) = 0 THEN 'medium'::text
            ELSE 'low'::text
        END AS risk_level,
    ars.level AS academic_risk_level,
    ars.reasons AS academic_risk_reasons,
    ars.computed_at AS academic_risk_at
   FROM vertice_student_registry sr
     LEFT JOIN v_ac_student_balance bal ON bal.student_id = sr.id
     LEFT JOIN vertice_avalia_risk_signals ars ON ars.student_id = sr.id AND ars.course_id = sr.course_id;

notify pgrst, 'reload schema';
commit;
