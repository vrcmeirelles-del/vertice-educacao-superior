DO $$ DECLARE definition text; marker text:='''template_title'',v_template.title'; BEGIN
 definition:=pg_get_functiondef('vertice_planning.school_individual(uuid,text,jsonb)'::regprocedure);
 IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Document snapshot signature changed'; END IF;
 definition:=replace(definition,marker,'''branding'',(SELECT document_branding FROM public.vertice_institutions WHERE id=p_institution_id),'||marker);
 definition:=replace(definition,'to_jsonb(d)-ARRAY[''original_path'',''signed_path'',''provider_snapshot'']','(to_jsonb(d)-ARRAY[''original_path'',''signed_path'',''provider_snapshot''] || jsonb_build_object(''signature_environment'',CASE WHEN d.provider_snapshot->>''sandbox''=''false'' THEN ''production'' WHEN d.provider_snapshot->>''sandbox''=''true'' THEN ''sandbox'' ELSE NULL END))');
 EXECUTE definition;
END $$;
