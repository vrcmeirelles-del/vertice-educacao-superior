-- Planejamento do Professor com BNCC (v1): catálogo BNCC, planos de aula/bimestre e vínculo plano↔habilidade.
-- O catálogo nasce VAZIO: é carregado a partir do texto oficial do MEC (importador conferido contra a fonte),
-- nunca digitado de memória. Enquanto vazio, a tela avisa e permite salvar o plano sem vínculo.
-- Acesso liberal no início (master/gestor/equipe da escola); refinar após a curadoria.

BEGIN;

CREATE TABLE IF NOT EXISTS public.bncc_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL CHECK (stage IN ('EI','EF','EM')),
  kind text NOT NULL CHECK (kind IN ('competencia_geral','competencia_especifica','habilidade','objetivo_ei')),
  code text NOT NULL,
  component text,            -- EF: componente curricular; EM: área; EI: campo de experiência
  year_label text,           -- EF: "1º ano", "6º ao 9º"...; EM: "1ª a 3ª série"; EI: faixa etária
  description text NOT NULL,
  source text NOT NULL,      -- documento e versão de onde foi extraído
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stage, kind, code)
);
CREATE INDEX IF NOT EXISTS bncc_items_lookup ON public.bncc_items (stage, component, year_label);

CREATE TABLE IF NOT EXISTS public.teacher_lesson_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.vertice_school_classes(id) ON DELETE SET NULL,
  stage text NOT NULL CHECK (stage IN ('EI','EF','EM')),
  year_label text NOT NULL CHECK (length(btrim(year_label)) BETWEEN 1 AND 40),
  component text NOT NULL CHECK (length(btrim(component)) BETWEEN 1 AND 120),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  period_label text CHECK (period_label IS NULL OR length(period_label) <= 60),
  start_date date,
  end_date date,
  objectives text CHECK (objectives IS NULL OR length(objectives) <= 4000),
  content text CHECK (content IS NULL OR length(content) <= 4000),
  methodology text CHECK (methodology IS NULL OR length(methodology) <= 4000),
  resources text CHECK (resources IS NULL OR length(resources) <= 2000),
  assessment text CHECK (assessment IS NULL OR length(assessment) <= 4000),
  inclusion_case_id uuid REFERENCES public.student_support_cases(id) ON DELETE SET NULL,
  inclusion_note text CHECK (inclusion_note IS NULL OR length(inclusion_note) <= 1000),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicado','arquivado')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS teacher_lesson_plans_inst ON public.teacher_lesson_plans (institution_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.teacher_lesson_plan_bncc (
  plan_id uuid NOT NULL REFERENCES public.teacher_lesson_plans(id) ON DELETE CASCADE,
  bncc_item_id uuid NOT NULL REFERENCES public.bncc_items(id) ON DELETE RESTRICT,
  institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, bncc_item_id)
);

CREATE OR REPLACE FUNCTION vertice_private.teacher_plan_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS teacher_plan_touch ON public.teacher_lesson_plans;
CREATE TRIGGER teacher_plan_touch BEFORE UPDATE ON public.teacher_lesson_plans
  FOR EACH ROW EXECUTE FUNCTION vertice_private.teacher_plan_touch();

ALTER TABLE public.bncc_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_lesson_plan_bncc ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bncc_items_read ON public.bncc_items;
CREATE POLICY bncc_items_read ON public.bncc_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS teacher_plans_select ON public.teacher_lesson_plans;
CREATE POLICY teacher_plans_select ON public.teacher_lesson_plans FOR SELECT TO authenticated
  USING (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'));
DROP POLICY IF EXISTS teacher_plans_insert ON public.teacher_lesson_plans;
CREATE POLICY teacher_plans_insert ON public.teacher_lesson_plans FOR INSERT TO authenticated
  WITH CHECK (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'));
DROP POLICY IF EXISTS teacher_plans_update ON public.teacher_lesson_plans;
CREATE POLICY teacher_plans_update ON public.teacher_lesson_plans FOR UPDATE TO authenticated
  USING (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'))
  WITH CHECK (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'));
DROP POLICY IF EXISTS teacher_plans_delete ON public.teacher_lesson_plans;
CREATE POLICY teacher_plans_delete ON public.teacher_lesson_plans FOR DELETE TO authenticated
  USING (vertice_private.member_role(institution_id) IN ('master','gestor'));

DROP POLICY IF EXISTS teacher_plan_bncc_select ON public.teacher_lesson_plan_bncc;
CREATE POLICY teacher_plan_bncc_select ON public.teacher_lesson_plan_bncc FOR SELECT TO authenticated
  USING (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'));
DROP POLICY IF EXISTS teacher_plan_bncc_insert ON public.teacher_lesson_plan_bncc;
CREATE POLICY teacher_plan_bncc_insert ON public.teacher_lesson_plan_bncc FOR INSERT TO authenticated
  WITH CHECK (vertice_private.member_role(institution_id) IN ('master','gestor','equipe')
    AND EXISTS (SELECT 1 FROM public.teacher_lesson_plans p WHERE p.id = plan_id AND p.institution_id = teacher_lesson_plan_bncc.institution_id));
DROP POLICY IF EXISTS teacher_plan_bncc_delete ON public.teacher_lesson_plan_bncc;
CREATE POLICY teacher_plan_bncc_delete ON public.teacher_lesson_plan_bncc FOR DELETE TO authenticated
  USING (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'));

REVOKE ALL ON public.bncc_items, public.teacher_lesson_plans, public.teacher_lesson_plan_bncc FROM anon, public;
GRANT SELECT ON public.bncc_items TO authenticated;                      -- catálogo: leitura apenas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_lesson_plans TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.teacher_lesson_plan_bncc TO authenticated;

COMMIT;

-- Verificação: select count(*) from public.bncc_items;   -- 0 até a carga oficial
-- Reversão: DROP TABLE public.teacher_lesson_plan_bncc, public.teacher_lesson_plans, public.bncc_items;
--           DROP FUNCTION vertice_private.teacher_plan_touch();
