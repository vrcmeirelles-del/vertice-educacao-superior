CREATE TABLE vertice_planning.school_students (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 enrollment_code text NOT NULL CHECK(length(btrim(enrollment_code)) BETWEEN 1 AND 80),full_name text NOT NULL CHECK(length(btrim(full_name)) BETWEEN 3 AND 200),
 class_id uuid NOT NULL REFERENCES public.vertice_school_classes(id),status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','transferred','completed','inactive')),
 source text NOT NULL,reference_date date NOT NULL,created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(institution_id,enrollment_code)
);
CREATE TABLE vertice_planning.school_student_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),student_id uuid NOT NULL REFERENCES vertice_planning.school_students(id),
 class_id uuid NOT NULL REFERENCES public.vertice_school_classes(id),kind text NOT NULL CHECK(kind IN ('observation','intervention')),data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<20000),
 source text NOT NULL,reference_date date NOT NULL,created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX school_student_events_history ON vertice_planning.school_student_events(institution_id,student_id,reference_date DESC,created_at DESC);
CREATE TABLE vertice_planning.school_document_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),title text NOT NULL,body text NOT NULL,
 version int NOT NULL DEFAULT 1,status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','archived')),
 approved_by uuid REFERENCES auth.users(id),approved_at timestamptz,created_by uuid REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.vertice_school_issued_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),student_id uuid NOT NULL REFERENCES vertice_planning.school_students(id),template_id uuid NOT NULL REFERENCES vertice_planning.school_document_templates(id),
 number text NOT NULL UNIQUE,verification_code uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),snapshot jsonb NOT NULL,created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'generating' CHECK(status IN ('generating','issued','failed','revoked')),
 original_path text,original_sha256 text,signed_path text,signed_sha256 text,
 signature_status text NOT NULL DEFAULT 'unsigned' CHECK(signature_status IN ('unsigned','sending','sent','partially_signed','refused','signed','manual_pending_review','manual_reviewed','unknown')),
 provider text,provider_id text,provider_snapshot jsonb,signature_note text,reviewed_by uuid REFERENCES auth.users(id),reviewed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX school_documents_history ON public.vertice_school_issued_documents(institution_id,created_at DESC);
CREATE TABLE vertice_planning.school_individual_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),actor uuid NOT NULL REFERENCES auth.users(id),action text NOT NULL,entity_id uuid,details jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_planning.school_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_planning.school_student_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_planning.school_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_planning.school_individual_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertice_school_issued_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vertice_planning.school_students,vertice_planning.school_student_events,vertice_planning.school_document_templates,vertice_planning.school_individual_audit,public.vertice_school_issued_documents FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.vertice_school_issued_documents TO service_role;
DO $$ DECLARE tbl text; BEGIN FOREACH tbl IN ARRAY ARRAY['school_students','school_student_events','school_document_templates','school_individual_audit'] LOOP
 EXECUTE format('CREATE POLICY school_individual_management ON vertice_planning.%I FOR SELECT TO authenticated USING(vertice_private.member_role(institution_id) IN (''master'',''gestor'',''reitor'',''diretor_geral'',''diretor_pedagogico'',''procurador''))',tbl);
END LOOP; END $$;
CREATE POLICY school_issued_document_management ON public.vertice_school_issued_documents FOR SELECT TO authenticated USING(vertice_private.member_role(institution_id) IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador'));
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('vertice-school-documents','vertice-school-documents',false,5242880,ARRAY['application/pdf']) ON CONFLICT(id) DO NOTHING;
-- Deliberately no anonymous/authenticated storage policies: signed links are issued only after scoped authorization by the function.
CREATE OR REPLACE FUNCTION vertice_planning.school_individual(p_institution_id uuid,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_id uuid; v_student vertice_planning.school_students; v_template vertice_planning.school_document_templates; v_doc public.vertice_school_issued_documents; v_data jsonb; v_before jsonb; v_result jsonb; v_class uuid; v_source text; v_date date; v_key text; v_num numeric; v_alerts jsonb; v_obs jsonb; v_fresh boolean; v_tokens text[];
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE='42501'; END IF;
 v_role:=vertice_private.member_role(p_institution_id);
 IF v_role IS NULL OR v_role NOT IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador') THEN RAISE EXCEPTION 'Acompanhamento individual restrito à direção autorizada com segundo fator' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vertice_institutions WHERE id=p_institution_id AND tier='escolas') THEN RAISE EXCEPTION 'Operação exclusiva de Escolas' USING ERRCODE='22023'; END IF;
 IF p_action='overview' THEN
  RETURN jsonb_build_object('institution_id',p_institution_id,'fetched_at',now(),'rules_version','school-alerts-v1','rules',jsonb_build_object('attendance_below_pct',75,'score_below_pct',50,'freshness_days',45),
   'students',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.full_name) FROM vertice_planning.school_students s WHERE s.institution_id=p_institution_id),'[]'),
   'events',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.reference_date DESC,e.created_at DESC) FROM vertice_planning.school_student_events e WHERE e.institution_id=p_institution_id),'[]'),
   'templates',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.title,t.version DESC) FROM vertice_planning.school_document_templates t WHERE t.institution_id=p_institution_id),'[]'),
   'documents',coalesce((SELECT jsonb_agg(to_jsonb(d)-ARRAY['original_path','signed_path','provider_snapshot'] ORDER BY d.created_at DESC) FROM public.vertice_school_issued_documents d WHERE d.institution_id=p_institution_id),'[]'),
   'classes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'grade',c.grade,'year',c.year) ORDER BY c.year DESC,c.name) FROM public.vertice_school_classes c WHERE c.institution_id=p_institution_id),'[]'));
 ELSIF p_action='document' THEN
  SELECT * INTO v_doc FROM public.vertice_school_issued_documents WHERE id=(p_payload->>'id')::uuid AND institution_id=p_institution_id;
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'Documento não localizado' USING ERRCODE='42501'; END IF;
  RETURN to_jsonb(v_doc);
 ELSIF p_action='verify' THEN
  SELECT * INTO v_doc FROM public.vertice_school_issued_documents WHERE verification_code=(p_payload->>'code')::uuid AND institution_id=p_institution_id;
  RETURN CASE WHEN v_doc.id IS NULL THEN jsonb_build_object('found',false) ELSE jsonb_build_object('found',true,'number',v_doc.number,'status',v_doc.status,'signature_status',v_doc.signature_status,'created_at',v_doc.created_at,'original_sha256',v_doc.original_sha256,'signed_sha256',v_doc.signed_sha256) END;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_institution_id::text||':school-individual',0));
 v_id:=nullif(p_payload->>'id','')::uuid;
 IF p_action='save_student' THEN
  v_class:=(p_payload->>'class_id')::uuid;v_source:=btrim(p_payload->>'source');v_date:=(p_payload->>'reference_date')::date;
  IF NOT EXISTS(SELECT 1 FROM public.vertice_school_classes WHERE id=v_class AND institution_id=p_institution_id) THEN RAISE EXCEPTION 'Turma não pertence à escola' USING ERRCODE='42501'; END IF;
  IF nullif(btrim(p_payload->>'enrollment_code'),'') IS NULL OR length(btrim(coalesce(p_payload->>'full_name','')))<3 OR length(btrim(coalesce(v_source,'')))<3 OR v_date IS NULL OR v_date>current_date OR coalesce(p_payload->>'status','') NOT IN ('active','transferred','completed','inactive') THEN RAISE EXCEPTION 'Confira matrícula, nome, situação, fonte e data'; END IF;
  IF v_id IS NOT NULL THEN
   SELECT * INTO v_student FROM vertice_planning.school_students WHERE id=v_id AND institution_id=p_institution_id FOR UPDATE;
   IF v_student.id IS NULL OR v_student.updated_at::text IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz::text THEN RAISE EXCEPTION 'Cadastro alterado. Atualize antes de salvar.' USING ERRCODE='40001'; END IF;
   v_before:=to_jsonb(v_student);
   UPDATE vertice_planning.school_students SET enrollment_code=btrim(p_payload->>'enrollment_code'),full_name=btrim(p_payload->>'full_name'),class_id=v_class,status=p_payload->>'status',source=v_source,reference_date=v_date,updated_at=clock_timestamp() WHERE id=v_id RETURNING * INTO v_student;
  ELSE INSERT INTO vertice_planning.school_students(institution_id,enrollment_code,full_name,class_id,status,source,reference_date,created_by) VALUES(p_institution_id,btrim(p_payload->>'enrollment_code'),btrim(p_payload->>'full_name'),v_class,p_payload->>'status',v_source,v_date,auth.uid()) RETURNING * INTO v_student; END IF;
  v_result:=to_jsonb(v_student);v_id:=v_student.id;
 ELSIF p_action='event' THEN
  SELECT * INTO v_student FROM vertice_planning.school_students WHERE id=(p_payload->>'student_id')::uuid AND institution_id=p_institution_id;
  IF v_student.id IS NULL THEN RAISE EXCEPTION 'Estudante não pertence à escola' USING ERRCODE='42501'; END IF;
  v_data:=p_payload->'data';v_source:=btrim(p_payload->>'source');v_date:=(p_payload->>'reference_date')::date;
  IF jsonb_typeof(v_data) IS DISTINCT FROM 'object' OR length(coalesce(v_source,''))<3 OR v_date IS NULL OR v_date>current_date OR coalesce(p_payload->>'kind','') NOT IN ('observation','intervention') THEN RAISE EXCEPTION 'Confira tipo, fonte, dados e data'; END IF;
  IF p_payload->>'kind'='observation' THEN
   IF nullif(v_data->>'period_start','')::date IS NULL OR nullif(v_data->>'period_end','')::date IS NULL OR (v_data->>'period_start')::date>(v_data->>'period_end')::date OR (v_data->>'period_end')::date>v_date THEN RAISE EXCEPTION 'Informe período observado válido, encerrado até a referência'; END IF;
   FOREACH v_key IN ARRAY ARRAY['scheduled_days','present_days'] LOOP IF v_data->>v_key IS NOT NULL AND (v_data->>v_key)!~'^[0-9]{1,5}$' THEN RAISE EXCEPTION 'Dias inválidos'; END IF; END LOOP;
   IF (v_data->>'present_days')::numeric>(v_data->>'scheduled_days')::numeric THEN RAISE EXCEPTION 'Presenças superiores aos dias previstos'; END IF;
   IF v_data->>'score_pct' IS NOT NULL AND (v_data->>'score_pct')::numeric NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Desempenho deve estar normalizado entre 0 e 100'; END IF;
   IF coalesce(v_data->>'renewal','unknown') NOT IN ('unknown','pending','confirmed','not_renewed') THEN RAISE EXCEPTION 'Situação de renovação inválida'; END IF;
   IF nullif(v_data->>'renewal_due','') IS NOT NULL THEN PERFORM (v_data->>'renewal_due')::date; END IF;
  ELSE IF length(btrim(coalesce(v_data->>'action','')))<10 OR nullif(btrim(v_data->>'owner'),'') IS NULL THEN RAISE EXCEPTION 'Informe intervenção e responsável'; END IF; END IF;
  INSERT INTO vertice_planning.school_student_events(institution_id,student_id,class_id,kind,data,source,reference_date,created_by) VALUES(p_institution_id,v_student.id,v_student.class_id,p_payload->>'kind',v_data,v_source,v_date,auth.uid()) RETURNING to_jsonb(school_student_events.*),id INTO v_result,v_id;
 ELSIF p_action IN ('save_template','approve_template') THEN
  IF v_id IS NOT NULL THEN SELECT * INTO v_template FROM vertice_planning.school_document_templates WHERE id=v_id AND institution_id=p_institution_id FOR UPDATE;
   IF v_template.id IS NULL OR v_template.updated_at::text IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz::text THEN RAISE EXCEPTION 'Modelo alterado. Atualize antes de prosseguir.' USING ERRCODE='40001'; END IF;
  END IF;
  IF p_action='approve_template' THEN
   IF v_template.id IS NULL OR v_template.status<>'draft' OR length(btrim(coalesce(p_payload->>'note','')))<10 THEN RAISE EXCEPTION 'Revise um modelo em rascunho e informe a justificativa de aprovação'; END IF;
   UPDATE vertice_planning.school_document_templates SET status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=clock_timestamp() WHERE id=v_id RETURNING * INTO v_template;
  ELSE
   IF length(btrim(coalesce(p_payload->>'title',''))) NOT BETWEEN 3 AND 200 OR length(btrim(coalesce(p_payload->>'body',''))) NOT BETWEEN 20 AND 15000 THEN RAISE EXCEPTION 'Informe título e texto do modelo'; END IF;
   FOR v_tokens IN SELECT regexp_matches(p_payload->>'body','\{\{([^{}]+)\}\}','g') LOOP
    IF v_tokens[1] NOT IN ('institution','student','enrollment','class','year','issue_date') THEN RAISE EXCEPTION 'Campo de modelo desconhecido: %',v_tokens[1]; END IF;
   END LOOP;
   INSERT INTO vertice_planning.school_document_templates(institution_id,title,body,version,created_by) VALUES(p_institution_id,p_payload->>'title',p_payload->>'body',coalesce(v_template.version,0)+1,auth.uid()) RETURNING * INTO v_template;
  END IF;
  v_result:=to_jsonb(v_template);v_id:=v_template.id;
 ELSIF p_action='reserve_document' THEN
  SELECT * INTO v_student FROM vertice_planning.school_students WHERE id=(p_payload->>'student_id')::uuid AND institution_id=p_institution_id;
  SELECT * INTO v_template FROM vertice_planning.school_document_templates WHERE id=(p_payload->>'template_id')::uuid AND institution_id=p_institution_id AND status='approved';
  IF v_student.id IS NULL OR v_template.id IS NULL THEN RAISE EXCEPTION 'Selecione estudante da escola e modelo aprovado' USING ERRCODE='42501'; END IF;
  v_id:=gen_random_uuid();
  v_data:=jsonb_build_object('institution',(SELECT name FROM public.vertice_institutions WHERE id=p_institution_id),'student',v_student.full_name,'enrollment',v_student.enrollment_code,'class',(SELECT name FROM public.vertice_school_classes WHERE id=v_student.class_id),'year',(SELECT year FROM public.vertice_school_classes WHERE id=v_student.class_id),'issue_date',to_char(current_date,'DD/MM/YYYY'),'student_status',v_student.status,'student_source',v_student.source,'student_reference_date',v_student.reference_date,'template_title',v_template.title,'template_body',v_template.body,'template_version',v_template.version,'template_approved_at',v_template.approved_at);
  INSERT INTO public.vertice_school_issued_documents(id,institution_id,student_id,template_id,number,snapshot,created_by) VALUES(v_id,p_institution_id,v_student.id,v_template.id,'VE-'||extract(year from current_date)::text||'-'||upper(replace(v_id::text,'-','')),v_data,auth.uid()) RETURNING * INTO v_doc;
  v_result:=to_jsonb(v_doc);
 ELSIF p_action='review_manual_signature' THEN
  IF length(btrim(coalesce(p_payload->>'note','')))<20 THEN RAISE EXCEPTION 'Registre conferência do documento, signatários e resultado da validação externa (mínimo 20 caracteres)'; END IF;
  UPDATE public.vertice_school_issued_documents SET signature_status='manual_reviewed',signature_note=p_payload->>'note',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=clock_timestamp() WHERE id=v_id AND institution_id=p_institution_id AND signature_status='manual_pending_review' RETURNING * INTO v_doc;
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'Nenhuma assinatura recebida aguardando conferência' USING ERRCODE='40001'; END IF;
  v_result:=to_jsonb(v_doc)-ARRAY['original_path','signed_path','provider_snapshot'];
 ELSE RAISE EXCEPTION 'Operação inválida'; END IF;
 INSERT INTO vertice_planning.school_individual_audit(institution_id,actor,action,entity_id,details) VALUES(p_institution_id,auth.uid(),p_action,v_id,jsonb_build_object('before',v_before,'after',v_result-'snapshot'));
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION vertice_planning.school_individual(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_planning.school_individual(uuid,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.vertice_school_individual(p_institution_id uuid,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT vertice_planning.school_individual(p_institution_id,p_action,p_payload); $$;
REVOKE ALL ON FUNCTION public.vertice_school_individual(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vertice_school_individual(uuid,text,jsonb) TO authenticated;
