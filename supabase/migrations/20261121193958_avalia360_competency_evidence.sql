-- Avalia 360° — evidência por competência (bloco 1: diagnóstico pedagógico por algoritmo).
-- O servidor entrega a evidência bruta (nota obtida / nota possível por aluno, aplicação e
-- competência). Domínio, decaimento temporal, mapa da turma e causa-raiz são calculados
-- no cliente por regras explícitas e versionadas (competency-mastery.ts).
--
-- Identidade estável da competência entre cadernos:
--  'cur:<id>'                 se o id pertence à Construção Curricular do mesmo curso;
--  'dec:<código>|<título>'    se foi declarada no caderno (normalizado).
-- Relação "origem -> destino" do tipo pré-requisito: a origem é pré-requisito do destino.
begin;

create function vertice_private.avalia_competency_key(p_course uuid, c jsonb) returns text
language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from vertice_app.curriculum_competencies cc
                         join vertice_app.curriculum_builds b on b.id=cc.build_id
                         where cc.id::text=c->>'id' and b.course_id=p_course)
   then 'cur:'||(c->>'id')
   else 'dec:'||lower(regexp_replace(btrim(coalesce(c->>'code','')),'\s+',' ','g'))||'|'||lower(regexp_replace(btrim(coalesce(c->>'title','')),'\s+',' ','g'))
 end
$$;
revoke all on function vertice_private.avalia_competency_key(uuid,jsonb) from public,anon,authenticated;

create function public.vertice_avalia_competency_evidence(p_institution uuid,p_course uuid,p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid := auth.uid(); v_app uuid; v_student uuid; v_disc text; validator boolean; result jsonb;
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
 if num_nonnulls(v_app, v_student, v_disc) <> 1 then
  raise exception 'Informe uma aplicação, uma disciplina ou um aluno.' using errcode='22023';
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
      or (v_student is not null and a.status='closed'))
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
    and (v_app is not null or s.student_id is not null)  -- histórico só com aluno vinculado ao cadastro
 ), rel as (
  select distinct cs.ckey source, ct.ckey target, r->>'kind' kind
  from apps cross join lateral jsonb_array_elements(coalesce(apps.snapshot->'meta'->'declaredPedagogy'->'relations','[]'::jsonb)) r
  join comp cs on cs.app=apps.id and cs.cid=r->>'sourceCompetencyId'
  join comp ct on ct.app=apps.id and ct.cid=r->>'targetCompetencyId'
  where r->>'kind' in ('prerequisito','aprofundamento','interdisciplinar') and cs.ckey<>ct.ckey
 )
 select jsonb_build_object(
  'scope', case when v_app is not null then 'application' when v_disc is not null then 'discipline' else 'student' end,
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

-- Avaliação somativa: toda questão precisa estar vinculada a ao menos uma competência,
-- condição para o diagnóstico por competência ser confiável. Mantém os bloqueios anteriores.
create or replace function vertice_private.avalia_blocking_issues(p_snapshot jsonb) returns text[]
language sql immutable set search_path='' as $$
 select coalesce(array_agg(distinct issue order by issue),'{}') from (
  select 'Q'||q.ord||':'||x.issue as issue
  from jsonb_array_elements(coalesce(p_snapshot->'questions','[]'::jsonb)) with ordinality q(v,ord)
  cross join lateral (values
   (case when length(btrim(coalesce(q.v->>'statement','')))<10 then 'ENUNCIADO_CURTO' end),
   (case when coalesce((q.v->>'points')::numeric,0)<=0 then 'PONTUACAO_INVALIDA' end),
   (case when q.v->>'kind'='objetiva' and (jsonb_array_length(coalesce(q.v->'options','[]'::jsonb))<2
      or exists(select 1 from jsonb_array_elements(q.v->'options') o where btrim(coalesce(o->>'text',''))=''))
     then 'ALTERNATIVA_VAZIA' end),
   (case when q.v->>'kind'='objetiva' and not exists(select 1 from jsonb_array_elements(coalesce(q.v->'options','[]'::jsonb)) o
      where o->>'id'=q.v->>'correctOptionId') then 'SEM_GABARITO' end),
   (case when q.v->>'kind'='objetiva' and btrim(coalesce(q.v->>'answerJustification',''))='' then 'SEM_JUSTIFICATIVA' end),
   (case when q.v->>'kind'='objetiva' and (select count(*)<>count(distinct lower(regexp_replace(btrim(o->>'text'),'\s+',' ','g')))
      from jsonb_array_elements(coalesce(q.v->'options','[]'::jsonb)) o where btrim(coalesce(o->>'text',''))<>'') then 'ALTERNATIVA_DUPLICADA' end),
   (case when q.v->>'kind'='discursiva' and btrim(coalesce(q.v->>'rubric',''))='' then 'SEM_RUBRICA' end),
   (case when q.v->>'kind'='discursiva' and btrim(coalesce(q.v->>'expectedAnswer',''))='' then 'SEM_PADRAO_RESPOSTA' end),
   (case when exists(select 1 from jsonb_array_elements(coalesce(q.v->'images','[]'::jsonb)) im
      where btrim(coalesce(im->>'altText',''))='') then 'IMAGEM_SEM_DESCRICAO' end),
   (case when exists(select 1 from jsonb_array_elements(coalesce(q.v->'images','[]'::jsonb)) im
      where coalesce(im->>'rightsStatus','') not in ('autoral','licenciado','uso_autorizado')) then 'IMAGEM_SEM_DIREITO' end),
   (case when p_snapshot->'meta'->>'purpose'='somativa'
      and jsonb_array_length(coalesce(q.v->'competencyIds','[]'::jsonb))=0 then 'SOMATIVA_SEM_COMPETENCIA' end)
  ) as x(issue)
  where x.issue is not null
 ) s
$$;

notify pgrst, 'reload schema';
commit;
