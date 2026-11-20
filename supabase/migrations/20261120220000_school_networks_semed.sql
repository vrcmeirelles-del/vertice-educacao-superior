-- Rede / SEMED (v1): camada acima das escolas, com papel próprio de secretaria.
-- A secretaria enxerga SOMENTE indicadores agregados por escola (contagens), nunca nomes, laudos ou textos.
-- Acesso por RPC (security definer): a secretaria não ganha SELECT em nenhuma tabela das escolas.
-- Provisório: cabe à equipe especialista/SEMED definir indicadores e o limite de supressão (min_cell).

BEGIN;

CREATE TABLE IF NOT EXISTS public.vertice_school_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 3 AND 160),
  kind text NOT NULL DEFAULT 'semed' CHECK (kind IN ('semed','rede_privada','outra')),
  min_cell integer NOT NULL DEFAULT 1 CHECK (min_cell BETWEEN 1 AND 20), -- contagens abaixo disto saem como null
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vertice_school_network_schools (
  network_id uuid NOT NULL REFERENCES public.vertice_school_networks(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (network_id, institution_id)
);

CREATE TABLE IF NOT EXISTS public.vertice_school_network_members (
  network_id uuid NOT NULL REFERENCES public.vertice_school_networks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'secretaria' CHECK (role IN ('secretaria')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (network_id, user_id)
);

ALTER TABLE public.vertice_school_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertice_school_network_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertice_school_network_members ENABLE ROW LEVEL SECURITY;

-- Gestão da rede: só master. Membros enxergam apenas a própria rede (nome) e a própria linha.
DROP POLICY IF EXISTS network_master_all ON public.vertice_school_networks;
CREATE POLICY network_master_all ON public.vertice_school_networks FOR ALL TO authenticated
  USING (vertice_private.is_master())
  WITH CHECK (vertice_private.is_master());
DROP POLICY IF EXISTS network_member_read ON public.vertice_school_networks;
CREATE POLICY network_member_read ON public.vertice_school_networks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vertice_school_network_members m WHERE m.network_id = id AND m.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS network_schools_master_all ON public.vertice_school_network_schools;
CREATE POLICY network_schools_master_all ON public.vertice_school_network_schools FOR ALL TO authenticated
  USING (vertice_private.is_master()) WITH CHECK (vertice_private.is_master());

DROP POLICY IF EXISTS network_members_master_all ON public.vertice_school_network_members;
CREATE POLICY network_members_master_all ON public.vertice_school_network_members FOR ALL TO authenticated
  USING (vertice_private.is_master()) WITH CHECK (vertice_private.is_master());
DROP POLICY IF EXISTS network_members_self_read ON public.vertice_school_network_members;
CREATE POLICY network_members_self_read ON public.vertice_school_network_members FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.vertice_school_networks, public.vertice_school_network_schools, public.vertice_school_network_members FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vertice_school_networks, public.vertice_school_network_schools, public.vertice_school_network_members TO authenticated;

-- Papel do usuário na rede (exige MFA, como member_role).
CREATE OR REPLACE FUNCTION vertice_private.network_role(p_network uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN NOT coalesce((SELECT auth.jwt()->>'aal') = 'aal2', false) THEN NULL
    WHEN vertice_private.is_master() THEN 'master'
    ELSE (SELECT m.role FROM public.vertice_school_network_members m
           WHERE m.network_id = p_network AND m.user_id = (SELECT auth.uid()))
  END;
$$;
REVOKE ALL ON FUNCTION vertice_private.network_role(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION vertice_private.network_role(uuid) TO authenticated;

-- Redes às quais o usuário tem acesso (para a tela escolher).
CREATE OR REPLACE FUNCTION public.vertice_my_networks()
RETURNS TABLE (id uuid, name text, kind text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT n.id, n.name, n.kind FROM public.vertice_school_networks n
   WHERE vertice_private.network_role(n.id) IS NOT NULL ORDER BY n.name;
$$;
REVOKE ALL ON FUNCTION public.vertice_my_networks() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.vertice_my_networks() TO authenticated;

-- Indicadores agregados por escola. Sem nomes de alunos, sem texto livre, sem ids de casos.
CREATE OR REPLACE FUNCTION public.vertice_network_indicators(p_network uuid)
RETURNS TABLE (institution_id uuid, escola text, casos_ativos integer, planos_ativos integer,
               planos_aguardando_validacao integer, alertas_alta integer, alertas_media integer, alertas_baixa integer,
               acolhimento_atrasado integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE mc integer;
BEGIN
  IF vertice_private.network_role(p_network) IS NULL THEN
    RAISE EXCEPTION 'Sem permissão para esta rede.' USING ERRCODE = '42501';
  END IF;
  SELECT n.min_cell INTO mc FROM public.vertice_school_networks n WHERE n.id = p_network;

  RETURN QUERY
  WITH s AS (
    SELECT i.id, i.name FROM public.vertice_school_network_schools ns
      JOIN public.vertice_institutions i ON i.id = ns.institution_id WHERE ns.network_id = p_network
  ), c AS (
    SELECT s.id,
      (SELECT count(*) FROM public.student_support_cases x WHERE x.institution_id = s.id AND x.status NOT IN ('encerrado','suspenso'))::int casos,
      (SELECT count(*) FROM public.student_individual_plans p WHERE p.institution_id = s.id AND p.status = 'ativo')::int ativos,
      (SELECT count(*) FROM public.student_individual_plans p WHERE p.institution_id = s.id AND p.status = 'aguardando_validacao')::int aguard,
      (SELECT count(*) FROM public.pei_alerts a WHERE a.institution_id = s.id AND a.resolved_at IS NULL AND a.status IN ('aberto','reconhecido') AND a.severity = 'alta')::int alta,
      (SELECT count(*) FROM public.pei_alerts a WHERE a.institution_id = s.id AND a.resolved_at IS NULL AND a.status IN ('aberto','reconhecido') AND a.severity = 'media')::int media,
      (SELECT count(*) FROM public.pei_alerts a WHERE a.institution_id = s.id AND a.resolved_at IS NULL AND a.status IN ('aberto','reconhecido') AND a.severity = 'baixa')::int baixa,
      (SELECT count(*) FROM public.pei_alerts a WHERE a.institution_id = s.id AND a.resolved_at IS NULL AND a.status IN ('aberto','reconhecido') AND a.rule_id = 'R09')::int atraso
    FROM s
  )
  SELECT s.id, s.name,
    CASE WHEN c.casos  BETWEEN 1 AND mc - 1 THEN NULL ELSE c.casos  END,
    CASE WHEN c.ativos BETWEEN 1 AND mc - 1 THEN NULL ELSE c.ativos END,
    CASE WHEN c.aguard BETWEEN 1 AND mc - 1 THEN NULL ELSE c.aguard END,
    CASE WHEN c.alta   BETWEEN 1 AND mc - 1 THEN NULL ELSE c.alta   END,
    CASE WHEN c.media  BETWEEN 1 AND mc - 1 THEN NULL ELSE c.media  END,
    CASE WHEN c.baixa  BETWEEN 1 AND mc - 1 THEN NULL ELSE c.baixa  END,
    CASE WHEN c.atraso BETWEEN 1 AND mc - 1 THEN NULL ELSE c.atraso END
  FROM s JOIN c ON c.id = s.id ORDER BY s.name;
END $$;
REVOKE ALL ON FUNCTION public.vertice_network_indicators(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.vertice_network_indicators(uuid) TO authenticated;

COMMIT;

-- Como usar (master): criar a rede, ligar escolas e cadastrar a secretaria:
--   insert into public.vertice_school_networks(name) values ('SEMED — Demonstração') returning id;
--   insert into public.vertice_school_network_schools values ('<rede>','e5c00000-de00-4000-a000-000000000001');
--   insert into public.vertice_school_network_members(network_id,user_id) values ('<rede>','<auth.users.id>');
-- Verificação: nenhuma tabela das escolas recebe grant novo; a secretaria só executa as 2 RPCs.
-- Reversão: DROP FUNCTION public.vertice_network_indicators(uuid), public.vertice_my_networks(), vertice_private.network_role(uuid);
--           DROP TABLE public.vertice_school_network_members, public.vertice_school_network_schools, public.vertice_school_networks;
