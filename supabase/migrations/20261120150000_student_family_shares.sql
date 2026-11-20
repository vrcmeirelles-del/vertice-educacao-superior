-- Acesso da família ao PEI por link seguro (somente leitura, escopo mínimo).
--
-- Desenho:
--   * A equipe escreve um RESUMO para a família e gera um link com prazo (7, 30 ou 60 dias).
--     A família NÃO vê o PEI completo, laudos, avaliações, barreiras nem notas internas:
--     vê só nome do estudante, resumo escrito pela equipe, vigência e as adaptações
--     (categoria + descrição), se a equipe deixar a opção marcada.
--   * O token (32 bytes aleatórios, hex) nunca é gravado: só o SHA-256. O link é mostrado uma vez.
--   * Leitura pública apenas pela função vertice_family_plan_view(token), que responde NULL
--     igual para token inexistente, expirado ou revogado. Cada acesso válido incrementa
--     view_count e atualiza last_viewed_at.
--   * Gerenciamento (criar, revogar) por master, gestor e equipe com MFA; DELETE só master.
--   * anon não tem privilégio algum na tabela.

BEGIN;

CREATE TABLE IF NOT EXISTS public.student_family_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
  plan_id uuid NOT NULL REFERENCES public.student_individual_plans(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.student_support_cases(id),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  summary text NOT NULL CHECK (length(btrim(summary)) >= 20),
  show_accommodations boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '61 days')
);
CREATE INDEX IF NOT EXISTS student_family_shares_plan_idx ON public.student_family_shares (institution_id, plan_id);

ALTER TABLE public.student_family_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_family_shares_select ON public.student_family_shares FOR SELECT TO authenticated
  USING (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'));
CREATE POLICY student_family_shares_insert ON public.student_family_shares FOR INSERT TO authenticated
  WITH CHECK (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'));
CREATE POLICY student_family_shares_update ON public.student_family_shares FOR UPDATE TO authenticated
  USING (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'))
  WITH CHECK (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'));
CREATE POLICY student_family_shares_delete ON public.student_family_shares FOR DELETE TO authenticated
  USING (vertice_private.member_role(institution_id) = 'master');

REVOKE ALL ON public.student_family_shares FROM anon, public;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.student_family_shares FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_family_shares TO authenticated;

-- Leitura pública: só devolve o conteúdo mínimo.
CREATE OR REPLACE FUNCTION public.vertice_family_plan_view(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.student_family_shares%ROWTYPE;
  p public.student_individual_plans%ROWTYPE;
  inst_name text;
  accs jsonb := '[]'::jsonb;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO s FROM public.student_family_shares
   WHERE token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
     AND revoked_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.student_family_shares
     SET view_count = view_count + 1, last_viewed_at = now()
   WHERE id = s.id;

  SELECT * INTO p FROM public.student_individual_plans WHERE id = s.plan_id;
  SELECT name INTO inst_name FROM public.vertice_institutions WHERE id = s.institution_id;

  IF s.show_accommodations THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('category', a.category, 'description', a.description) ORDER BY a.category), '[]'::jsonb)
      INTO accs
      FROM public.student_plan_accommodations a
     WHERE a.plan_id = s.plan_id AND a.status NOT IN ('cancelada');
  END IF;

  RETURN jsonb_build_object(
    'institution_name', inst_name,
    'student_name', p.student_name,
    'summary', s.summary,
    'period', p.period,
    'effective_from', p.effective_from,
    'effective_until', p.effective_until,
    'next_review_date', p.next_review_date,
    'accommodations', accs,
    'expires_at', s.expires_at
  );
END $$;

REVOKE ALL ON FUNCTION public.vertice_family_plan_view(text) FROM public;
GRANT EXECUTE ON FUNCTION public.vertice_family_plan_view(text) TO anon, authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verificação (depois de rodar):
--   select policyname, cmd from pg_policies where tablename='student_family_shares' order by 2;   -- 4 linhas
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name='student_family_shares' and grantee='anon';                                   -- nenhuma linha
--   select public.vertice_family_plan_view('00');                                                   -- NULL
--   select public.vertice_family_plan_view(repeat('0',64));                                         -- NULL
--
-- Reversão: DROP FUNCTION public.vertice_family_plan_view(text); DROP TABLE public.student_family_shares;
