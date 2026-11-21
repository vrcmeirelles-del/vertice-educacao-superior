-- Avalia 360° — validação pelo colegiado (NDE/coordenação).
-- Fluxo: rascunho -> enviado -> validado | devolvido (volta a rascunho).
-- Regras determinísticas; o servidor repete os bloqueios estruturais do checklist.
-- Segregação de funções: quem elaborou não valida o próprio caderno.
begin;

create table public.vertice_avalia_reviews (
 id uuid primary key default gen_random_uuid(),
 draft_id uuid not null references public.vertice_avalia_drafts(id) on delete restrict,
 institution_id uuid not null references public.vertice_institutions(id) on delete restrict,
 course_id uuid not null references public.vertice_courses(id) on delete restrict,
 revision integer not null,
 action text not null check (action in ('submitted','validated','returned')),
 actor uuid not null references auth.users(id) on delete restrict,
 justification text check (justification is null or length(justification) <= 4000),
 reasons text[] not null default '{}' check (reasons <@ array['enunciado','alternativas','gabarito','rubrica',
   'alinhamento_curricular','nivel_dificuldade','acessibilidade','direitos_imagem','outro']::text[]),
 checklist jsonb,
 created_at timestamptz not null default now(),
 constraint avalia_review_justified check (action='submitted' or length(btrim(coalesce(justification,''))) >= 10),
 constraint avalia_review_reasons check (action<>'returned' or cardinality(reasons) >= 1)
);
create index vertice_avalia_reviews_draft on public.vertice_avalia_reviews(draft_id, created_at);
create index vertice_avalia_reviews_course on public.vertice_avalia_reviews(institution_id, course_id, created_at desc);
alter table public.vertice_avalia_reviews enable row level security;
revoke all on public.vertice_avalia_reviews from public, anon, authenticated;
create trigger avalia_reviews_audit after insert on public.vertice_avalia_reviews for each row execute function vertice_private.audit_change();
comment on table public.vertice_avalia_reviews is 'Pareceres do colegiado sobre cadernos do Avalia 360°. Registro imutável, com versão avaliada.';

-- Bloqueios estruturais (espelham as regras de gravidade "bloqueio" do checklist do cliente).
create function vertice_private.avalia_blocking_issues(p_snapshot jsonb) returns text[]
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
      where coalesce(im->>'rightsStatus','') not in ('autoral','licenciado','uso_autorizado')) then 'IMAGEM_SEM_DIREITO' end)
  ) as x(issue)
  where x.issue is not null
 ) s
$$;

create function public.vertice_avalia_review(p_institution uuid,p_course uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid := auth.uid();
 d public.vertice_avalia_drafts;
 validator boolean;
 blocking text[];
 expected integer;
 v_reasons text[];
 just text := nullif(btrim(coalesce(p_payload->>'justification','')),'');
begin
 if uid is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Validação restrita à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 validator := vertice_private.avalia_access(p_institution,p_course,'validate');

 if p_action='queue' then
  if not validator then raise exception 'Fila de validação restrita à coordenação, ao NDE e à gestão.' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'revision',r.revision,'title',r.title,'discipline',r.discipline,
    'semester',r.semester,'questionCount',r.question_count,'mine',r.created_by=uid,
    'submittedAt',(select max(v.created_at) from public.vertice_avalia_reviews v where v.draft_id=r.id and v.action='submitted'))
    order by r.updated_at)
   from public.vertice_avalia_drafts r
   where r.institution_id=p_institution and r.course_id=p_course and r.status='submitted'),'[]'::jsonb);
 end if;

 if p_action='indicators' then
  if not validator then raise exception 'Indicadores restritos à coordenação, ao NDE e à gestão.' using errcode='42501'; end if;
  return (with ev as (
    select * from public.vertice_avalia_reviews v where v.institution_id=p_institution and v.course_id=p_course
   ), decided as (
    select e.*, (select max(s.created_at) from ev s where s.draft_id=e.draft_id and s.action='submitted' and s.created_at<=e.created_at) submitted_at
    from ev e where e.action in ('validated','returned')
   )
   select jsonb_build_object(
    'drafts',(select count(*) from public.vertice_avalia_drafts r where r.institution_id=p_institution and r.course_id=p_course),
    'inDraft',(select count(*) from public.vertice_avalia_drafts r where r.institution_id=p_institution and r.course_id=p_course and r.status='draft'),
    'awaiting',(select count(*) from public.vertice_avalia_drafts r where r.institution_id=p_institution and r.course_id=p_course and r.status='submitted'),
    'validated',(select count(*) from public.vertice_avalia_drafts r where r.institution_id=p_institution and r.course_id=p_course and r.status='validated'),
    'validatedQuestions',(select coalesce(sum(r.question_count),0) from public.vertice_avalia_drafts r where r.institution_id=p_institution and r.course_id=p_course and r.status='validated'),
    'decisions',(select count(*) from decided),
    'returns',(select count(*) from decided where action='returned'),
    'avgReviewHours',(select round((avg(extract(epoch from created_at-submitted_at))/3600)::numeric,1) from decided where submitted_at is not null),
    'returnReasons',coalesce((select jsonb_object_agg(reason,n) from (select unnest(decided.reasons) reason,count(*) n from decided where action='returned' group by 1) x),'{}'::jsonb)
   ));
 end if;

 select * into d from public.vertice_avalia_drafts r
  where r.id::text=p_payload->>'id' and r.institution_id=p_institution and r.course_id=p_course
  for update;
 if not found or not (d.created_by=uid or validator) then
  raise exception 'Caderno não localizado neste curso.' using errcode='P0002';
 end if;

 if p_action='history' then
  return coalesce((select jsonb_agg(jsonb_build_object('action',v.action,'revision',v.revision,'justification',v.justification,
    'reasons',to_jsonb(v.reasons),'byAuthor',v.actor=d.created_by,'createdAt',v.created_at) order by v.created_at)
   from public.vertice_avalia_reviews v where v.draft_id=d.id),'[]'::jsonb);
 end if;

 expected := nullif(p_payload->>'expectedRevision','')::integer;
 if expected is null or expected<>d.revision then
  raise exception 'O caderno mudou (versão atual %). Reabra antes de prosseguir.', d.revision using errcode='40001';
 end if;

 if p_action='submit' then
  if d.created_by<>uid then raise exception 'Somente o autor envia o caderno para validação.' using errcode='42501'; end if;
  if d.status<>'draft' then raise exception 'O caderno não está em rascunho.' using errcode='23514'; end if;
  blocking := vertice_private.avalia_blocking_issues(d.snapshot);
  if cardinality(blocking)>0 then
   raise exception 'Corrija os bloqueios do checklist antes de enviar: %', array_to_string(blocking,', ') using errcode='23514';
  end if;
  if p_payload ? 'checklist' and (jsonb_typeof(p_payload->'checklist')<>'object' or octet_length((p_payload->'checklist')::text)>60000) then
   raise exception 'Resumo do checklist inválido.' using errcode='22023';
  end if;
  insert into public.vertice_avalia_reviews(draft_id,institution_id,course_id,revision,action,actor,checklist)
  values(d.id,d.institution_id,d.course_id,d.revision,'submitted',uid,p_payload->'checklist');
  update public.vertice_avalia_drafts set status='submitted',updated_at=now(),updated_by=uid where id=d.id returning * into d;
  return jsonb_build_object('id',d.id,'revision',d.revision,'status',d.status);
 end if;

 if p_action in ('validate','return') then
  if not validator then raise exception 'Decisão restrita à coordenação, ao NDE e à gestão.' using errcode='42501'; end if;
  if d.created_by=uid then raise exception 'Quem elaborou o caderno não pode validá-lo.' using errcode='42501'; end if;
  if d.status<>'submitted' then raise exception 'O caderno não está aguardando validação.' using errcode='23514'; end if;
  if just is null or length(just)<10 then raise exception 'Justifique a decisão (mínimo de 10 caracteres).' using errcode='22023'; end if;
  begin
   v_reasons := coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'reasons','[]'::jsonb))),'{}');
  exception when others then raise exception 'Motivos inválidos.' using errcode='22023'; end;
  if p_action='return' and cardinality(v_reasons)=0 then raise exception 'Indique ao menos um motivo da devolução.' using errcode='22023'; end if;
  if p_action='validate' then
   blocking := vertice_private.avalia_blocking_issues(d.snapshot);
   if cardinality(blocking)>0 then raise exception 'Caderno com bloqueios não pode ser validado.' using errcode='23514'; end if;
  end if;
  insert into public.vertice_avalia_reviews(draft_id,institution_id,course_id,revision,action,actor,justification,reasons)
  values(d.id,d.institution_id,d.course_id,d.revision,case when p_action='validate' then 'validated' else 'returned' end,uid,left(just,4000),v_reasons);
  update public.vertice_avalia_drafts set status=case when p_action='validate' then 'validated' else 'draft' end,
   updated_at=now(),updated_by=uid where id=d.id returning * into d;
  return jsonb_build_object('id',d.id,'revision',d.revision,'status',d.status);
 end if;

 raise exception 'Ação inválida.' using errcode='22023';
end $$;
revoke all on function public.vertice_avalia_review(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.vertice_avalia_review(uuid,uuid,text,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
