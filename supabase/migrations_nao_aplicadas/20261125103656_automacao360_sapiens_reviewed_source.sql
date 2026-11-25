-- Fonte Sapiens revisada por pessoa. Não altera notas, métricas originais ou intervenções.
begin;
create table vertice_automation.sapiens_review (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id),
 course_id uuid not null,
 source_key text not null check(source_key ~ '^[0-9a-f]{32}$'),
 source_hash text not null check(source_hash ~ '^[0-9a-f]{32}$'),
 source_snapshot jsonb not null,
 decision text not null check(decision in ('validated','revoked')),
 final_graded integer not null check(final_graded>=30),
 final_correct integer not null check(final_correct>=0 and final_correct<=final_graded),
 final_students integer not null check(final_students>=5 and final_students<=final_graded),
 evidence_ref text not null check(length(btrim(evidence_ref)) between 10 and 1000),
 note text not null check(length(btrim(note)) between 20 and 2000),
 reviewed_by uuid not null references auth.users(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 foreign key(course_id,institution_id) references public.vertice_courses(id,institution_id)
);
create index sapiens_review_scope on vertice_automation.sapiens_review(institution_id,course_id,source_key,reviewed_at desc,id desc);
create index sapiens_review_course on vertice_automation.sapiens_review(course_id,institution_id);
create index sapiens_review_actor on vertice_automation.sapiens_review(reviewed_by);
alter table vertice_automation.sapiens_review enable row level security;
revoke all on vertice_automation.sapiens_review from public,anon,authenticated,service_role;
create trigger sapiens_review_immutable before update or delete on vertice_automation.sapiens_review
 for each row execute function vertice_automation.forbid_change();

-- Identidade do agregado distinta da revisão: qualquer mudança na fonte invalida a revisão.
create function vertice_automation.sapiens_key(m jsonb) returns text
language sql immutable set search_path='' as $$
 select md5(jsonb_build_array(m->'institution_id',m->'course_id',m->'semester',m->'subject_code',m->'module',m->'competency')::text)
$$;
revoke all on function vertice_automation.sapiens_key(jsonb) from public,anon,authenticated,service_role;

create function public.vertice_automation_sapiens_review(p_institution uuid,p_course uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare m jsonb; v_key text; v_hash text; v_current vertice_automation.sapiens_review;
 v_id uuid; v_result jsonb; v_g integer; v_c integer; v_n integer;
begin
 if p_course is null or not vertice_private.automation_can(p_institution,p_course,'review') then
  raise exception 'acesso negado ou MFA pendente' using errcode='42501';
 end if;
 if p_action='list' then
  if (select count(*) from public.vertice_learning_course_metrics where institution_id=p_institution and course_id=p_course)>2500 then
   raise exception 'volume acima do lote; paginar antes de revisar' using errcode='54000';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('key',vertice_automation.sapiens_key(to_jsonb(x)),
   'hash',md5(to_jsonb(x)::text),'semester',x.semester,'module',x.module,'subject',x.subject_code,
   'competency',x.competency,'graded',x.graded,'correct',x.correct,'students',x.paired_students,
   'updatedAt',x.updated_at,'reviewId',r.id,'decision',r.decision,'reviewCurrent',r.source_hash=md5(to_jsonb(x)::text))
   order by x.semester,x.module,x.subject_code,x.competency),'[]') into v_result
  from public.vertice_learning_course_metrics x left join lateral (
   select * from vertice_automation.sapiens_review r where r.institution_id=p_institution and r.course_id=p_course
    and r.source_key=vertice_automation.sapiens_key(to_jsonb(x)) order by r.reviewed_at desc,r.id desc limit 1
  ) r on true where x.institution_id=p_institution and x.course_id=p_course;
  return v_result;
 end if;
 if p_action is null or p_action not in ('validate','revoke') or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>10000 then
  raise exception 'operação inválida' using errcode='22023';
 end if;
 v_key:=p_payload->>'key'; v_hash:=p_payload->>'hash';
 perform pg_advisory_xact_lock(hashtextextended('sapiens-review:'||p_institution||':'||p_course||':'||coalesce(v_key,''),0));
 select to_jsonb(x) into m from public.vertice_learning_course_metrics x
 where x.institution_id=p_institution and x.course_id=p_course and vertice_automation.sapiens_key(to_jsonb(x))=v_key for share;
 if m is null or md5(m::text) is distinct from v_hash then
  raise exception 'fonte alterada ou fora do curso; atualize a revisão' using errcode='40001';
 end if;
 select * into v_current from vertice_automation.sapiens_review r where r.institution_id=p_institution and r.course_id=p_course
  and r.source_key=v_key order by r.reviewed_at desc,r.id desc limit 1;
 if v_current.id is distinct from nullif(p_payload->>'expectedReviewId','')::uuid then
  raise exception 'revisão concorrente; atualize' using errcode='40001';
 end if;
 if p_action='validate' then
  if p_payload->'provisionalExcluded' is distinct from 'true'::jsonb or length(btrim(coalesce(m->>'competency','')))=0
   or length(btrim(coalesce(m->>'semester','')))=0 then
   raise exception 'confira competência, período e exclusão de pré-notas' using errcode='22023';
  end if;
  v_g:=(p_payload->>'finalGraded')::integer; v_c:=(p_payload->>'finalCorrect')::integer; v_n:=(p_payload->>'finalStudents')::integer;
  if m->>'graded' is null or m->>'correct' is null or m->>'paired_students' is null or v_g is null or v_c is null or v_n is null or v_g<30 or v_n<5 or v_c<0 or v_c>v_g or v_n>v_g
   or v_g>(m->>'graded')::integer or v_c>(m->>'correct')::integer or v_n>(m->>'paired_students')::integer
   or v_g-v_c>(m->>'graded')::integer-(m->>'correct')::integer then
   raise exception 'amostra definitiva inválida ou não contida na fonte' using errcode='22023';
  end if;
 else
  if v_current.id is null or v_current.decision<>'validated' then raise exception 'sem revisão vigente para revogar' using errcode='22023'; end if;
  v_g:=v_current.final_graded;v_c:=v_current.final_correct;v_n:=v_current.final_students;
 end if;
 insert into vertice_automation.sapiens_review(institution_id,course_id,source_key,source_hash,source_snapshot,decision,
  final_graded,final_correct,final_students,evidence_ref,note,reviewed_by)
 values(p_institution,p_course,v_key,v_hash,m,case when p_action='validate' then 'validated' else 'revoked' end,
  v_g,v_c,v_n,p_payload->>'evidenceRef',p_payload->>'note',auth.uid()) returning id into v_id;
 return jsonb_build_object('id',v_id,'decision',case when p_action='validate' then 'validated' else 'revoked' end);
end $$;
revoke all on function public.vertice_automation_sapiens_review(uuid,uuid,text,jsonb) from public,anon,service_role;
grant execute on function public.vertice_automation_sapiens_review(uuid,uuid,text,jsonb) to authenticated;

create function public.vertice_automation_source_sapiens(p_institution uuid,p_course uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_groups jsonb;
begin
 if (select auth.role()) is distinct from 'service_role' then
  raise exception 'acesso negado' using errcode='42501'; end if;
 if p_course is null or not exists(select 1 from public.vertice_courses where id=p_course and institution_id=p_institution) then
  raise exception 'curso fora da instituição' using errcode='42501'; end if;
 if (select count(*) from public.vertice_learning_course_metrics where institution_id=p_institution and course_id=p_course)>2500 then
  raise exception 'volume acima do lote; paginar antes de executar' using errcode='54000'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('institutionId',p_institution,'courseId',p_course,'ruleId','sapiens.low',
  'id','sapiens:'||vertice_automation.sapiens_key(to_jsonb(x)),'revision',md5(to_jsonb(x)::text),
  'status',case when r.decision='validated' and r.source_hash=md5(to_jsonb(x)::text) then 'validated' else 'pending' end,
  'provisional',not coalesce(r.decision='validated' and r.source_hash=md5(to_jsonb(x)::text),false),
  'reviewId',r.id::text,'observedAt',to_char(x.updated_at at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'competencyKey',md5(coalesce(x.competency,'')),'windowId',md5(x.semester),
  'correct',r.final_correct,'graded',r.final_graded,'studentCount',r.final_students)
  order by x.semester,x.module,x.subject_code,x.competency),'[]') into v_groups
 from public.vertice_learning_course_metrics x left join lateral(
  select * from vertice_automation.sapiens_review r where r.institution_id=p_institution and r.course_id=p_course
   and r.source_key=vertice_automation.sapiens_key(to_jsonb(x)) order by r.reviewed_at desc,r.id desc limit 1
 ) r on true where x.institution_id=p_institution and x.course_id=p_course;
 if jsonb_array_length(v_groups)=0 then
  v_groups:=jsonb_build_array(jsonb_build_object('institutionId',p_institution,'courseId',p_course,
   'ruleId','sapiens.low','id','sapiens:no-metrics','revision','missing','status','missing','provisional',true,
   'reviewId',null,'observedAt',to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
 end if;
 return jsonb_build_object('institutionId',p_institution,'courseId',p_course,'id','sapiens-reviewed-v1',
  'observedAt',to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'complete',true,'groups',v_groups);
end $$;
revoke all on function public.vertice_automation_source_sapiens(uuid,uuid) from public,anon,authenticated;
grant execute on function public.vertice_automation_source_sapiens(uuid,uuid) to service_role;
commit;
