-- Extend native school data; no synthetic university courses or parallel database.
ALTER TABLE public.vertice_school_classes ADD COLUMN IF NOT EXISTS source text, ADD COLUMN IF NOT EXISTS reference_date date, ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE vertice_planning.school_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 kind text NOT NULL CHECK(kind IN ('finance','project','internship','admissions')),
 year integer NOT NULL CHECK(year BETWEEN 2000 AND 2100), class_id uuid REFERENCES public.vertice_school_classes(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 250), data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<50000),
 source text NOT NULL CHECK(length(btrim(source)) BETWEEN 3 AND 2000), reference_date date NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','completed','archived')),
 created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX school_operations_scope ON vertice_planning.school_operations(institution_id,kind,year);
ALTER TABLE vertice_planning.school_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vertice_planning.school_operations FROM PUBLIC,anon,authenticated;
CREATE POLICY school_operations_read ON vertice_planning.school_operations FOR SELECT TO authenticated USING(vertice_private.member_role(institution_id) IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador'));
CREATE TABLE vertice_planning.school_operations_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 entity_id uuid NOT NULL,entity_kind text NOT NULL,actor uuid NOT NULL REFERENCES auth.users(id),changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),before_data jsonb,after_data jsonb NOT NULL
);
ALTER TABLE vertice_planning.school_operations_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vertice_planning.school_operations_audit FROM PUBLIC,anon,authenticated;
CREATE POLICY school_operations_audit_read ON vertice_planning.school_operations_audit FOR SELECT TO authenticated USING(vertice_private.member_role(institution_id) IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador'));
CREATE OR REPLACE FUNCTION vertice_planning.school_operations_api(p_institution_id uuid,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_kind text; v_id uuid; v_class uuid; v_year int; v_data jsonb; v_before jsonb; v_after jsonb; v_key text; v_row jsonb; v_result jsonb:='[]'; v_title text; v_source text; v_ref date;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE='42501'; END IF;
 v_role:=vertice_private.member_role(p_institution_id);
 IF v_role IS NULL OR v_role NOT IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador') THEN RAISE EXCEPTION 'Gestão escolar restrita à direção autorizada com segundo fator' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vertice_institutions WHERE id=p_institution_id AND tier='escolas') THEN RAISE EXCEPTION 'Operação exclusiva do ambiente Escolas' USING ERRCODE='22023'; END IF;
 IF p_action='overview' THEN
  RETURN jsonb_build_object('fetched_at',now(),'institution_id',p_institution_id,
   'classes',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.year DESC,c.name,c.id) FROM public.vertice_school_classes c WHERE c.institution_id=p_institution_id),'[]'),
   'segments',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.segment) FROM public.vertice_school_segments s WHERE s.institution_id=p_institution_id),'[]'),
   'records',coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.updated_at DESC) FROM vertice_planning.school_operations o WHERE o.institution_id=p_institution_id),'[]'),
   'indicators',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.year DESC) FROM public.vertice_school_indicators i WHERE i.institution_id=p_institution_id),'[]'));
 ELSIF p_action='audit' THEN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM (SELECT id,entity_id,entity_kind,actor,changed_at FROM vertice_planning.school_operations_audit WHERE institution_id=p_institution_id ORDER BY id DESC LIMIT 100) a),'[]');
 ELSIF p_action='import_classes' THEN
  IF jsonb_typeof(p_payload->'rows') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'rows') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Importe de 1 a 200 linhas por lote'; END IF;
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_payload->'rows') LOOP
   v_result:=v_result||jsonb_build_array(vertice_planning.school_operations_api(p_institution_id,'save_class',v_row));
  END LOOP;
  RETURN jsonb_build_object('saved',jsonb_array_length(v_result));
 ELSIF p_action NOT IN ('save_class','save_record') THEN RAISE EXCEPTION 'Operação inválida'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_institution_id::text||':school-operations',0));
 v_id:=nullif(p_payload->>'id','')::uuid; v_data:=p_payload->'data';
 IF jsonb_typeof(v_data) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Dados inválidos'; END IF;
 v_year:=(p_payload->>'year')::int;
 IF v_year IS NULL OR v_year NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'Ano obrigatório entre 2000 e 2100'; END IF;
 v_source:=btrim(p_payload->>'source');v_ref:=(p_payload->>'reference_date')::date;
 IF v_source IS NULL OR length(v_source) NOT BETWEEN 3 AND 2000 OR v_ref IS NULL OR v_ref>current_date THEN RAISE EXCEPTION 'Informe fonte e data de referência válida, até hoje'; END IF;
 IF p_action='save_class' THEN
  v_title:=btrim(v_data->>'name');
  IF v_title IS NULL OR length(v_title) NOT BETWEEN 1 AND 250 OR nullif(btrim(v_data->>'grade'),'') IS NULL THEN RAISE EXCEPTION 'Informe nome e série da turma'; END IF;
  FOREACH v_key IN ARRAY ARRAY['capacity','enrolled','approved','failed','transferred_in','transferred_out','dropped'] LOOP
   IF v_data->>v_key IS NOT NULL AND ((v_data->>v_key)!~'^[0-9]{1,7}$') THEN RAISE EXCEPTION 'Contagem inválida: %',v_key; END IF;
  END LOOP;
  IF v_data->>'avg_score' IS NOT NULL AND ((v_data->>'avg_score')::numeric NOT BETWEEN 0 AND 1000) THEN RAISE EXCEPTION 'Média inválida'; END IF;
  IF nullif(v_data->>'segment_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.vertice_school_segments WHERE id=(v_data->>'segment_id')::uuid AND institution_id=p_institution_id) THEN RAISE EXCEPTION 'Etapa pertence a outra escola' USING ERRCODE='42501'; END IF;
  SELECT to_jsonb(c) INTO v_before FROM public.vertice_school_classes c WHERE c.id=v_id AND c.institution_id=p_institution_id FOR UPDATE;
  IF v_id IS NOT NULL AND (v_before IS NULL OR v_before->>'updated_at' IS DISTINCT FROM p_payload->>'expected_updated_at') THEN RAISE EXCEPTION 'Turma alterada ou indisponível. Atualize antes de salvar.' USING ERRCODE='40001'; END IF;
  IF EXISTS(SELECT 1 FROM public.vertice_school_classes c WHERE c.institution_id=p_institution_id AND c.year=v_year AND lower(btrim(c.name))=lower(v_title) AND coalesce(c.grade,'')=coalesce(v_data->>'grade','') AND coalesce(c.shift,'')=coalesce(v_data->>'shift','') AND (v_id IS NULL OR c.id<>v_id)) THEN RAISE EXCEPTION 'Turma já cadastrada neste ano, série e turno. Edite o registro existente.' USING ERRCODE='23505'; END IF;
  IF v_id IS NULL THEN
   INSERT INTO public.vertice_school_classes(institution_id,name,grade,year,source,reference_date,status) VALUES(p_institution_id,v_title,v_data->>'grade',v_year,v_source,v_ref,'active') RETURNING id INTO v_id;
  END IF;
  UPDATE public.vertice_school_classes SET name=v_title,grade=v_data->>'grade',year=v_year,source=v_source,reference_date=v_ref,segment_id=nullif(v_data->>'segment_id','')::uuid,shift=v_data->>'shift',capacity=(v_data->>'capacity')::int,enrolled=(v_data->>'enrolled')::int,approved=(v_data->>'approved')::int,failed=(v_data->>'failed')::int,transferred_in=(v_data->>'transferred_in')::int,transferred_out=(v_data->>'transferred_out')::int,dropped=(v_data->>'dropped')::int,avg_score=(v_data->>'avg_score')::numeric,notes=left(v_data->>'notes',4000),updated_at=clock_timestamp() WHERE id=v_id AND institution_id=p_institution_id RETURNING to_jsonb(vertice_school_classes.*) INTO v_after;
  v_kind:='class';
 ELSE
  v_kind:=p_payload->>'kind';v_class:=nullif(p_payload->>'class_id','')::uuid;v_title:=btrim(p_payload->>'title');
  IF v_kind IS NULL OR v_kind NOT IN ('finance','project','internship','admissions') OR v_title IS NULL OR length(v_title) NOT BETWEEN 1 AND 250 THEN RAISE EXCEPTION 'Tipo e título obrigatórios'; END IF;
  IF v_class IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.vertice_school_classes WHERE id=v_class AND institution_id=p_institution_id AND year=v_year) THEN RAISE EXCEPTION 'Turma não pertence à escola e ao ano informados' USING ERRCODE='42501'; END IF;
  IF p_payload->>'status' IS NULL OR p_payload->>'status' NOT IN ('draft','active','completed','archived') THEN RAISE EXCEPTION 'Situação inválida'; END IF;
  FOREACH v_key IN ARRAY CASE v_kind WHEN 'finance' THEN ARRAY['revenue_received','receivable','personnel','direct_cost','allocated_cost'] WHEN 'admissions' THEN ARRAY['leads','visits','applications','enrollments'] WHEN 'project' THEN ARRAY['hours_planned','hours_completed','participants'] ELSE ARRAY['hours_planned','hours_completed'] END LOOP
   IF v_data->>v_key IS NOT NULL AND ((v_data->>v_key)::numeric NOT BETWEEN 0 AND 1000000000) THEN RAISE EXCEPTION 'Valor inválido: %',v_key; END IF;
  END LOOP;
  IF v_kind IN ('finance','admissions') AND (coalesce((v_data->>'month')::int,0) NOT BETWEEN 1 AND 12) THEN RAISE EXCEPTION 'Mês obrigatório'; END IF;
  IF nullif(v_data->>'evidence_url','') IS NOT NULL AND v_data->>'evidence_url' !~ '^https://' THEN RAISE EXCEPTION 'Evidência deve usar HTTPS'; END IF;
  IF v_kind='internship' AND (nullif(btrim(v_data->>'learner_reference'),'') IS NULL OR nullif(btrim(v_data->>'organization'),'') IS NULL OR nullif(btrim(v_data->>'supervisor'),'') IS NULL) THEN RAISE EXCEPTION 'Informe referência interna do estudante, concedente e supervisor'; END IF;
  IF v_kind='internship' AND nullif(v_data->>'ends_on','')::date < nullif(v_data->>'starts_on','')::date THEN RAISE EXCEPTION 'Término anterior ao início'; END IF;
  SELECT to_jsonb(o) INTO v_before FROM vertice_planning.school_operations o WHERE o.id=v_id AND o.institution_id=p_institution_id FOR UPDATE;
  IF v_id IS NOT NULL AND (v_before IS NULL OR v_before->>'updated_at' IS DISTINCT FROM p_payload->>'expected_updated_at') THEN RAISE EXCEPTION 'Registro alterado ou indisponível. Atualize antes de salvar.' USING ERRCODE='40001'; END IF;
  IF v_before IS NOT NULL AND v_before->>'kind'<>v_kind THEN RAISE EXCEPTION 'Não é permitido mudar o tipo do registro'; END IF;
  IF v_kind='finance' AND EXISTS(SELECT 1 FROM vertice_planning.school_operations o WHERE o.institution_id=p_institution_id AND o.kind='finance' AND o.year=v_year AND o.class_id IS NOT DISTINCT FROM v_class AND (o.data->>'month')::int=(v_data->>'month')::int AND o.status<>'archived' AND (v_id IS NULL OR o.id<>v_id) AND p_payload->>'status'<>'archived') THEN RAISE EXCEPTION 'Já existe fechamento para este mês e recorte. Edite o registro existente.' USING ERRCODE='23505'; END IF;
  IF v_id IS NULL THEN
   INSERT INTO vertice_planning.school_operations(institution_id,kind,year,class_id,title,data,source,reference_date,status,created_by) VALUES(p_institution_id,v_kind,v_year,v_class,v_title,v_data,v_source,v_ref,p_payload->>'status',auth.uid()) RETURNING to_jsonb(school_operations.*) INTO v_after;
  ELSE
   UPDATE vertice_planning.school_operations SET year=v_year,class_id=v_class,title=v_title,data=v_data,source=v_source,reference_date=v_ref,status=p_payload->>'status',updated_at=clock_timestamp() WHERE id=v_id AND institution_id=p_institution_id RETURNING to_jsonb(school_operations.*) INTO v_after;
  END IF;
 END IF;
 INSERT INTO vertice_planning.school_operations_audit(institution_id,entity_id,entity_kind,actor,before_data,after_data) VALUES(p_institution_id,(v_after->>'id')::uuid,v_kind,auth.uid(),v_before,v_after);
 RETURN v_after;
END $$;
REVOKE ALL ON FUNCTION vertice_planning.school_operations_api(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_planning.school_operations_api(uuid,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.vertice_school_operations(p_institution_id uuid,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT vertice_planning.school_operations_api(p_institution_id,p_action,p_payload); $$;
REVOKE ALL ON FUNCTION public.vertice_school_operations(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vertice_school_operations(uuid,text,jsonb) TO authenticated;
