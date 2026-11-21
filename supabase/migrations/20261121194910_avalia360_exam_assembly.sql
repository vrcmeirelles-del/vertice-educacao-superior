-- Avalia 360° — bloco 2: montagem automática de prova pelo banco calibrado.
-- 1. O Banco de Questões passa a guardar código, título e período das competências de cada
--    questão (permite cruzar com a especificação pela chave estável 'cmp:código|título').
-- 2. vertice_avalia_bank_exposure informa, por item do banco, a última aplicação (qualquer
--    situação) na disciplina, opcionalmente filtrada pela turma: base do controle de exposição.
-- O algoritmo de montagem é determinístico e roda no cliente (exam-assembly.ts); a prova montada
-- vira um rascunho comum e segue checklist → colegiado → aplicação.
begin;

create or replace function public.vertice_avalia_bank(p_institution uuid,p_course uuid,p_discipline text,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); disc text := vertice_private.avalia_discipline(p_discipline);
 rec jsonb := p_payload->'record'; q jsonb := rec->'question'; bid uuid; saved public.vertice_avalia_bank; comps jsonb;
begin
 if uid is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Banco de Questões restrito à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 if disc is null or length(disc)>200 then raise exception 'Informe a disciplina.' using errcode='22023'; end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(x.rec order by x.created_at desc) from (
   select b.record || jsonb_build_object('bankId',b.id,'revision',b.revision,'status',b.status,
     'institutionId',b.institution_id,'courseId',b.course_id,'discipline',b.discipline,'createdAt',b.created_at) as rec, b.created_at
   from public.vertice_avalia_bank b
   where b.institution_id=p_institution and b.course_id=p_course and lower(b.discipline)=lower(disc)
   order by b.created_at desc limit 500) x),'[]'::jsonb);
 end if;
 if p_action<>'save' then raise exception 'Ação inválida.' using errcode='22023'; end if;
 if jsonb_typeof(rec) is distinct from 'object' or jsonb_typeof(q) is distinct from 'object'
   or octet_length(rec::text) > 200000 then
  raise exception 'Registro do banco inválido.' using errcode='22023';
 end if;
 begin bid := (rec->>'bankId')::uuid; exception when others then raise exception 'Identificador do banco inválido.' using errcode='22023'; end;
 if coalesce(q->>'kind','') not in ('objetiva','discursiva') or length(btrim(coalesce(q->>'statement','')))<10
   or jsonb_typeof(q->'images') is distinct from 'array' or jsonb_array_length(q->'images')<>0 then
  raise exception 'Questão incompleta ou com imagem (imagens não são arquivadas no banco).' using errcode='22023';
 end if;
 -- Descritores de competência: só os citados pela questão, com código e título; no máximo 50.
 if rec ? 'competencies' and (jsonb_typeof(rec->'competencies')<>'array' or jsonb_array_length(rec->'competencies')>50) then
  raise exception 'Competências do item em formato inválido.' using errcode='22023';
 end if;
 comps := coalesce((select jsonb_agg(jsonb_build_object('id',c->>'id','code',left(btrim(c->>'code'),40),'title',left(btrim(c->>'title'),250),
    'period',case when (c->>'period') ~ '^\d{1,2}$' then (c->>'period')::int end))
  from jsonb_array_elements(coalesce(rec->'competencies','[]'::jsonb)) c
  where jsonb_typeof(c)='object' and btrim(coalesce(c->>'code',''))<>'' and btrim(coalesce(c->>'title',''))<>''
    and coalesce(q->'competencyIds','[]'::jsonb) ? (c->>'id')),'[]'::jsonb);
 if (select count(*) from public.vertice_avalia_bank b where b.created_by=uid and b.created_at>now()-interval '1 day') >= 500 then
  raise exception 'Limite diário do Banco de Questões atingido.' using errcode='54000';
 end if;
 insert into public.vertice_avalia_bank(id,institution_id,course_id,discipline,record,created_by)
 values(bid,p_institution,p_course,disc,
  jsonb_build_object('question',q,'indexLabels',coalesce(rec->'indexLabels','[]'::jsonb),'competencies',comps) ||
  case when rec ? 'sourceAssessmentId' then jsonb_build_object('sourceAssessmentId',rec->'sourceAssessmentId') else '{}'::jsonb end,
  uid)
 on conflict (id) do nothing returning * into saved;
 if saved.id is null then raise exception 'Identificador já utilizado no Banco de Questões.' using errcode='23505'; end if;
 return saved.record || jsonb_build_object('bankId',saved.id,'revision',saved.revision,'status',saved.status,
  'institutionId',saved.institution_id,'courseId',saved.course_id,'discipline',saved.discipline,'createdAt',saved.created_at);
end $$;
revoke all on function public.vertice_avalia_bank(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.vertice_avalia_bank(uuid,uuid,text,text,jsonb) to authenticated;

create function public.vertice_avalia_bank_exposure(p_institution uuid,p_course uuid,p_discipline text,p_class text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_class text := nullif(lower(regexp_replace(btrim(coalesce(p_class,'')),'\s+',' ','g')),'');
begin
 if auth.uid() is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Exposição restrita à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 return coalesce((
  select jsonb_object_agg(bank, jsonb_build_object('lastAppliedOn',last_on,'applications',n))
  from (
   select q->>'sourceBankId' bank, max(a.applied_on) last_on, count(distinct a.id) n
   from public.vertice_avalia_applications a
   join public.vertice_avalia_draft_revisions v on v.draft_id=a.draft_id and v.revision=a.revision
   cross join lateral jsonb_array_elements(v.snapshot->'questions') q
   where a.institution_id=p_institution and a.course_id=p_course
     and lower(a.discipline)=lower(vertice_private.avalia_discipline(p_discipline))
     and (v_class is null or lower(regexp_replace(btrim(a.class_label),'\s+',' ','g'))=v_class)
     and nullif(q->>'sourceBankId','') is not null
   group by 1) x),'{}'::jsonb);
end $$;
revoke all on function public.vertice_avalia_bank_exposure(uuid,uuid,text,text) from public,anon;
grant execute on function public.vertice_avalia_bank_exposure(uuid,uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
