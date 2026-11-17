begin;
create table vertice_discursiva.fo_sources(
 institution_id uuid not null,course_id uuid not null,source_sheet_id uuid not null,
 question_id uuid not null unique references vertice_discursiva.questions(id),
 qr_token char(64) not null,snapshot_hash char(64) not null,student_token char(64) not null,
 source_max_points numeric not null check(source_max_points>0),ocr_text text,
 imported_by uuid not null,imported_at timestamptz not null default now(),
 primary key(institution_id,course_id,source_sheet_id),
 foreign key(course_id,institution_id) references public.vertice_courses(id,institution_id)
);
create table vertice_discursiva.fo_receipts(
 submission_id uuid primary key references vertice_discursiva.submissions(id),
 source_sheet_id uuid not null,acknowledged_at timestamptz not null default now(),actor uuid not null
);
alter table vertice_discursiva.fo_sources enable row level security;
alter table vertice_discursiva.fo_receipts enable row level security;

-- Writes are reserved to the Edge Function after caller Auth/MFA and course authorization.
create function public.vertice_discursiva_fo_store(p_institution_id uuid,p_course_id uuid,p_actor uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare rec uuid;c jsonb;x vertice_discursiva.fo_sources;s vertice_discursiva.submissions;ex vertice_discursiva.exams;
begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_actor is null or not exists(select 1 from public.vertice_courses where id=p_course_id and institution_id=p_institution_id) or octet_length(p_payload::text)>250000 then raise exception 'Recorte inválido';end if;
 if p_action='import' then
 perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text||p_course_id::text||(p_payload->>'sheetId'),0));
 select * into x from vertice_discursiva.fo_sources where institution_id=p_institution_id and course_id=p_course_id and source_sheet_id=(p_payload->>'sheetId')::uuid;
 if x.question_id is not null then
 if x.snapshot_hash<>p_payload->>'snapshotHash' then raise exception 'Versão de origem divergente';end if;
 return jsonb_build_object('id',x.question_id,'alreadyImported',true);
 end if;
 if p_payload->>'contractVersion'<>'manuscript-v1' or p_payload->>'institutionId'<>p_institution_id::text or p_payload->>'courseId'<>p_course_id::text or p_payload->>'qrToken'!~'^[a-f0-9]{64}$' or p_payload->>'snapshotHash'!~'^[a-f0-9]{64}$' or p_payload->>'studentToken'!~'^[a-f0-9]{64}$' then raise exception 'Contrato de origem inválido';end if;
 c:=jsonb_build_object('profile','institutional','origin','fato_ordem_manuscript','case',p_payload->>'stem','command','Responda à questão da folha original, preservando seus subitens e critérios.','expectedAnswer','Espelho recebido do Fato & Ordem, sem resposta-modelo adicional: '||(select string_agg(r->>'criterion','; ') from jsonb_array_elements(p_payload->'rubric')r),'competency','Competência da rubrica de origem','difficulty','medium','rubric',p_payload->'rubric','externalSheet',jsonb_build_object('provider','fato-e-ordem','sheetId',p_payload->>'sheetId','snapshotHash',p_payload->>'snapshotHash','module',p_payload->>'sourceModule','sourceMaxPoints',p_payload->'sourceMaxPoints'),'validation','Questão e rubrica importadas. Revisão docente obrigatória; escala educacional normalizada para 10, sem equivalência a resultado oficial.');
 insert into vertice_discursiva.questions(institution_id,course_id,discipline,content,created_by) values(p_institution_id,p_course_id,p_payload->>'discipline',c,p_actor) returning id into rec;
 insert into vertice_discursiva.fo_sources(institution_id,course_id,source_sheet_id,question_id,qr_token,snapshot_hash,student_token,source_max_points,ocr_text,imported_by)
 values(p_institution_id,p_course_id,(p_payload->>'sheetId')::uuid,rec,p_payload->>'qrToken',p_payload->>'snapshotHash',p_payload->>'studentToken',(p_payload->>'sourceMaxPoints')::numeric,p_payload->>'ocrText',p_actor);
 elsif p_action='receipt' then
 select s0.* into s from vertice_discursiva.submissions s0 join vertice_discursiva.exams e on e.id=s0.exam_id where s0.id=(p_payload->>'submissionId')::uuid and e.institution_id=p_institution_id and e.course_id=p_course_id and s0.reviewed_at is not null;
 select * into x from vertice_discursiva.fo_sources where question_id=s.question_id and institution_id=p_institution_id and course_id=p_course_id;
 if s.id is null or x.question_id is null then raise exception 'Resposta externa não homologada';end if;
 insert into vertice_discursiva.fo_receipts(submission_id,source_sheet_id,actor) values(s.id,x.source_sheet_id,p_actor) on conflict(submission_id) do nothing;rec:=s.id;
 else raise exception 'Operação inválida';end if;
 insert into vertice_discursiva.audit(institution_id,course_id,actor,action,record_id) values(p_institution_id,p_course_id,p_actor,'fo_'||p_action,rec);
 return jsonb_build_object('id',rec);
end;$$;
revoke all on function public.vertice_discursiva_fo_store(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.vertice_discursiva_fo_store(uuid,uuid,uuid,text,jsonb) to service_role;

create function public.vertice_discursiva_fo_context(p_institution_id uuid,p_course_id uuid,p_submission_id uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 if not vertice_discursiva.authorize(p_institution_id,p_course_id) then raise exception 'Acesso ao curso ou MFA pendente' using errcode='42501';end if;
 if p_submission_id is null then
 return jsonb_build_object('sources',coalesce((select jsonb_agg(jsonb_build_object('questionId',x.question_id,'sheetId',x.source_sheet_id,'ocrText',x.ocr_text,'sourceMaxPoints',x.source_max_points)) from vertice_discursiva.fo_sources x where x.institution_id=p_institution_id and x.course_id=p_course_id),'[]'),'receipts',coalesce((select jsonb_agg(r.submission_id) from vertice_discursiva.fo_receipts r join vertice_discursiva.fo_sources x on x.source_sheet_id=r.source_sheet_id where x.institution_id=p_institution_id and x.course_id=p_course_id),'[]'));
 end if;
 select jsonb_build_object('qrToken',x.qr_token,'snapshotHash',x.snapshot_hash,'sheetId',x.source_sheet_id,'reviewId',s.id,'score',s.final_score,'feedback',s.final_feedback,'reviewedAt',s.reviewed_at) into result
 from vertice_discursiva.submissions s join vertice_discursiva.exams e on e.id=s.exam_id join vertice_discursiva.fo_sources x on x.question_id=s.question_id and x.institution_id=e.institution_id and x.course_id=e.course_id
 where s.id=p_submission_id and e.institution_id=p_institution_id and e.course_id=p_course_id and s.reviewed_at is not null;
 if result is null then raise exception 'Resposta externa ainda não homologada';end if;return result;
end;$$;
revoke all on function public.vertice_discursiva_fo_context(uuid,uuid,uuid) from public,anon;
grant execute on function public.vertice_discursiva_fo_context(uuid,uuid,uuid) to authenticated;

create function vertice_discursiva.bind_fo_exam() returns trigger language plpgsql set search_path=pg_catalog as $$
declare tokens text[];
begin
 select array_agg(distinct x.student_token::text) into tokens from jsonb_array_elements(new.snapshot) q join vertice_discursiva.fo_sources x on x.question_id=(q->>'id')::uuid and x.institution_id=new.institution_id and x.course_id=new.course_id;
 if cardinality(tokens)>1 then raise exception 'Uma prova não pode misturar folhas de estudantes diferentes';end if;
 if cardinality(tokens)=1 then new.student_ref:='fo:'||tokens[1];end if;return new;
end;$$;
revoke all on function vertice_discursiva.bind_fo_exam() from public,anon,authenticated;
create trigger discursiva_fo_exam_binding before insert on vertice_discursiva.exams for each row execute function vertice_discursiva.bind_fo_exam();
notify pgrst,'reload schema';
-- Explicit transcription confirmation is required for imported text, even without an image in F&O.
create function vertice_discursiva.confirm_fo_text() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if exists(select 1 from vertice_discursiva.fo_sources where question_id=new.question_id) and not new.transcription_confirmed then raise exception 'Confira a folha manuscrita original antes de registrar ou homologar o texto importado';end if;
 return new;
end;$$;
revoke all on function vertice_discursiva.confirm_fo_text() from public,anon,authenticated;
create trigger discursiva_fo_text_confirmation before insert or update on vertice_discursiva.submissions for each row execute function vertice_discursiva.confirm_fo_text();

commit;
