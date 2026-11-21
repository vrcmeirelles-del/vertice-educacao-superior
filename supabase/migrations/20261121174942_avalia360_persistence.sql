-- Avalia 360° — persistência institucional de rascunhos, banco de questões,
-- mídia privada e consulta de turma. Reaproveita o escopo já homologado de
-- Atividades de Ensino (AAL2 + papel na IES + vínculo de curso).
-- Acesso exclusivamente por RPC; nenhuma tabela é legível diretamente.
begin;

-- Escopo: 'record' (docente/equipe com vínculo de curso), 'validate' (coordenação/gestão).
create function vertice_private.avalia_access(inst uuid, course uuid, mode text)
returns boolean language sql stable security definer set search_path='' as $$
 select vertice_private.teaching_access(inst, course, mode)
$$;
revoke all on function vertice_private.avalia_access(uuid,uuid,text) from public,anon;
grant execute on function vertice_private.avalia_access(uuid,uuid,text) to authenticated;

create function vertice_private.avalia_discipline(value text) returns text
language sql immutable set search_path='' as $$
 select nullif(regexp_replace(btrim(coalesce(value,'')),'\s+',' ','g'),'')
$$;

-- Rascunhos ---------------------------------------------------------------
create table public.vertice_avalia_drafts (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id) on delete restrict,
 course_id uuid not null references public.vertice_courses(id) on delete restrict,
 discipline text not null check (length(discipline) between 1 and 200),
 title text not null check (length(btrim(title)) between 3 and 250),
 semester text not null check (length(btrim(semester)) between 3 and 20),
 purpose text not null check (purpose in ('diagnostica','formativa','somativa')),
 status text not null default 'draft' check (status in ('draft','submitted','validated','archived')),
 revision integer not null default 1 check (revision >= 1),
 question_count integer not null check (question_count between 1 and 200),
 curriculum_build_id uuid,
 snapshot jsonb not null,
 created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
create index vertice_avalia_drafts_scope on public.vertice_avalia_drafts(institution_id,course_id,lower(discipline),updated_at desc);
create index vertice_avalia_drafts_author on public.vertice_avalia_drafts(created_by,updated_at desc);
comment on table public.vertice_avalia_drafts is 'Avalia 360°: versão vigente do caderno. Gabaritos e respostas esperadas são sigilosos; leitura só por RPC.';

create table public.vertice_avalia_draft_revisions (
 draft_id uuid not null references public.vertice_avalia_drafts(id) on delete restrict,
 revision integer not null,
 snapshot jsonb not null,
 saved_by uuid not null references auth.users(id) on delete restrict,
 saved_at timestamptz not null default now(),
 primary key (draft_id, revision)
);
comment on table public.vertice_avalia_draft_revisions is 'Histórico imutável das versões salvas de cada caderno do Avalia 360°.';

-- Mídia privada -------------------------------------------------------------
create table public.vertice_avalia_media (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id) on delete restrict,
 course_id uuid not null references public.vertice_courses(id) on delete restrict,
 discipline text not null check (length(discipline) between 1 and 200),
 question_id text not null check (length(question_id) between 1 and 80),
 path text not null unique,
 sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
 mime text not null check (mime in ('image/png','image/jpeg','image/webp')),
 size_bytes integer not null check (size_bytes between 1 and 10485760),
 status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
 created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 confirmed_at timestamptz,
 constraint avalia_media_confirmation check ((status='confirmed')=(confirmed_at is not null))
);
create index vertice_avalia_media_author on public.vertice_avalia_media(created_by,created_at desc);
comment on table public.vertice_avalia_media is 'Imagens das questões. Confirmação só pelo serviço vertice-avalia-media após conferir bytes armazenados.';

-- Banco de questões ---------------------------------------------------------
create table public.vertice_avalia_bank (
 id uuid primary key,
 institution_id uuid not null references public.vertice_institutions(id) on delete restrict,
 course_id uuid not null references public.vertice_courses(id) on delete restrict,
 discipline text not null check (length(discipline) between 1 and 200),
 revision integer not null default 1,
 status text not null default 'rascunho' check (status in ('rascunho','em_curadoria','validada')),
 record jsonb not null,
 created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index vertice_avalia_bank_scope on public.vertice_avalia_bank(institution_id,course_id,lower(discipline),created_at desc);
comment on table public.vertice_avalia_bank is 'Banco de Questões do Avalia 360°. Registros imutáveis; reutilizar gera cópia na avaliação.';

do $$ declare t text; begin
 foreach t in array array['vertice_avalia_drafts','vertice_avalia_draft_revisions','vertice_avalia_media','vertice_avalia_bank'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from public, anon, authenticated', t);
 end loop;
end $$;

create trigger avalia_drafts_audit after insert or update on public.vertice_avalia_drafts for each row execute function vertice_private.audit_change();
create trigger avalia_bank_audit after insert on public.vertice_avalia_bank for each row execute function vertice_private.audit_change();
create trigger avalia_media_audit after insert or update on public.vertice_avalia_media for each row execute function vertice_private.audit_change();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avalia360-private','avalia360-private',false,10485760,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Validação das imagens citadas no caderno ----------------------------------
create function vertice_private.avalia_check_images(p_institution uuid,p_course uuid,p_discipline text,p_questions jsonb)
returns void language plpgsql stable security definer set search_path='' as $$
declare q jsonb; img jsonb;
begin
 for q in select value from jsonb_array_elements(p_questions) loop
  if jsonb_typeof(q->'images') is distinct from 'array' then
   raise exception 'Questão sem lista de imagens.' using errcode='22023';
  end if;
  for img in select value from jsonb_array_elements(q->'images') loop
   perform 1 from public.vertice_avalia_media m
    where m.id::text = img->>'imageId' and m.path = img->>'path' and m.sha256 = img->>'sha256'
      and m.status='confirmed' and m.institution_id=p_institution and m.course_id=p_course
      and lower(m.discipline)=lower(p_discipline) and m.question_id = q->>'id';
   if not found then
    raise exception 'Imagem não confirmada no armazenamento privado desta disciplina.' using errcode='22023';
   end if;
  end loop;
 end loop;
end $$;
revoke all on function vertice_private.avalia_check_images(uuid,uuid,text,jsonb) from public,anon,authenticated;

-- RPC de rascunhos: create | update | get | list ----------------------------
create function public.vertice_avalia_draft(p_institution uuid,p_course uuid,p_discipline text,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid := auth.uid();
 disc text := vertice_private.avalia_discipline(p_discipline);
 meta jsonb := coalesce(p_payload->'meta','{}'::jsonb);
 qs jsonb := p_payload->'questions';
 build uuid; d public.vertice_avalia_drafts; snap jsonb; expected integer;
begin
 if uid is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Avalia 360° restrito à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 if disc is null or length(disc)>200 then raise exception 'Informe a disciplina.' using errcode='22023'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Requisição inválida.' using errcode='22023'; end if;

 if p_action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'revision',x.revision,'status',x.status,'title',x.title,
     'semester',x.semester,'questionCount',x.question_count,'updatedAt',x.updated_at) order by x.updated_at desc)
   from (select * from public.vertice_avalia_drafts r
         where r.institution_id=p_institution and r.course_id=p_course and lower(r.discipline)=lower(disc)
           and (r.created_by=uid or vertice_private.avalia_access(p_institution,p_course,'validate'))
         order by r.updated_at desc limit 50) x),'[]'::jsonb);
 end if;

 if p_action='get' then
  select * into d from public.vertice_avalia_drafts r
   where r.id::text=p_payload->>'id' and r.institution_id=p_institution and r.course_id=p_course
     and lower(r.discipline)=lower(disc)
     and (r.created_by=uid or vertice_private.avalia_access(p_institution,p_course,'validate'));
  if not found then raise exception 'Rascunho não localizado neste curso e disciplina.' using errcode='P0002'; end if;
  return jsonb_build_object('id',d.id,'revision',d.revision,'status',d.status,'snapshot',d.snapshot);
 end if;

 if p_action not in ('create','update') then raise exception 'Ação inválida.' using errcode='22023'; end if;
 if octet_length(p_payload::text) > 1500000 then raise exception 'Caderno excede o limite de 1,5 MB de texto.' using errcode='54000'; end if;
 if jsonb_typeof(qs) is distinct from 'array' or jsonb_array_length(qs) not between 1 and 200 then
  raise exception 'Envie entre 1 e 200 questões.' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_array_elements(qs) e where jsonb_typeof(e.value)<>'object'
   or coalesce(e.value->>'id','')='' or length(e.value->>'id')>80
   or lower(vertice_private.avalia_discipline(e.value->>'disciplineId')) is distinct from lower(disc)
   or coalesce(e.value->>'kind','') not in ('objetiva','discursiva')
   or length(btrim(coalesce(e.value->>'statement','')))<10) then
  raise exception 'Questões incompletas ou de outra disciplina.' using errcode='22023';
 end if;
 if (select count(distinct e.value->>'id') from jsonb_array_elements(qs) e) <> jsonb_array_length(qs) then
  raise exception 'Identificadores de questão repetidos.' using errcode='22023';
 end if;
 if coalesce(length(btrim(meta->>'title')),0) < 3 or coalesce(length(btrim(meta->>'semester')),0) < 3
   or coalesce(meta->>'purpose','') not in ('diagnostica','formativa','somativa') then
  raise exception 'Informe título, semestre e finalidade da avaliação.' using errcode='22023';
 end if;
 perform vertice_private.avalia_check_images(p_institution,p_course,disc,qs);

 if nullif(p_payload->>'buildId','') is not null then
  select b.id into build from vertice_app.curriculum_builds b
   where b.id::text=p_payload->>'buildId' and b.institution_id=p_institution and b.course_id=p_course and b.status='published';
  if not found then raise exception 'Matriz curricular não publicada para este curso.' using errcode='22023'; end if;
 end if;

 snap := jsonb_build_object('questions',qs,'meta',meta,'curriculumStatus',case when build is null then 'pending' else 'linked' end);

 if p_action='create' then
  if (select count(*) from public.vertice_avalia_drafts r where r.created_by=uid and r.created_at>now()-interval '1 day') >= 200 then
   raise exception 'Limite diário de novos cadernos atingido.' using errcode='54000';
  end if;
  insert into public.vertice_avalia_drafts(institution_id,course_id,discipline,title,semester,purpose,question_count,curriculum_build_id,snapshot,created_by,updated_by)
  values(p_institution,p_course,disc,left(btrim(meta->>'title'),250),left(btrim(meta->>'semester'),20),meta->>'purpose',
         jsonb_array_length(qs),build,snap,uid,uid)
  returning * into d;
 else
  expected := nullif(p_payload->>'expectedRevision','')::integer;
  select * into d from public.vertice_avalia_drafts r
   where r.id::text=p_payload->>'id' and r.institution_id=p_institution and r.course_id=p_course
     and lower(r.discipline)=lower(disc) and r.created_by=uid
   for update;
  if not found then raise exception 'Rascunho não localizado ou de outra autoria.' using errcode='P0002'; end if;
  if d.status<>'draft' then raise exception 'Somente rascunhos podem ser alterados.' using errcode='23514'; end if;
  if expected is null or expected<>d.revision then
   raise exception 'Este caderno foi alterado em outra sessão (versão atual %). Reabra antes de salvar.', d.revision using errcode='40001';
  end if;
  update public.vertice_avalia_drafts set title=left(btrim(meta->>'title'),250),semester=left(btrim(meta->>'semester'),20),
   purpose=meta->>'purpose',question_count=jsonb_array_length(qs),curriculum_build_id=build,snapshot=snap,
   revision=d.revision+1,updated_by=uid,updated_at=now()
  where id=d.id returning * into d;
 end if;
 insert into public.vertice_avalia_draft_revisions(draft_id,revision,snapshot,saved_by) values(d.id,d.revision,snap,uid);
 return jsonb_build_object('id',d.id,'revision',d.revision,'status',d.status);
end $$;
revoke all on function public.vertice_avalia_draft(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.vertice_avalia_draft(uuid,uuid,text,text,jsonb) to authenticated;

-- RPC do Banco de Questões: save | list -------------------------------------
create function public.vertice_avalia_bank(p_institution uuid,p_course uuid,p_discipline text,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); disc text := vertice_private.avalia_discipline(p_discipline);
 rec jsonb := p_payload->'record'; q jsonb := rec->'question'; bid uuid; saved public.vertice_avalia_bank;
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
 if (select count(*) from public.vertice_avalia_bank b where b.created_by=uid and b.created_at>now()-interval '1 day') >= 500 then
  raise exception 'Limite diário do Banco de Questões atingido.' using errcode='54000';
 end if;
 insert into public.vertice_avalia_bank(id,institution_id,course_id,discipline,record,created_by)
 values(bid,p_institution,p_course,disc,
  jsonb_build_object('question',q,'indexLabels',coalesce(rec->'indexLabels','[]'::jsonb)) ||
  case when rec ? 'sourceAssessmentId' then jsonb_build_object('sourceAssessmentId',rec->'sourceAssessmentId') else '{}'::jsonb end,
  uid)
 on conflict (id) do nothing returning * into saved;
 if saved.id is null then raise exception 'Identificador já utilizado no Banco de Questões.' using errcode='23505'; end if;
 return saved.record || jsonb_build_object('bankId',saved.id,'revision',saved.revision,'status',saved.status,
  'institutionId',saved.institution_id,'courseId',saved.course_id,'discipline',saved.discipline,'createdAt',saved.created_at);
end $$;
revoke all on function public.vertice_avalia_bank(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.vertice_avalia_bank(uuid,uuid,text,text,jsonb) to authenticated;

-- Preparação do upload (chamada pelo serviço com o JWT do docente) ------------
create function public.vertice_avalia_media_prepare(p_institution uuid,p_course uuid,p_discipline text,p_question text,
 p_sha256 text,p_mime text,p_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); disc text := vertice_private.avalia_discipline(p_discipline); mid uuid := gen_random_uuid(); p text;
begin
 if uid is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Envio de imagem restrito à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 if disc is null or coalesce(p_question,'')='' then raise exception 'Escopo da imagem incompleto.' using errcode='22023'; end if;
 if (select count(*) from public.vertice_avalia_media m where m.created_by=uid and m.created_at>now()-interval '1 day') >= 300 then
  raise exception 'Limite diário de imagens atingido.' using errcode='54000';
 end if;
 p := p_institution::text||'/'||p_course::text||'/'||mid::text||case p_mime when 'image/png' then '.png' when 'image/jpeg' then '.jpg' else '.webp' end;
 insert into public.vertice_avalia_media(id,institution_id,course_id,discipline,question_id,path,sha256,mime,size_bytes,created_by)
 values(mid,p_institution,p_course,disc,left(p_question,80),p,lower(p_sha256),p_mime,p_size,uid);
 return jsonb_build_object('imageId',mid,'path',p);
end $$;
revoke all on function public.vertice_avalia_media_prepare(uuid,uuid,text,text,text,text,integer) from public,anon;
grant execute on function public.vertice_avalia_media_prepare(uuid,uuid,text,text,text,text,integer) to authenticated;

-- Consulta de turma (lista nominal para impressão) ---------------------------
-- A "turma" é o período corrente do cadastro acadêmico verificado (ex.: "3", "3º período").
create function public.vertice_avalia_class_roster(p_institution uuid,p_course uuid,p_discipline text,p_class text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare period smallint;
begin
 if auth.uid() is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Lista da turma restrita à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 if vertice_private.avalia_discipline(p_discipline) is null then raise exception 'Informe a disciplina.' using errcode='22023'; end if;
 period := nullif(substring(coalesce(p_class,'') from '(\d{1,2})'),'')::smallint;
 if period is null or period not between 1 and 20 then
  raise exception 'Informe a turma pelo período (ex.: 3 ou 3º período).' using errcode='22023';
 end if;
 return jsonb_build_object('registrationVerified',false,'students',coalesce((
  select jsonb_agg(jsonb_build_object('id',s.id,'name',s.full_name) order by lower(s.full_name),s.id)
  from public.vertice_student_registry s
  where s.institution_id=p_institution and s.course_id=p_course and s.academic_status='active' and s.verified
    and s.current_semester=period),'[]'::jsonb));
end $$;
revoke all on function public.vertice_avalia_class_roster(uuid,uuid,text,text) from public,anon;
grant execute on function public.vertice_avalia_class_roster(uuid,uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
