begin;
-- Refresh newly available OCR text without changing the imported question, rubric or historical answers.
create or replace function public.vertice_discursiva_fo_store(p_institution_id uuid,p_course_id uuid,p_actor uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare rec uuid;c jsonb;x vertice_discursiva.fo_sources;s vertice_discursiva.submissions;ex vertice_discursiva.exams;
begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_actor is null or not exists(select 1 from public.vertice_courses where id=p_course_id and institution_id=p_institution_id) or octet_length(p_payload::text)>250000 then raise exception 'Recorte inválido';end if;
 if p_action='import' then
 perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text||p_course_id::text||(p_payload->>'sheetId'),0));
 select * into x from vertice_discursiva.fo_sources where institution_id=p_institution_id and course_id=p_course_id and source_sheet_id=(p_payload->>'sheetId')::uuid;
 if x.question_id is not null then
 if x.snapshot_hash<>p_payload->>'snapshotHash' then raise exception 'Versão de origem divergente';end if;
 update vertice_discursiva.fo_sources set ocr_text=p_payload->>'ocrText' where question_id=x.question_id;
 insert into vertice_discursiva.audit(institution_id,course_id,actor,action,record_id) values(p_institution_id,p_course_id,p_actor,'fo_refresh',x.question_id);
 return jsonb_build_object('id',x.question_id,'alreadyImported',true,'refreshed',true);
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

commit;
