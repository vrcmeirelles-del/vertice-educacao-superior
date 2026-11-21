-- Avalia 360° — aplicação da prova e lançamento de respostas.
-- A aplicação congela a versão VALIDADA do caderno e o mapa de cada versão
-- impressa (ordem das questões e das alternativas). O servidor confere que
-- o mapa é permutação exata do caderno e corrige pelo gabarito gravado:
-- o navegador nunca informa acerto, erro ou nota das objetivas.
begin;

create table public.vertice_avalia_applications (
 id uuid primary key default gen_random_uuid(),
 draft_id uuid not null references public.vertice_avalia_drafts(id) on delete restrict,
 revision integer not null,
 institution_id uuid not null references public.vertice_institutions(id) on delete restrict,
 course_id uuid not null references public.vertice_courses(id) on delete restrict,
 discipline text not null,
 class_label text not null check (length(btrim(class_label)) between 1 and 80),
 applied_on date not null,
 variant_map jsonb not null,
 variant_count smallint not null check (variant_count between 1 and 12),
 status text not null default 'open' check (status in ('open','closed')),
 created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 closed_at timestamptz,
 constraint avalia_application_closed check ((status='closed')=(closed_at is not null))
);
create index vertice_avalia_applications_draft on public.vertice_avalia_applications(draft_id, applied_on desc);
create index vertice_avalia_applications_course on public.vertice_avalia_applications(institution_id, course_id, applied_on desc);

create table public.vertice_avalia_sheets (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.vertice_avalia_applications(id) on delete restrict,
 student_id uuid references public.vertice_student_registry(id) on delete restrict,
 student_label text check (student_label is null or length(btrim(student_label)) between 1 and 120),
 student_key text not null,
 variant text not null check (variant ~ '^[A-L]$'),
 total_score numeric(8,2) not null,
 max_score numeric(8,2) not null,
 entered_by uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default now(),
 constraint avalia_sheet_identity check (student_id is not null or student_label is not null),
 unique (application_id, student_key)
);
comment on column public.vertice_avalia_sheets.student_label is 'Identificação livre (código ou pseudônimo) só quando o aluno não está vinculado ao cadastro.';

create table public.vertice_avalia_item_scores (
 sheet_id uuid not null references public.vertice_avalia_sheets(id) on delete cascade,
 application_id uuid not null references public.vertice_avalia_applications(id) on delete restrict,
 question_id text not null,
 kind text not null check (kind in ('objetiva','discursiva')),
 display_number smallint not null,
 chosen_label text check (chosen_label is null or chosen_label ~ '^[A-Z]$'),
 chosen_option text,
 outcome text not null check (outcome in ('correct','wrong','blank','multiple','scored','pending')),
 score numeric(8,2),
 max_score numeric(8,2) not null,
 primary key (sheet_id, question_id)
);
create index vertice_avalia_item_scores_app on public.vertice_avalia_item_scores(application_id, question_id);

do $$ declare t text; begin
 foreach t in array array['vertice_avalia_applications','vertice_avalia_sheets','vertice_avalia_item_scores'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from public, anon, authenticated', t);
 end loop;
end $$;
create trigger avalia_applications_audit after insert or update on public.vertice_avalia_applications for each row execute function vertice_private.audit_change();
create trigger avalia_sheets_audit after insert or update on public.vertice_avalia_sheets for each row execute function vertice_private.audit_change();

-- O mapa é válido se cada versão contém exatamente as questões do caderno e,
-- nas objetivas, uma permutação exata das alternativas.
create function vertice_private.avalia_valid_variant_map(p_snapshot jsonb,p_map jsonb,p_count integer)
returns boolean language plpgsql immutable set search_path='' as $$
declare code text; items jsonb; qs jsonb := p_snapshot->'questions';
begin
 if jsonb_typeof(p_map) is distinct from 'object' or p_count not between 1 and 12 then return false; end if;
 if (select count(*) from jsonb_object_keys(p_map)) <> p_count then return false; end if;
 for i in 0..p_count-1 loop
  code := chr(65+i);
  items := p_map->code;
  if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) <> jsonb_array_length(qs) then return false; end if;
  -- mesmas questões, cada uma uma vez
  if (select count(distinct it->>'q') from jsonb_array_elements(items) it) <> jsonb_array_length(qs)
    or exists(select 1 from jsonb_array_elements(items) it
              where not exists(select 1 from jsonb_array_elements(qs) q where q->>'id'=it->>'q')) then return false; end if;
  -- alternativas: permutação exata nas objetivas, vazio nas discursivas
  if exists(
   select 1 from jsonb_array_elements(items) it join jsonb_array_elements(qs) q on q->>'id'=it->>'q'
   where jsonb_typeof(it->'o') is distinct from 'array'
      or (q->>'kind'='discursiva' and jsonb_array_length(it->'o')<>0)
      or (q->>'kind'='objetiva' and (
           jsonb_array_length(it->'o') <> jsonb_array_length(q->'options')
        or (select count(distinct x) from jsonb_array_elements_text(it->'o') x) <> jsonb_array_length(q->'options')
        or exists(select 1 from jsonb_array_elements_text(it->'o') x
                  where not exists(select 1 from jsonb_array_elements(q->'options') o where o->>'id'=x))))
  ) then return false; end if;
 end loop;
 return true;
end $$;

create function vertice_private.avalia_application_access(p_application uuid, p_write boolean)
returns public.vertice_avalia_applications language plpgsql stable security definer set search_path='' as $$
declare a public.vertice_avalia_applications; d public.vertice_avalia_drafts;
begin
 select * into a from public.vertice_avalia_applications where id=p_application;
 if not found or not vertice_private.avalia_access(a.institution_id,a.course_id,'record') then
  raise exception 'Aplicação não localizada.' using errcode='P0002';
 end if;
 select * into d from public.vertice_avalia_drafts where id=a.draft_id;
 if not (d.created_by=auth.uid() or a.created_by=auth.uid() or vertice_private.avalia_access(a.institution_id,a.course_id,'validate')) then
  raise exception 'Aplicação não localizada.' using errcode='P0002';
 end if;
 if p_write and a.status<>'open' then raise exception 'Aplicação encerrada: lançamentos bloqueados.' using errcode='23514'; end if;
 return a;
end $$;
revoke all on function vertice_private.avalia_application_access(uuid,boolean) from public,anon,authenticated;

-- Corrige uma folha: mapeia a letra marcada (posição impressa) para a alternativa original.
create function vertice_private.avalia_score_sheet(p_sheet uuid, p_app public.vertice_avalia_applications,
 p_snapshot jsonb, p_variant text, p_objective jsonb, p_discursive jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare it record; q jsonb; mark text; pts numeric; chosen text; given numeric;
begin
 delete from public.vertice_avalia_item_scores where sheet_id=p_sheet;
 for it in select value v, ordinality::int n from jsonb_array_elements(p_app.variant_map->p_variant) with ordinality loop
  select x into q from jsonb_array_elements(p_snapshot->'questions') x where x->>'id'=it.v->>'q';
  pts := coalesce((q->>'points')::numeric,0);
  if q->>'kind'='objetiva' then
   mark := upper(btrim(coalesce(p_objective->>(it.n::text),'')));
   if mark in ('','-','.','_') then
    insert into public.vertice_avalia_item_scores values(p_sheet,p_app.id,q->>'id','objetiva',it.n,null,null,'blank',0,pts);
   elsif mark in ('*','X','#') or length(mark)>1 then
    insert into public.vertice_avalia_item_scores values(p_sheet,p_app.id,q->>'id','objetiva',it.n,null,null,'multiple',0,pts);
   elsif ascii(mark)-65 between 0 and jsonb_array_length(it.v->'o')-1 then
    chosen := it.v->'o'->>(ascii(mark)-65);
    insert into public.vertice_avalia_item_scores values(p_sheet,p_app.id,q->>'id','objetiva',it.n,mark,chosen,
     case when chosen=q->>'correctOptionId' then 'correct' else 'wrong' end,
     case when chosen=q->>'correctOptionId' then pts else 0 end,pts);
   else
    raise exception 'Questão %: alternativa "%" não existe nesta versão.', it.n, mark using errcode='22023';
   end if;
  else
   if p_discursive ? (q->>'id') and jsonb_typeof(p_discursive->(q->>'id'))='number' then
    given := (p_discursive->>(q->>'id'))::numeric;
    if given<0 or given>pts then raise exception 'Questão %: nota % fora do intervalo 0–%.', it.n, given, pts using errcode='22023'; end if;
    insert into public.vertice_avalia_item_scores values(p_sheet,p_app.id,q->>'id','discursiva',it.n,null,null,'scored',round(given,2),pts);
   else
    insert into public.vertice_avalia_item_scores values(p_sheet,p_app.id,q->>'id','discursiva',it.n,null,null,'pending',null,pts);
   end if;
  end if;
 end loop;
 update public.vertice_avalia_sheets s set
  total_score=(select coalesce(sum(score),0) from public.vertice_avalia_item_scores where sheet_id=p_sheet),
  max_score=(select coalesce(sum(max_score),0) from public.vertice_avalia_item_scores where sheet_id=p_sheet)
 where s.id=p_sheet;
end $$;
revoke all on function vertice_private.avalia_score_sheet(uuid,public.vertice_avalia_applications,jsonb,text,jsonb,jsonb) from public,anon,authenticated;

create function public.vertice_avalia_application(p_institution uuid,p_course uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid := auth.uid();
 a public.vertice_avalia_applications; d public.vertice_avalia_drafts;
 row_in jsonb; sid uuid; skey text; label text; variant text; sheet uuid; saved integer := 0;
 cnt integer; applied date;
begin
 if uid is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Aplicações restritas à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Requisição inválida.' using errcode='22023'; end if;

 if p_action='create' then
  select * into d from public.vertice_avalia_drafts r
   where r.id::text=p_payload->>'draftId' and r.institution_id=p_institution and r.course_id=p_course;
  if not found or not (d.created_by=uid or vertice_private.avalia_access(p_institution,p_course,'validate')) then
   raise exception 'Caderno não localizado neste curso.' using errcode='P0002';
  end if;
  if d.status<>'validated' then raise exception 'Somente caderno validado pelo colegiado pode ser aplicado.' using errcode='23514'; end if;
  if nullif(p_payload->>'expectedRevision','')::integer is distinct from d.revision then
   raise exception 'Versão do caderno divergente (atual %).', d.revision using errcode='40001';
  end if;
  cnt := nullif(p_payload->>'variantCount','')::integer;
  if not vertice_private.avalia_valid_variant_map(d.snapshot,p_payload->'variantMap',coalesce(cnt,0)) then
   raise exception 'Mapa de versões inválido: cada versão deve conter todas as questões e alternativas do caderno validado.' using errcode='22023';
  end if;
  begin applied := (p_payload->>'appliedOn')::date; exception when others then applied := null; end;
  if applied is null or applied > current_date + 1 or applied < current_date - 730 then
   raise exception 'Informe a data de aplicação.' using errcode='22023';
  end if;
  insert into public.vertice_avalia_applications(draft_id,revision,institution_id,course_id,discipline,class_label,applied_on,variant_map,variant_count,created_by)
  values(d.id,d.revision,d.institution_id,d.course_id,d.discipline,left(btrim(coalesce(p_payload->>'classLabel','')),80),applied,p_payload->'variantMap',cnt,uid)
  returning * into a;
  return jsonb_build_object('id',a.id,'status',a.status);
 end if;

 if p_action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'draftId',x.draft_id,'revision',x.revision,'title',r.title,
    'discipline',x.discipline,'classLabel',x.class_label,'appliedOn',x.applied_on,'variantCount',x.variant_count,'status',x.status,
    'sheets',(select count(*) from public.vertice_avalia_sheets s where s.application_id=x.id)) order by x.applied_on desc, x.created_at desc)
   from public.vertice_avalia_applications x join public.vertice_avalia_drafts r on r.id=x.draft_id
   where x.institution_id=p_institution and x.course_id=p_course
     and (nullif(p_payload->>'draftId','') is null or x.draft_id::text=p_payload->>'draftId')
     and (r.created_by=uid or x.created_by=uid or vertice_private.avalia_access(p_institution,p_course,'validate'))),'[]'::jsonb);
 end if;

 a := vertice_private.avalia_application_access(nullif(p_payload->>'id','')::uuid, p_action in ('save_sheets','delete_sheet','close'));
 if a.institution_id<>p_institution or a.course_id<>p_course then raise exception 'Aplicação não localizada.' using errcode='P0002'; end if;
 select * into d from public.vertice_avalia_drafts where id=a.draft_id;
 -- Corrige pela versão aplicada (histórico imutável), não pela vigente.
 d.snapshot := (select v.snapshot from public.vertice_avalia_draft_revisions v where v.draft_id=a.draft_id and v.revision=a.revision);

 if p_action='get' then
  return jsonb_build_object(
   'id',a.id,'draftId',a.draft_id,'revision',a.revision,'title',d.title,'discipline',a.discipline,'classLabel',a.class_label,
   'appliedOn',a.applied_on,'variantCount',a.variant_count,'variantMap',a.variant_map,'status',a.status,
   'questions',(select jsonb_agg(jsonb_build_object('id',q->>'id','kind',q->>'kind','points',(q->>'points')::numeric,
      'statement',left(q->>'statement',160)) order by n) from jsonb_array_elements(d.snapshot->'questions') with ordinality t(q,n)),
   'sheets',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'studentId',s.student_id,
      'label',coalesce(st.full_name,s.student_label),'enrollment',st.enrollment_code,'variant',s.variant,
      'total',s.total_score,'max',s.max_score,'updatedAt',s.updated_at,
      'items',(select jsonb_agg(jsonb_build_object('q',i.question_id,'n',i.display_number,'kind',i.kind,'mark',i.chosen_label,
         'outcome',i.outcome,'score',i.score,'max',i.max_score) order by i.display_number)
       from public.vertice_avalia_item_scores i where i.sheet_id=s.id)) order by lower(coalesce(st.full_name,s.student_label)))
     from public.vertice_avalia_sheets s left join public.vertice_student_registry st on st.id=s.student_id
     where s.application_id=a.id),'[]'::jsonb));
 end if;

 if p_action='save_sheets' then
  if jsonb_typeof(p_payload->'sheets') is distinct from 'array' or jsonb_array_length(p_payload->'sheets') not between 1 and 400 then
   raise exception 'Envie entre 1 e 400 folhas por vez.' using errcode='22023';
  end if;
  for row_in in select value from jsonb_array_elements(p_payload->'sheets') loop
   variant := upper(btrim(coalesce(row_in->>'variant','A')));
   if not (a.variant_map ? variant) then raise exception 'Versão "%" não existe nesta aplicação.', variant using errcode='22023'; end if;
   sid := null; label := null;
   if nullif(row_in->>'studentId','') is not null then
    select s.id into sid from public.vertice_student_registry s
     where s.id::text=row_in->>'studentId' and s.institution_id=a.institution_id and s.course_id=a.course_id;
    if sid is null then raise exception 'Aluno fora do cadastro deste curso.' using errcode='22023'; end if;
    skey := sid::text;
   else
    label := nullif(left(btrim(coalesce(row_in->>'label','')),120),'');
    if label is null then raise exception 'Identifique cada folha (aluno do cadastro ou código).' using errcode='22023'; end if;
    skey := 'label:'||lower(label);
   end if;
   if (jsonb_typeof(coalesce(row_in->'objective','{}'::jsonb))<>'object') or (jsonb_typeof(coalesce(row_in->'discursive','{}'::jsonb))<>'object') then
    raise exception 'Respostas em formato inválido.' using errcode='22023';
   end if;
   insert into public.vertice_avalia_sheets(application_id,student_id,student_label,student_key,variant,total_score,max_score,entered_by)
   values(a.id,sid,label,skey,variant,0,0,uid)
   on conflict (application_id,student_key) do update set variant=excluded.variant,entered_by=uid,updated_at=now()
   returning id into sheet;
   perform vertice_private.avalia_score_sheet(sheet,a,d.snapshot,variant,coalesce(row_in->'objective','{}'::jsonb),coalesce(row_in->'discursive','{}'::jsonb));
   saved := saved+1;
  end loop;
  return jsonb_build_object('saved',saved);
 end if;

 if p_action='delete_sheet' then
  delete from public.vertice_avalia_sheets s where s.id::text=p_payload->>'sheetId' and s.application_id=a.id;
  if not found then raise exception 'Folha não localizada.' using errcode='P0002'; end if;
  return jsonb_build_object('deleted',1);
 end if;

 if p_action='close' then
  update public.vertice_avalia_applications set status='closed',closed_at=now() where id=a.id;
  return jsonb_build_object('id',a.id,'status','closed');
 end if;

 raise exception 'Ação inválida.' using errcode='22023';
end $$;
revoke all on function public.vertice_avalia_application(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.vertice_avalia_application(uuid,uuid,text,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
