CREATE OR REPLACE FUNCTION public.vertice_platform_bi_contract_counts() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'aal','')<>'aal2' OR NOT EXISTS(SELECT 1 FROM public.vertice_admins WHERE user_id=auth.uid()) THEN
 RAISE EXCEPTION 'BI da plataforma restrito ao Master com segundo fator' USING ERRCODE='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(q) FROM (SELECT institution_id,status,count(*)::int AS total FROM public.vertice_contracts GROUP BY institution_id,status) q),'[]');
END $fn$;
REVOKE ALL ON FUNCTION public.vertice_platform_bi_contract_counts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vertice_platform_bi_contract_counts() TO authenticated;