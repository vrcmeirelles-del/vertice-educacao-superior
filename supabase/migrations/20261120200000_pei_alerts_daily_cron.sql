-- Recálculo diário dos alertas do PEI (pei-alerts-v1).
-- Extrai a sincronização para função sem checagem de usuário (uso interno/cron) e agenda 1x ao dia.
-- A função pública vertice_pei_alerts_refresh continua exigindo membro autenticado.

BEGIN;

CREATE OR REPLACE FUNCTION vertice_private.pei_alerts_sync(p_institution uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n_new integer; n_resolved integer; n_open integer;
BEGIN
  INSERT INTO public.pei_alerts (institution_id, case_id, plan_id, accommodation_id, entity_id, rule_id, severity, evidence)
  SELECT p_institution, c.case_id, c.plan_id, c.accommodation_id, c.entity_id, c.rule_id, c.severity, c.evidence
    FROM vertice_private.pei_alerts_compute(p_institution) c
  ON CONFLICT (rule_id, entity_id) WHERE resolved_at IS NULL DO NOTHING;
  GET DIAGNOSTICS n_new = ROW_COUNT;

  UPDATE public.pei_alerts a
     SET status = CASE WHEN a.status IN ('aberto','reconhecido') THEN 'resolvido' ELSE a.status END,
         resolved_at = now()
   WHERE a.institution_id = p_institution AND a.resolved_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM vertice_private.pei_alerts_compute(p_institution) c
                      WHERE c.rule_id = a.rule_id AND c.entity_id = a.entity_id);
  GET DIAGNOSTICS n_resolved = ROW_COUNT;

  SELECT count(*) INTO n_open FROM public.pei_alerts
   WHERE institution_id = p_institution AND resolved_at IS NULL AND status IN ('aberto','reconhecido');
  RETURN jsonb_build_object('novos', n_new, 'resolvidos', n_resolved, 'abertos', n_open, 'rules_version', 'pei-alerts-v1');
END $$;
REVOKE ALL ON FUNCTION vertice_private.pei_alerts_sync(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.vertice_pei_alerts_refresh(p_institution uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF vertice_private.member_role(p_institution) NOT IN ('master','gestor','equipe') THEN
    RAISE EXCEPTION 'Sem permissão para esta instituição.' USING ERRCODE = '42501';
  END IF;
  RETURN vertice_private.pei_alerts_sync(p_institution);
END $$;
REVOKE ALL ON FUNCTION public.vertice_pei_alerts_refresh(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.vertice_pei_alerts_refresh(uuid) TO authenticated;

-- Roda para toda instituição que tem caso de inclusão; falha numa não derruba as demais.
CREATE OR REPLACE FUNCTION vertice_private.pei_alerts_daily()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT DISTINCT institution_id FROM public.student_support_cases LOOP
    BEGIN
      PERFORM vertice_private.pei_alerts_sync(r.institution_id);
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'pei_alerts_daily falhou para %: %', r.institution_id, SQLERRM;
    END;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION vertice_private.pei_alerts_daily() FROM public, anon, authenticated;

COMMIT;

-- Agendamento (fora da transação): todo dia 05:40 UTC (02:40 em Palmas).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'vertice-pei-alerts-daily';
SELECT cron.schedule('vertice-pei-alerts-daily', '40 5 * * *', $$select vertice_private.pei_alerts_daily()$$);

-- Verificação: select jobname, schedule from cron.job where jobname='vertice-pei-alerts-daily';
--              select vertice_private.pei_alerts_daily();   -- retorna nº de instituições processadas
-- Reversão:    select cron.unschedule('vertice-pei-alerts-daily');
--              DROP FUNCTION vertice_private.pei_alerts_daily(); (a sync pode ficar)
