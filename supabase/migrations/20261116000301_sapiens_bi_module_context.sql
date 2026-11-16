
CREATE OR REPLACE FUNCTION vertice_private.bi_module_snapshot(p_institution uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $fn$
DECLARE r record; v_tier text; n bigint; last_at timestamptz; items jsonb:='[]'; source_status text;
BEGIN
 SELECT tier INTO v_tier FROM public.vertice_institutions WHERE id=p_institution;
 IF v_tier IS NULL THEN RAISE EXCEPTION 'Instituição não localizada'; END IF;
 FOR r IN SELECT * FROM (VALUES ('ambos','metas','Metas','public','vertice_goals','updated_at',NULL),
('ambos','acoes','Plano de ação 5W2H','public','vertice_actions','updated_at',NULL),
('ambos','documentos','Mesa Digital e evidências','public','vertice_documents','updated_at',NULL),
('ambos','aprendizagem','Aprendizagem integrada','public','vertice_learning_course_metrics','updated_at',NULL),
('ambos','sapiens','Diagnósticos Sapiens','public','vertice_sapiens_diagnoses','created_at',NULL),
('ambos','pareceres','Pareceres de gestão','public','vertice_sapiens_planning_analyses','created_at',NULL),
('ambos','governanca','Governança','public','governance_meetings','updated_at',NULL),
('superior','tcc','TCC e Pesquisa','public','vertice_tcc_works','updated_at',NULL),
('superior','ac','Atividades Complementares','public','vertice_ac_submissions','updated_at',NULL),
('superior','estagio','Estágio Obrigatório','public','vertice_internship_placements','updated_at',NULL),
('superior','extensao','Extensão','public','vertice_extension_projects','updated_at',NULL),
('superior','egressos','Egressos','public','vertice_alumni_education','updated_at',NULL),
('superior','cpa','CPA','public','vertice_cpa_campaigns','updated_at',NULL),
('superior','captacao','Captação','public','vertice_captacao_leads','updated_at',NULL),
('superior','desempenho','Desempenho e permanência','public','vertice_course_semester_stats','created_at',NULL),
('superior','conecta','Conecta 360°','vertice_conecta','tracks','updated_at',NULL),
('superior','parceiros','Parceiros','vertice_conecta','partner_registrations','updated_at',NULL),
('superior','estrategia','Planejamento estratégico','vertice_app','strategic_plans','updated_at',NULL),
('superior','semestral','Planejamento semestral','vertice_app','semester_plannings','updated_at',NULL),
('superior','custos','Custos','public','vertice_cost_parameters','updated_at',NULL),
('escolas','turmas','Desempenho e permanência','public','vertice_school_classes','updated_at',NULL),
('escolas','indicadores','Indicadores escolares','public','vertice_school_indicators','created_at',NULL),
('escolas','enem','ENEM','public','vertice_enem_escola','created_at',NULL),
('escolas','egressos','Egressos escolares','public','vertice_school_alumni','created_at',NULL),
('escolas','planejamento','Planejamento escolar','vertice_planning','school_plans','updated_at',NULL),
('escolas','cadastro','Cadastro nominal escolar','vertice_planning','school_students','updated_at',NULL),
('escolas','financeiro','Resultado e custos','vertice_planning','school_operations','updated_at','finance'),
('escolas','projetos','Projetos e atividades','vertice_planning','school_operations','updated_at','project'),
('escolas','estagio','Estágio escolar','vertice_planning','school_operations','updated_at','internship'),
('escolas','captacao','Captação escolar','vertice_planning','school_operations','updated_at','admissions')) AS x(tier,key,label,ns,tbl,ts,kind)
 WHERE x.tier IN ('ambos',v_tier) LOOP
  n:=NULL;last_at:=NULL;source_status:='available';
  BEGIN
   IF r.kind IS NULL THEN
    EXECUTE format('SELECT count(*),max(%I) FROM %I.%I WHERE institution_id=$1',r.ts,r.ns,r.tbl)
    INTO n,last_at USING p_institution;
   ELSE
    EXECUTE format('SELECT count(*),max(%I) FROM %I.%I WHERE institution_id=$1 AND kind=$2',r.ts,r.ns,r.tbl)
    INTO n,last_at USING p_institution,r.kind;
   END IF;
  EXCEPTION WHEN undefined_table OR undefined_column THEN source_status:='unavailable';
  END;
  items:=items||jsonb_build_array(jsonb_build_object('key',r.key,'label',r.label,'source',r.ns||'.'||r.tbl,
    'records',n,'last_updated_at',last_at,'status',CASE WHEN source_status='unavailable' THEN 'unavailable' WHEN n=0 THEN 'empty' ELSE 'available' END));
 END LOOP;
 RETURN jsonb_build_object('institution_id',p_institution,'tier',v_tier,'retrieved_at',now(),'modules',items,
 'notice','Contagens de registros por fonte institucional, incluindo rascunhos. Não somar como pessoas únicas nem interpretar como resultados validados. Cada fonte mantém seu período e suas regras.');
END $fn$;
REVOKE ALL ON FUNCTION vertice_private.bi_module_snapshot(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION vertice_private.bi_module_snapshot(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.vertice_bi_module_status(p_institution uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NOT coalesce(public.vertice_sapiens_can_read(p_institution),false) THEN
  RAISE EXCEPTION 'Acesso institucional com segundo fator obrigatório' USING ERRCODE='42501';
 END IF;
 RETURN vertice_private.bi_module_snapshot(p_institution);
END $fn$;
REVOKE ALL ON FUNCTION public.vertice_bi_module_status(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vertice_bi_module_status(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION vertice_private.sapiens_module_context() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
BEGIN
 NEW.context:=NEW.context||jsonb_build_object('institutional_module_inventory',vertice_private.bi_module_snapshot(NEW.institution_id),
 'module_inventory_limit','Metadados institucionais de disponibilidade, não indicadores de resultado. Contagens incluem rascunhos; não inferir desempenho, aprovação, eficácia ou causalidade. Não atribuir o total institucional ao curso selecionado.');
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION vertice_private.sapiens_module_context() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zz_sapiens_module_context BEFORE INSERT ON public.vertice_sapiens_planning_analyses
FOR EACH ROW EXECUTE FUNCTION vertice_private.sapiens_module_context();
