-- Discursiva 360: private storage; portal Auth/MFA and explicit course scope.
begin;
create schema if not exists vertice_discursiva;
revoke all on schema vertice_discursiva from public,anon,authenticated;
create table vertice_discursiva.questions(
 id uuid primary key default gen_random_uuid(), institution_id uuid not null,course_id uuid not null,
 discipline text not null check(length(discipline) between 2 and 200),content jsonb not null,
 status text not null default 'draft' check(status in ('draft','approved','archived')),
 created_by uuid not null,reviewed_by uuid,created_at timestamptz not null default now(),
 foreign key(course_id,institution_id) references public.vertice_courses(id,institution_id)
);
create table vertice_discursiva.exams(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null,course_id uuid not null,
 title text not null check(length(title) between 2 and 200),student_ref text not null check(length(student_ref) between 1 and 100),
 snapshot jsonb not null,created_by uuid not null,created_at timestamptz not null default now(),
 foreign key(course_id,institution_id) references public.vertice_courses(id,institution_id)
);
create table vertice_discursiva.submissions(
 id uuid primary key default gen_random_uuid(),exam_id uuid not null references vertice_discursiva.exams(id),
 question_id uuid not null,answer text not null check(length(answer) between 1 and 30000),
 image_path text,ocr_evidence jsonb not null default '{}',transcription_confirmed boolean not null default false,
 ai_assessment jsonb,final_score numeric check(final_score between 0 and 10),
 final_feedback text,reviewed_by uuid,reviewed_at timestamptz,created_by uuid not null,
 created_at timestamptz not null default now(),version integer not null default 1,
 check(final_score is null or (reviewed_by is not null and reviewed_at is not null))
);
create table vertice_discursiva.audit(
 id bigint generated always as identity primary key,institution_id uuid not null,course_id uuid not null,
 actor uuid not null,action text not null,record_id uuid not null,created_at timestamptz not null default now()
);
create index on vertice_discursiva.questions(institution_id,course_id,created_at desc);
create index on vertice_discursiva.exams(institution_id,course_id,created_at desc);
create index on vertice_discursiva.submissions(exam_id,created_at desc);
alter table vertice_discursiva.questions enable row level security;
alter table vertice_discursiva.exams enable row level security;
alter table vertice_discursiva.submissions enable row level security;
alter table vertice_discursiva.audit enable row level security;

create function vertice_discursiva.authorize(inst uuid,course uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal'='aal2',false)
 and exists(select 1 from public.vertice_courses where id=course and institution_id=inst)
 and coalesce(vertice_private.member_role(inst) in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador')
 or (vertice_private.member_role(inst) in ('coordenador','nde') and exists(
 select 1 from public.vertice_learning_staff_scope where user_id=auth.uid() and institution_id=inst and course_id=course and active)),false);
$$;
revoke all on function vertice_discursiva.authorize(uuid,uuid) from public,anon,authenticated;

create function public.vertice_discursiva(p_institution_id uuid,p_course_id uuid,p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare
 actor uuid:=auth.uid();rec uuid;v jsonb;item jsonb;total numeric;n integer;ex vertice_discursiva.exams;sub vertice_discursiva.submissions;
begin
 if not vertice_discursiva.authorize(p_institution_id,p_course_id) then raise exception 'Acesso ao curso ou MFA pendente' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>300000 then raise exception 'Conteúdo inválido' using errcode='22023';end if;
 if p_action='list' then
 return jsonb_build_object('questions',coalesce((select jsonb_agg(to_jsonb(q) order by created_at desc) from (select * from vertice_discursiva.questions where institution_id=p_institution_id and course_id=p_course_id order by created_at desc limit 200) q),'[]'),
 'exams',coalesce((select jsonb_agg(to_jsonb(e) order by created_at desc) from (select * from vertice_discursiva.exams where institution_id=p_institution_id and course_id=p_course_id order by created_at desc limit 100) e),'[]'),
 'submissions',coalesce((select jsonb_agg(to_jsonb(s) order by created_at desc) from (select s.* from vertice_discursiva.submissions s join vertice_discursiva.exams e on e.id=s.exam_id where e.institution_id=p_institution_id and e.course_id=p_course_id order by s.created_at desc limit 200)s),'[]'));
 elsif p_action='sources' then
 -- Course-authorized retrieval of actual extracted text. Catalog metadata is never evidence.
 select coalesce(jsonb_agg(to_jsonb(s)), '[]') into v from (
 with corpus as (
 select 'vertice_documents'::text source_table,d.id source_id,d.title,d.extracted_text excerpt,d.sha256 source_sha256,'ready'::text text_status
 from public.vertice_documents d where d.institution_id=p_institution_id and (d.course_id=p_course_id or (d.course_id is null and vertice_private.member_role(p_institution_id) in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador'))) and length(coalesce(d.extracted_text,''))>=30
 union all
 select 'vertice_repository_files',f.id,f.file_name,pv.extracted_text,pv.source_sha256,pv.extraction_status
 from public.vertice_repository_files f join public.vertice_repository_requests r on r.id=f.request_id and r.institution_id=f.institution_id
 join lateral(select p.* from public.vertice_doc_prevalidation p where p.repository_file_id=f.id and p.institution_id=f.institution_id and p.extraction_status in ('ready','partial') order by p.extracted_at desc,p.id desc limit 1)pv on true
 where f.institution_id=p_institution_id and (r.course_id=p_course_id or (r.course_id is null and vertice_private.member_role(p_institution_id) in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador'))) and length(coalesce(pv.extracted_text,''))>=30
 ) select source_table,source_id,title,left(excerpt,12000) excerpt,source_sha256,text_status from corpus
 where btrim(coalesce(p_payload->>'query',''))='' or to_tsvector('portuguese',title||' '||excerpt) @@ plainto_tsquery('portuguese',left(p_payload->>'query',300))
 order by title,source_id limit 30
 )s;
 return jsonb_build_object('sources',v);
 elsif p_action='save_question' then
 v:=p_payload->'content';
 if v is null or jsonb_typeof(v)<>'object' or length(coalesce(v->>'case',''))<30 or length(coalesce(v->>'command',''))<10 or length(coalesce(v->>'expectedAnswer',''))<20
 or jsonb_typeof(v->'rubric') is distinct from 'array' then raise exception 'Caso, comando, resposta e rubrica obrigatórios';end if;
 if jsonb_array_length(v->'rubric') not between 1 and 10 then raise exception 'Rubrica inválida';end if;
 total:=0;
 for item in select * from jsonb_array_elements(v->'rubric') loop
 if length(coalesce(item->>'criterion',''))<3 or jsonb_typeof(item->'points') is distinct from 'number' or (item->>'points')::numeric<=0 then raise exception 'Critério inválido';end if;
 total:=total+(item->>'points')::numeric;
 end loop;
 if total<>10 then raise exception 'Rubrica deve totalizar 10 pontos';end if;
 insert into vertice_discursiva.questions(institution_id,course_id,discipline,content,created_by)
 values(p_institution_id,p_course_id,p_payload->>'discipline',v,actor) returning id into rec;
 elsif p_action in ('approve_question','archive_question') then
 update vertice_discursiva.questions set status=case when p_action='approve_question' then 'approved' else 'archived' end,reviewed_by=actor
 where id=(p_payload->>'id')::uuid and institution_id=p_institution_id and course_id=p_course_id and status='draft' returning id into rec;
 if rec is null then raise exception 'Questão não localizada ou já revisada';end if;
 elsif p_action='create_exam' then
 if jsonb_typeof(p_payload->'question_ids') is distinct from 'array' then raise exception 'Selecione questões';end if;
 n:=jsonb_array_length(p_payload->'question_ids');
 if n not between 1 and 20 or n<>(select count(distinct x) from jsonb_array_elements_text(p_payload->'question_ids')x) then raise exception 'Selecione 1 a 20 questões distintas';end if;
 select jsonb_agg(jsonb_build_object('id',q.id,'discipline',q.discipline,'content',q.content) order by ids.ordinality) into v
 from jsonb_array_elements_text(p_payload->'question_ids') with ordinality ids(id,ordinality)
 join vertice_discursiva.questions q on q.id=ids.id::uuid and q.institution_id=p_institution_id and q.course_id=p_course_id and q.status='approved';
 if coalesce(jsonb_array_length(v),0)<>n then raise exception 'Prova exige questões homologadas deste curso';end if;
 insert into vertice_discursiva.exams(institution_id,course_id,title,student_ref,snapshot,created_by)
 values(p_institution_id,p_course_id,p_payload->>'title',p_payload->>'student_ref',v,actor) returning id into rec;
 elsif p_action='get_exam' then
 select * into ex from vertice_discursiva.exams where id=(p_payload->>'id')::uuid and institution_id=p_institution_id and course_id=p_course_id;
 if ex.id is null then raise exception 'Prova não localizada';end if;return to_jsonb(ex);
 elsif p_action='submit' then
 select * into ex from vertice_discursiva.exams where id=(p_payload->>'exam_id')::uuid and institution_id=p_institution_id and course_id=p_course_id;
 if ex.id is null or not exists(select 1 from jsonb_array_elements(ex.snapshot) x where x->>'id'=p_payload->>'question_id') then raise exception 'Questão não pertence à prova';end if;
 if nullif(p_payload->>'image_path','') is not null and (p_payload->>'image_path' not like p_institution_id::text||'/'||p_course_id::text||'/'||actor::text||'/%' or not exists(select 1 from storage.objects where bucket_id='discursiva-responses' and name=p_payload->>'image_path')) then raise exception 'Imagem fora do escopo ou não localizada';end if;
 insert into vertice_discursiva.submissions(exam_id,question_id,answer,image_path,ocr_evidence,transcription_confirmed,created_by)
 values(ex.id,(p_payload->>'question_id')::uuid,p_payload->>'answer',nullif(p_payload->>'image_path',''),coalesce(p_payload->'ocr_evidence','{}'),coalesce((p_payload->>'transcription_confirmed')::boolean,false),actor) returning id into rec;
 elsif p_action in ('get_submission','save_assessment','finalize') then
 select s.* into sub from vertice_discursiva.submissions s join vertice_discursiva.exams e on e.id=s.exam_id
 where s.id=(p_payload->>'id')::uuid and e.institution_id=p_institution_id and e.course_id=p_course_id for update of s;
 if sub.id is null then raise exception 'Resposta não localizada';end if;
 if p_action='get_submission' then
 select * into ex from vertice_discursiva.exams where id=sub.exam_id;
 return jsonb_build_object('submission',to_jsonb(sub),'question',(select x from jsonb_array_elements(ex.snapshot)x where x->>'id'=sub.question_id::text));end if;
 if sub.version is distinct from (p_payload->>'version')::integer or sub.reviewed_at is not null then raise exception 'Resposta alterada ou já homologada' using errcode='40001';end if;
 if p_action='save_assessment' then
 -- Scores here are suggestions only. A browser cannot write an authoritative AI grade.
 update vertice_discursiva.submissions set ai_assessment=p_payload->'assessment',version=version+1 where id=sub.id;
 else
 if length(coalesce(p_payload->>'feedback',''))<5 or p_payload->>'score' is null then raise exception 'Nota e justificativa docente obrigatórias';end if;
 if sub.image_path is not null and not coalesce((p_payload->>'transcription_confirmed')::boolean,false) then raise exception 'Confirme a transcrição da imagem';end if;
 update vertice_discursiva.submissions set final_score=(p_payload->>'score')::numeric,final_feedback=p_payload->>'feedback',reviewed_by=actor,reviewed_at=now(),transcription_confirmed=true,version=version+1 where id=sub.id;
 end if;rec:=sub.id;
 else raise exception 'Operação inválida' using errcode='22023';end if;
 insert into vertice_discursiva.audit(institution_id,course_id,actor,action,record_id) values(p_institution_id,p_course_id,actor,p_action,rec);
 return jsonb_build_object('id',rec);
end;$$;
revoke all on function public.vertice_discursiva(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.vertice_discursiva(uuid,uuid,text,jsonb) to authenticated;

-- Images stay private. Paths encode institution/course/actor, checked on every access.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('discursiva-responses','discursiva-responses',false,6291456,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
grant usage on schema vertice_discursiva to authenticated;
grant execute on function vertice_discursiva.authorize(uuid,uuid) to authenticated;
create policy discursiva_images_read on storage.objects for select to authenticated using(
 bucket_id='discursiva-responses' and vertice_discursiva.authorize((storage.foldername(name))[1]::uuid,(storage.foldername(name))[2]::uuid));
create policy discursiva_images_upload on storage.objects for insert to authenticated with check(
 bucket_id='discursiva-responses' and (storage.foldername(name))[3]=auth.uid()::text and vertice_discursiva.authorize((storage.foldername(name))[1]::uuid,(storage.foldername(name))[2]::uuid));
notify pgrst,'reload schema';
commit;
