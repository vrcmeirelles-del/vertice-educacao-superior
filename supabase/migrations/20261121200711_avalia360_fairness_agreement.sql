-- Avalia 360° — bloco 4: justiça entre versões, dupla correção e rubrica estruturada (sem IA).
-- 1. avalia_blocking_issues: a rubrica estruturada (rubricCriteria) substitui o texto livre;
--    critério sem descrição ou sem pontos e soma diferente da pontuação bloqueiam o envio.
-- 2. vertice_avalia_response_matrix: matriz ANONIMIZADA (sem nome nem id do aluno) com versão,
--    nota total e resultado por questão — base da comparação entre versões (DIF) no cliente.
-- 3. vertice_avalia_second_scores + vertice_avalia_double_scoring: dupla correção CEGA de
--    discursivas numa amostra determinística; o segundo corretor não vê a nota do primeiro e
--    precisa ser outra pessoa. A concordância (ICC) é calculada no cliente (agreement.ts).
begin;

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
   (case when q.v->>'kind'='discursiva' and btrim(coalesce(q.v->>'rubric',''))=''
      and jsonb_array_length(coalesce(q.v->'rubricCriteria','[]'::jsonb))=0 then 'SEM_RUBRICA' end),
   (case when q.v->>'kind'='discursiva' and exists(select 1 from jsonb_array_elements(coalesce(q.v->'rubricCriteria','[]'::jsonb)) c
      where btrim(coalesce(c->>'label',''))='' or coalesce((c->>'points')::numeric,0)<=0) then 'RUBRICA_CRITERIO' end),
   (case when q.v->>'kind'='discursiva' and jsonb_array_length(coalesce(q.v->'rubricCriteria','[]'::jsonb))>0
      and abs((select coalesce(sum((c->>'points')::numeric),0) from jsonb_array_elements(q.v->'rubricCriteria') c)
              - coalesce((q.v->>'points')::numeric,0))>0.001 then 'RUBRICA_SOMA' end),
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

create function public.vertice_avalia_response_matrix(p_institution uuid,p_course uuid,p_application uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.vertice_avalia_applications; snap jsonb;
begin
 if auth.uid() is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Análise restrita à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 a := vertice_private.avalia_application_access(p_application,false);
 if a.institution_id<>p_institution or a.course_id<>p_course then raise exception 'Aplicação não localizada.' using errcode='P0002'; end if;
 snap := (select v.snapshot from public.vertice_avalia_draft_revisions v where v.draft_id=a.draft_id and v.revision=a.revision);
 return jsonb_build_object(
  'variantCount',a.variant_count,
  'questions',(select jsonb_agg(jsonb_build_object('id',q->>'id','kind',q->>'kind','points',(q->>'points')::numeric,'statement',left(q->>'statement',140)) order by n)
    from jsonb_array_elements(snap->'questions') with ordinality t(q,n)),
  -- Sem identificação: ordem por hash do id da folha, só para não revelar a ordem de lançamento.
  'sheets',coalesce((select jsonb_agg(jsonb_build_object('variant',s.variant,'total',s.total_score,
     'complete',not exists(select 1 from public.vertice_avalia_item_scores p where p.sheet_id=s.id and p.outcome='pending'),
     'items',(select jsonb_object_agg(i.question_id,jsonb_build_object('score',i.score,'max',i.max_score,'outcome',i.outcome))
              from public.vertice_avalia_item_scores i where i.sheet_id=s.id)) order by md5(s.id::text))
    from public.vertice_avalia_sheets s where s.application_id=a.id),'[]'::jsonb));
end $$;
revoke all on function public.vertice_avalia_response_matrix(uuid,uuid,uuid) from public,anon;
grant execute on function public.vertice_avalia_response_matrix(uuid,uuid,uuid) to authenticated;

create table public.vertice_avalia_second_scores (
 sheet_id uuid not null references public.vertice_avalia_sheets(id) on delete cascade,
 question_id text not null,
 application_id uuid not null references public.vertice_avalia_applications(id) on delete restrict,
 score numeric(8,2) not null check (score >= 0),
 criteria jsonb,
 rater uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (sheet_id, question_id)
);
create index vertice_avalia_second_scores_app on public.vertice_avalia_second_scores(application_id);
alter table public.vertice_avalia_second_scores enable row level security;
revoke all on public.vertice_avalia_second_scores from public, anon, authenticated;
create trigger avalia_second_scores_audit after insert or update on public.vertice_avalia_second_scores for each row execute function vertice_private.audit_change();
comment on table public.vertice_avalia_second_scores is 'Segunda correção (cega) de discursivas do Avalia 360°, para medir a concordância entre corretores.';

create function public.vertice_avalia_double_scoring(p_institution uuid,p_course uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); a public.vertice_avalia_applications; snap jsonb; v_share numeric; v_min integer; v_n integer; k integer;
 row_in jsonb; v_q jsonb; v_sheet public.vertice_avalia_sheets; v_score numeric; saved integer := 0; prev uuid;
begin
 if uid is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Dupla correção restrita à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Requisição inválida.' using errcode='22023'; end if;
 a := vertice_private.avalia_application_access(nullif(p_payload->>'applicationId','')::uuid,false);
 if a.institution_id<>p_institution or a.course_id<>p_course then raise exception 'Aplicação não localizada.' using errcode='P0002'; end if;
 snap := (select v.snapshot from public.vertice_avalia_draft_revisions v where v.draft_id=a.draft_id and v.revision=a.revision);

 if p_action='sample' then
  v_share := least(1,greatest(0.1,coalesce(nullif(p_payload->>'share','')::numeric,0.2)));
  v_min := least(400,greatest(1,coalesce(nullif(p_payload->>'min','')::integer,10)));
  select count(*) into v_n from public.vertice_avalia_sheets s where s.application_id=a.id
   and exists(select 1 from public.vertice_avalia_item_scores i where i.sheet_id=s.id and i.kind='discursiva' and i.outcome='scored');
  k := least(v_n, greatest(v_min, ceil(v_share*v_n)::integer));
  -- Amostra determinística: menores hashes de (aplicação, folha). Sem a nota do 1º corretor (correção cega).
  return jsonb_build_object('population',v_n,'size',k,
   'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q->>'id','points',(q->>'points')::numeric,'statement',left(q->>'statement',200),
      'rubric',q->>'rubric','rubricCriteria',coalesce(q->'rubricCriteria','[]'::jsonb)) order by n)
     from jsonb_array_elements(snap->'questions') with ordinality t(q,n) where q->>'kind'='discursiva'),'[]'::jsonb),
   'sheets',coalesce((select jsonb_agg(jsonb_build_object('sheetId',x.id,'code','F'||lpad(x.rk::text,3,'0'),'variant',x.variant,'mine',x.entered_by=uid,
      'secondScores',(select jsonb_object_agg(ss.question_id,jsonb_build_object('score',ss.score,'criteria',ss.criteria,'byMe',ss.rater=uid))
        from public.vertice_avalia_second_scores ss where ss.sheet_id=x.id)) order by x.rk)
    from (select s.*, row_number() over (order by md5(a.id::text||s.id::text)) rk from public.vertice_avalia_sheets s
          where s.application_id=a.id and exists(select 1 from public.vertice_avalia_item_scores i where i.sheet_id=s.id and i.kind='discursiva' and i.outcome='scored')) x
    where x.rk<=k),'[]'::jsonb));
 end if;

 if p_action='save' then
  if jsonb_typeof(p_payload->'scores') is distinct from 'array' or jsonb_array_length(p_payload->'scores') not between 1 and 2000 then
   raise exception 'Envie entre 1 e 2000 notas.' using errcode='22023';
  end if;
  for row_in in select value from jsonb_array_elements(p_payload->'scores') loop
   v_q := null;
   select * into v_sheet from public.vertice_avalia_sheets s where s.id::text=row_in->>'sheetId' and s.application_id=a.id;
   if not found then raise exception 'Folha fora desta aplicação.' using errcode='22023'; end if;
   if v_sheet.entered_by=uid then raise exception 'A segunda correção deve ser feita por quem não lançou a primeira.' using errcode='42501'; end if;
   select x into v_q from jsonb_array_elements(snap->'questions') x where x->>'id'=row_in->>'questionId' and x->>'kind'='discursiva';
   if v_q is null then raise exception 'Questão discursiva inexistente no caderno aplicado.' using errcode='22023'; end if;
   begin v_score := (row_in->>'score')::numeric; exception when others then v_score := null; end;
   if v_score is null or v_score<0 or v_score>(v_q->>'points')::numeric then
    raise exception 'Nota fora do intervalo 0–%.', v_q->>'points' using errcode='22023';
   end if;
   if row_in ? 'criteria' and jsonb_typeof(row_in->'criteria')='object' and
      abs((select coalesce(sum(value::numeric),0) from jsonb_each_text(row_in->'criteria'))-v_score)>0.001 then
    raise exception 'A soma dos critérios difere da nota informada.' using errcode='22023';
   end if;
   select rater into prev from public.vertice_avalia_second_scores where sheet_id=v_sheet.id and question_id=v_q->>'id';
   if prev is not null and prev<>uid then raise exception 'Esta folha já tem segunda correção de outra pessoa.' using errcode='42501'; end if;
   insert into public.vertice_avalia_second_scores(sheet_id,question_id,application_id,score,criteria,rater)
   values(v_sheet.id,v_q->>'id',a.id,round(v_score,2),case when jsonb_typeof(row_in->'criteria')='object' then row_in->'criteria' end,uid)
   on conflict (sheet_id,question_id) do update set score=excluded.score,criteria=excluded.criteria,updated_at=now();
   saved := saved+1;
  end loop;
  return jsonb_build_object('saved',saved);
 end if;

 if p_action='agreement' then
  return jsonb_build_object('questions',coalesce((select jsonb_agg(jsonb_build_object('questionId',q->>'id','points',(q->>'points')::numeric,
     'statement',left(q->>'statement',140),
     'pairs',coalesce((select jsonb_agg(jsonb_build_array(i.score,ss.score) order by md5(ss.sheet_id::text))
       from public.vertice_avalia_second_scores ss join public.vertice_avalia_item_scores i on i.sheet_id=ss.sheet_id and i.question_id=ss.question_id
       where ss.application_id=a.id and ss.question_id=q->>'id' and i.outcome='scored'),'[]'::jsonb)) order by n)
   from jsonb_array_elements(snap->'questions') with ordinality t(q,n) where q->>'kind'='discursiva'),'[]'::jsonb));
 end if;

 raise exception 'Ação inválida.' using errcode='22023';
end $$;
revoke all on function public.vertice_avalia_double_scoring(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.vertice_avalia_double_scoring(uuid,uuid,text,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
