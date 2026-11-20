-- Motor de alertas do PEI, versão pei-alerts-v1 (10 regras por prazo, status e preenchimento).
-- Documento de regras: "SIMAI · Regras v1 do motor de alertas do PEI" (19/11/2026).
--
-- Princípios: sugere, não decide; explicável (regra, versão e evidência em cada alerta);
-- não lê conteúdo clínico (só datas, status e se um campo está preenchido).
--
-- PARÂMETROS PROVISÓRIOS: P1=30, P2=15, P3=30 dias e pesos 3/2/1 foram colocados só para o motor
-- funcionar na fase de testes. NÃO são critério pedagógico validado. Ficam em pei_alert_config
-- (por instituição, provisional=true) e devem ser definidos pela equipe especialista.
--
-- Pequenos ajustes frente ao documento (para evitar ruído):
--   * R08, R09 e R10 ignoram casos/planos encerrados ou suspensos.
--   * R10 considera preenchida a barreira em barriers_identified OU participation_barriers
--     (o formulário atual do PEI grava em participation_barriers).
--
-- Execução: a função public.vertice_pei_alerts_refresh(instituição) recalcula; o painel a chama
-- ao abrir a aba Alertas. Sem agendamento diário nesta versão.

BEGIN;

CREATE TABLE IF NOT EXISTS public.pei_alert_config (
  institution_id uuid PRIMARY KEY REFERENCES public.vertice_institutions(id),
  review_notice_days integer NOT NULL DEFAULT 30 CHECK (review_notice_days BETWEEN 1 AND 365),       -- P1
  validation_max_days integer NOT NULL DEFAULT 15 CHECK (validation_max_days BETWEEN 1 AND 365),     -- P2
  plan_after_welcome_days integer NOT NULL DEFAULT 30 CHECK (plan_after_welcome_days BETWEEN 1 AND 365), -- P3
  weight_high integer NOT NULL DEFAULT 3 CHECK (weight_high >= 0),                                   -- P4
  weight_medium integer NOT NULL DEFAULT 2 CHECK (weight_medium >= 0),
  weight_low integer NOT NULL DEFAULT 1 CHECK (weight_low >= 0),
  provisional boolean NOT NULL DEFAULT true,
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pei_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
  case_id uuid NOT NULL REFERENCES public.student_support_cases(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.student_individual_plans(id) ON DELETE CASCADE,
  accommodation_id uuid REFERENCES public.student_plan_accommodations(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL,
  rule_id text NOT NULL CHECK (rule_id IN ('R01','R02','R03','R04','R05','R06','R07','R08','R09','R10')),
  rules_version text NOT NULL DEFAULT 'pei-alerts-v1',
  severity text NOT NULL CHECK (severity IN ('alta','media','baixa')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','reconhecido','resolvido','dispensado')),
  dismissed_reason text,
  acted_by uuid,
  acted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (status <> 'dispensado' OR length(btrim(coalesce(dismissed_reason,''))) >= 5)
);
CREATE UNIQUE INDEX IF NOT EXISTS pei_alerts_live_uk ON public.pei_alerts (rule_id, entity_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS pei_alerts_inst_idx ON public.pei_alerts (institution_id, status);

ALTER TABLE public.pei_alert_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pei_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY pei_alert_config_select ON public.pei_alert_config FOR SELECT TO authenticated
  USING (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'));
CREATE POLICY pei_alert_config_insert ON public.pei_alert_config FOR INSERT TO authenticated
  WITH CHECK (vertice_private.member_role(institution_id) IN ('master','gestor'));
CREATE POLICY pei_alert_config_update ON public.pei_alert_config FOR UPDATE TO authenticated
  USING (vertice_private.member_role(institution_id) IN ('master','gestor'))
  WITH CHECK (vertice_private.member_role(institution_id) IN ('master','gestor'));

CREATE POLICY pei_alerts_select ON public.pei_alerts FOR SELECT TO authenticated
  USING (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'));
CREATE POLICY pei_alerts_update ON public.pei_alerts FOR UPDATE TO authenticated
  USING (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'))
  WITH CHECK (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'));

REVOKE ALL ON public.pei_alert_config, public.pei_alerts FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON public.pei_alert_config TO authenticated;
GRANT SELECT ON public.pei_alerts TO authenticated;
-- Quem opera só pode mudar a situação do alerta; o conteúdo é calculado.
GRANT UPDATE (status, dismissed_reason) ON public.pei_alerts TO authenticated;

CREATE OR REPLACE FUNCTION vertice_private.pei_alerts_stamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('reconhecido','dispensado') AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.acted_by := auth.uid();
    NEW.acted_at := now();
  END IF;
  IF OLD.status IN ('resolvido') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Alerta já resolvido não pode ser reaberto.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pei_alerts_stamp ON public.pei_alerts;
CREATE TRIGGER pei_alerts_stamp BEFORE UPDATE ON public.pei_alerts
  FOR EACH ROW EXECUTE FUNCTION vertice_private.pei_alerts_stamp();

-- Cálculo das regras (sem efeito colateral).
CREATE OR REPLACE FUNCTION vertice_private.pei_alerts_compute(p_inst uuid)
RETURNS TABLE (rule_id text, severity text, case_id uuid, plan_id uuid, accommodation_id uuid, entity_id uuid, evidence jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH cfg AS (
    SELECT coalesce(c.review_notice_days,30) p1, coalesce(c.validation_max_days,15) p2, coalesce(c.plan_after_welcome_days,30) p3
      FROM (SELECT 1) x LEFT JOIN public.pei_alert_config c ON c.institution_id = p_inst
  ), pl AS (
    SELECT * FROM public.student_individual_plans WHERE institution_id = p_inst
  ), cs AS (
    SELECT * FROM public.student_support_cases WHERE institution_id = p_inst
  )
  -- R01
  SELECT 'R01', 'alta', p.case_id, p.id, NULL::uuid, p.id,
         jsonb_build_object('plano_status', p.status, 'next_review_date', p.next_review_date)
    FROM pl p WHERE p.status IN ('validado','ativo') AND p.next_review_date < current_date
  UNION ALL -- R02
  SELECT 'R02', 'media', p.case_id, p.id, NULL, p.id,
         jsonb_build_object('plano_status', p.status, 'next_review_date', p.next_review_date, 'antecedencia_dias', cfg.p1)
    FROM pl p, cfg WHERE p.status IN ('validado','ativo') AND p.next_review_date BETWEEN current_date AND current_date + cfg.p1
  UNION ALL -- R03
  SELECT 'R03', 'media', p.case_id, p.id, NULL, p.id, jsonb_build_object('plano_status', p.status)
    FROM pl p WHERE p.status IN ('validado','ativo') AND p.next_review_date IS NULL
  UNION ALL -- R04
  SELECT 'R04', 'alta', p.case_id, p.id, NULL, p.id,
         jsonb_build_object('atualizado_em', p.updated_at, 'prazo_dias', cfg.p2)
    FROM pl p, cfg WHERE p.status = 'aguardando_validacao' AND p.updated_at < now() - make_interval(days => cfg.p2)
  UNION ALL -- R05
  SELECT 'R05', 'alta', p.case_id, p.id, NULL, p.id, jsonb_build_object('effective_until', p.effective_until)
    FROM pl p WHERE p.status = 'ativo' AND p.effective_until < current_date
  UNION ALL -- R06
  SELECT 'R06', 'media', p.case_id, p.id, NULL, p.id, jsonb_build_object('plano_status', p.status)
    FROM pl p WHERE p.status IN ('validado','ativo')
     AND NOT EXISTS (SELECT 1 FROM public.student_plan_accommodations a WHERE a.plan_id = p.id AND a.status <> 'cancelada')
  UNION ALL -- R07
  SELECT 'R07', 'media', p.case_id, p.id, a.id, a.id, jsonb_build_object('adaptacao_status', a.status, 'categoria', a.category)
    FROM public.student_plan_accommodations a JOIN pl p ON p.id = a.plan_id
   WHERE a.status IN ('prevista','em_implementacao') AND btrim(coalesce(a.responsible,'')) = ''
  UNION ALL -- R08
  SELECT 'R08', 'media', c.id, NULL, NULL, c.id,
         jsonb_build_object('acolhimento_at', c.acolhimento_at, 'prazo_dias', cfg.p3)
    FROM cs c, cfg
   WHERE c.status NOT IN ('encerrado','suspenso') AND c.acolhimento_at IS NOT NULL
     AND c.acolhimento_at < now() - make_interval(days => cfg.p3)
     AND NOT EXISTS (SELECT 1 FROM pl p WHERE p.case_id = c.id)
  UNION ALL -- R09
  SELECT 'R09', 'alta', c.id, NULL, NULL, c.id, jsonb_build_object('acolhimento_deadline', c.acolhimento_deadline)
    FROM cs c WHERE c.status NOT IN ('encerrado','suspenso') AND c.acolhimento_at IS NULL AND c.acolhimento_deadline < now()
  UNION ALL -- R10
  SELECT 'R10', 'media', p.case_id, p.id, NULL, p.id, jsonb_build_object('plano_status', p.status)
    FROM pl p
   WHERE p.status NOT IN ('encerrado','suspenso')
     AND (btrim(coalesce(p.barriers_identified,'')) <> '' OR btrim(coalesce(p.participation_barriers,'')) <> '')
     AND btrim(coalesce(p.strategies_used,'')) = '' AND btrim(coalesce(p.recommended_support,'')) = ''
$$;

-- Recalcula e sincroniza os alertas da instituição.
CREATE OR REPLACE FUNCTION public.vertice_pei_alerts_refresh(p_institution uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n_new integer; n_resolved integer; n_open integer;
BEGIN
  IF vertice_private.member_role(p_institution) NOT IN ('master','gestor','equipe') THEN
    RAISE EXCEPTION 'Sem permissão para esta instituição.' USING ERRCODE = '42501';
  END IF;

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

  SELECT count(*) INTO n_open FROM public.pei_alerts WHERE institution_id = p_institution AND resolved_at IS NULL AND status IN ('aberto','reconhecido');
  RETURN jsonb_build_object('novos', n_new, 'resolvidos', n_resolved, 'abertos', n_open, 'rules_version', 'pei-alerts-v1');
END $$;

REVOKE ALL ON FUNCTION public.vertice_pei_alerts_refresh(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.vertice_pei_alerts_refresh(uuid) TO authenticated;

-- Fila de trabalho: pontuação = pesos dos alertas abertos + prioridade do caso. Ordena, não classifica.
CREATE OR REPLACE VIEW public.v_pei_case_queue WITH (security_invoker = true) AS
SELECT c.id AS case_id, c.institution_id, c.student_name, c.priority, c.status AS case_status, c.updated_at,
       count(a.id) AS alertas_abertos,
       coalesce(sum(CASE a.severity WHEN 'alta' THEN coalesce(g.weight_high,3) WHEN 'media' THEN coalesce(g.weight_medium,2) ELSE coalesce(g.weight_low,1) END),0)
         + CASE c.priority WHEN 'urgente' THEN 3 WHEN 'alta' THEN 2 WHEN 'normal' THEN 1 ELSE 0 END AS pontuacao
  FROM public.student_support_cases c
  LEFT JOIN public.pei_alerts a ON a.case_id = c.id AND a.resolved_at IS NULL AND a.status IN ('aberto','reconhecido')
  LEFT JOIN public.pei_alert_config g ON g.institution_id = c.institution_id
 WHERE c.status NOT IN ('encerrado')
 GROUP BY c.id, c.institution_id, c.student_name, c.priority, c.status, c.updated_at;
GRANT SELECT ON public.v_pei_case_queue TO authenticated;
REVOKE ALL ON public.v_pei_case_queue FROM anon, public;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verificação (depois de rodar, como master com MFA, na própria aplicação; no SQL Editor a
-- função de refresh recusa por não haver usuário):
--   select policyname, cmd from pg_policies where tablename in ('pei_alerts','pei_alert_config') order by 1;
--   select grantee, privilege_type from information_schema.role_table_grants where table_name in ('pei_alerts','pei_alert_config') and grantee='anon';  -- vazio
--   select * from vertice_private.pei_alerts_compute('e5c00000-de00-4000-a000-000000000001');  -- regras sobre a Escola Vértice demo
--
-- Reversão: DROP VIEW public.v_pei_case_queue; DROP FUNCTION public.vertice_pei_alerts_refresh(uuid);
--           DROP FUNCTION vertice_private.pei_alerts_compute(uuid); DROP TABLE public.pei_alerts, public.pei_alert_config;
--           DROP FUNCTION vertice_private.pei_alerts_stamp();
