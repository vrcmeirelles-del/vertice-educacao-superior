-- Automação dos algoritmos (21/11/2026): alertas persistidos, registro de execuções e histórico semanal.
-- A função de borda vertice-algoritmos roda diariamente os mesmos algoritmos das telas (client/src/lib)
-- e grava aqui os alertas, que abrem e se resolvem sozinhos (mesmo modelo de pei_alerts).
-- O histórico semanal de vertice_course_semester_stats permite, com o tempo, séries temporais reais
-- (hoje a fonte é um retrato único substituído a cada importação).

BEGIN;

CREATE TABLE IF NOT EXISTS public.vertice_algorithm_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL,
  algorithm text NOT NULL CHECK (algorithm IN ('evasao','gargalo','ritmo_repositorio','titulacao')),
  entity_key text NOT NULL CHECK (length(entity_key) BETWEEN 1 AND 300),
  severity text NOT NULL CHECK (severity IN ('alta','media','informativa')),
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 300),
  detail text,
  evidence jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','reconhecido','resolvido')),
  rules_version text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  acknowledged_by uuid,
  acknowledged_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS vertice_algorithm_alerts_open_uq
  ON public.vertice_algorithm_alerts (institution_id, algorithm, entity_key) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS vertice_algorithm_alerts_inst_idx ON public.vertice_algorithm_alerts (institution_id, resolved_at, severity);

CREATE TABLE IF NOT EXISTS public.vertice_algorithm_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  institution_id uuid NOT NULL,
  algorithm text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  published boolean NOT NULL,
  validation jsonb NOT NULL DEFAULT '{}',
  summary jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS vertice_algorithm_runs_inst_idx ON public.vertice_algorithm_runs (institution_id, algorithm, ran_at DESC);

CREATE TABLE IF NOT EXISTS public.vertice_course_stats_history (
  captured_on date NOT NULL,
  institution_id uuid NOT NULL,
  codigo text NOT NULL,
  semestre text NOT NULL,
  curso text, modalidade text,
  total_registros integer, matriculados integer, pre_matriculado integer, trancado integer, abandono integer,
  concluido integer, cancelado integer, transferido integer, troca_curso integer, graduado integer,
  PRIMARY KEY (captured_on, institution_id, codigo, semestre)
);

ALTER TABLE public.vertice_algorithm_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertice_algorithm_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertice_course_stats_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vertice_algorithm_alerts, public.vertice_algorithm_runs, public.vertice_course_stats_history FROM anon;

DROP POLICY IF EXISTS algorithm_alerts_select ON public.vertice_algorithm_alerts;
CREATE POLICY algorithm_alerts_select ON public.vertice_algorithm_alerts FOR SELECT TO authenticated
  USING (vertice_private.member_role(institution_id) = ANY (ARRAY['master','gestor','equipe']));
DROP POLICY IF EXISTS algorithm_runs_select ON public.vertice_algorithm_runs;
CREATE POLICY algorithm_runs_select ON public.vertice_algorithm_runs FOR SELECT TO authenticated
  USING (vertice_private.member_role(institution_id) = ANY (ARRAY['master','gestor','equipe']));
DROP POLICY IF EXISTS course_stats_history_select ON public.vertice_course_stats_history;
CREATE POLICY course_stats_history_select ON public.vertice_course_stats_history FOR SELECT TO authenticated
  USING (vertice_private.member_role(institution_id) = ANY (ARRAY['master','gestor','equipe']));
GRANT SELECT ON public.vertice_algorithm_alerts, public.vertice_algorithm_runs, public.vertice_course_stats_history TO authenticated;

-- Reconhecer um alerta: só altera status e autoria, nunca o conteúdo calculado.
CREATE OR REPLACE FUNCTION public.vertice_algorithm_alert_ack(p_alert uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE inst uuid;
BEGIN
  SELECT institution_id INTO inst FROM public.vertice_algorithm_alerts WHERE id = p_alert AND resolved_at IS NULL;
  IF inst IS NULL THEN RAISE EXCEPTION 'Alerta não localizado ou já resolvido.'; END IF;
  IF vertice_private.member_role(inst) NOT IN ('master','gestor') THEN
    RAISE EXCEPTION 'Sem permissão para esta instituição.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.vertice_algorithm_alerts SET status = 'reconhecido', acknowledged_by = auth.uid(), acknowledged_at = now()
   WHERE id = p_alert AND status = 'aberto';
END $$;
REVOKE ALL ON FUNCTION public.vertice_algorithm_alert_ack(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.vertice_algorithm_alert_ack(uuid) TO authenticated;

-- Sincroniza os alertas de um algoritmo numa instituição (chamada só pela função de borda, com service_role).
-- p_alerts: [{entity_key, severity, title, detail, evidence}]. Publicado = false: só registra a execução e
-- resolve os alertas abertos, porque a validação não sustenta mais o sinal.
CREATE OR REPLACE FUNCTION public.vertice_algorithm_alerts_sync(p_institution uuid, p_algorithm text, p_rules_version text, p_published boolean, p_alerts jsonb, p_validation jsonb, p_summary jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n_new integer := 0; n_resolved integer; n_open integer; a jsonb; keys text[] := '{}';
BEGIN
  IF jsonb_typeof(coalesce(p_alerts,'[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'p_alerts deve ser lista'; END IF;
  IF p_published THEN
    FOR a IN SELECT * FROM jsonb_array_elements(p_alerts) LOOP
      keys := keys || (a->>'entity_key');
      INSERT INTO public.vertice_algorithm_alerts (institution_id, algorithm, entity_key, severity, title, detail, evidence, rules_version)
      VALUES (p_institution, p_algorithm, a->>'entity_key', a->>'severity', a->>'title', a->>'detail', coalesce(a->'evidence','{}'), p_rules_version)
      ON CONFLICT (institution_id, algorithm, entity_key) WHERE resolved_at IS NULL
      DO UPDATE SET severity = EXCLUDED.severity, title = EXCLUDED.title, detail = EXCLUDED.detail,
                    evidence = EXCLUDED.evidence, rules_version = EXCLUDED.rules_version, last_seen_at = now();
      IF (SELECT first_seen_at = last_seen_at FROM public.vertice_algorithm_alerts
           WHERE institution_id = p_institution AND algorithm = p_algorithm AND entity_key = a->>'entity_key' AND resolved_at IS NULL) THEN
        n_new := n_new + 1;
      END IF;
    END LOOP;
  END IF;
  UPDATE public.vertice_algorithm_alerts SET status = 'resolvido', resolved_at = now()
   WHERE institution_id = p_institution AND algorithm = p_algorithm AND resolved_at IS NULL
     AND NOT (entity_key = ANY (keys));
  GET DIAGNOSTICS n_resolved = ROW_COUNT;
  INSERT INTO public.vertice_algorithm_runs (institution_id, algorithm, published, validation, summary)
  VALUES (p_institution, p_algorithm, p_published, coalesce(p_validation,'{}'), coalesce(p_summary,'{}'));
  SELECT count(*) INTO n_open FROM public.vertice_algorithm_alerts
   WHERE institution_id = p_institution AND algorithm = p_algorithm AND resolved_at IS NULL;
  RETURN jsonb_build_object('novos', n_new, 'resolvidos', n_resolved, 'abertos', n_open);
END $$;
REVOKE ALL ON FUNCTION public.vertice_algorithm_alerts_sync(uuid,text,text,boolean,jsonb,jsonb,jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_algorithm_alerts_sync(uuid,text,text,boolean,jsonb,jsonb,jsonb) TO service_role;

-- Histórico semanal: guarda o retrato atual; repetir no mesmo dia não duplica.
CREATE OR REPLACE FUNCTION vertice_private.course_stats_snapshot()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.vertice_course_stats_history (captured_on, institution_id, codigo, semestre, curso, modalidade, total_registros,
    matriculados, pre_matriculado, trancado, abandono, concluido, cancelado, transferido, troca_curso, graduado)
  SELECT current_date, institution_id, codigo, semestre, curso, modalidade, total_registros, matriculados, pre_matriculado,
    trancado, abandono, concluido, cancelado, transferido, troca_curso, graduado
  FROM public.vertice_course_semester_stats WHERE coalesce(total_registros,0) > 0
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION vertice_private.course_stats_snapshot() FROM public, anon, authenticated;

COMMIT;

-- Agendamentos (fora da transação). Horários UTC; Palmas = UTC-3.
-- Algoritmos: todo dia 06:23 UTC. A função de borda valida o segredo de cron já usado pelas rotinas existentes.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('vertice-algoritmos-diario','vertice-course-stats-snapshot-semanal');
SELECT cron.schedule('vertice-course-stats-snapshot-semanal', '11 5 * * 1', $$select vertice_private.course_stats_snapshot()$$);
SELECT cron.schedule('vertice-algoritmos-diario', '23 6 * * *', $$
select net.http_post(url:='https://qvetbbmviatxxatzzuzc.supabase.co/functions/v1/vertice-algoritmos',
 headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='espelho_cron_secret')),
 body:='{}'::jsonb, timeout_milliseconds:=150000);
$$);

-- Verificação: select jobname, schedule from cron.job where jobname like 'vertice-%algoritmos%' or jobname like '%stats-snapshot%';
--              select algorithm, severity, title from vertice_algorithm_alerts where resolved_at is null;
-- Reversão:    select cron.unschedule('vertice-algoritmos-diario'); select cron.unschedule('vertice-course-stats-snapshot-semanal');
