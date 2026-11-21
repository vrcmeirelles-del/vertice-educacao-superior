CREATE OR REPLACE FUNCTION vertice_planning.school_operations_context(p_institution_id uuid,p_year integer DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_data jsonb; v_classes jsonb; v_records jsonb; v_year int;
BEGIN
 v_data:=vertice_planning.school_operations_api(p_institution_id,'overview','{}');
 SELECT coalesce(p_year,max((c->>'year')::int)) INTO v_year FROM jsonb_array_elements(v_data->'classes') c;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c->'id','name',c->'name','grade',c->'grade','year',c->'year','capacity',c->'capacity','enrolled',c->'enrolled','approved',c->'approved','failed',c->'failed','dropped',c->'dropped','transferred_in',c->'transferred_in','transferred_out',c->'transferred_out','source',c->'source','reference_date',c->'reference_date','updated_at',c->'updated_at')),'[]') INTO v_classes FROM jsonb_array_elements(v_data->'classes') c WHERE (c->>'year')::int=v_year;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r->'id','kind',r->'kind','year',r->'year','class_id',r->'class_id','status',r->'status','source',r->'source','reference_date',r->'reference_date','updated_at',r->'updated_at','data',CASE WHEN r->>'kind'='internship' THEN jsonb_build_object('hours_planned',r->'data'->'hours_planned','hours_completed',r->'data'->'hours_completed') ELSE (r->'data')-ARRAY['learner_reference','supervisor','evidence_url','owner'] END)),'[]') INTO v_records FROM jsonb_array_elements(v_data->'records') r WHERE (r->>'year')::int=v_year AND r->>'status'<>'archived';
 RETURN jsonb_build_object('year',v_year,'classes',v_classes,'records',v_records,'sources',jsonb_build_array('vertice_school_classes','vertice_planning.school_operations'),'limits','Contagens por turma não são alunos únicos. Custos usam caixa declarado e não EBITDA; não somar fechamento institucional com turmas. Sem coorte individual não concluir retenção/evasão.');
END $$;
REVOKE ALL ON FUNCTION vertice_planning.school_operations_context(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_planning.school_operations_context(uuid,integer) TO authenticated;
