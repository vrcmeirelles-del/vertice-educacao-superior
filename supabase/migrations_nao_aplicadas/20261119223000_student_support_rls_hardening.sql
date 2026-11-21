-- Endurecimento de acesso às tabelas de Inclusão / PEI.
--
-- Situação encontrada em 19/11/2026 (consulta ao banco real):
--   * As 4 tabelas têm policies "<x>_institution" com FOR ALL que liberam leitura E escrita
--     a QUALQUER usuário com vínculo na instituição (vertice_memberships), em qualquer papel,
--     sem with_check, e sem exigir segundo fator.
--   * O papel anon tem todos os privilégios de tabela (hoje barrado só pela RLS).
--
-- O que esta migration faz:
--   1. Remove as 8 policies antigas.
--   2. Cria policies por comando, para o papel authenticated, usando vertice_private.member_role()
--      (a mesma função das tabelas de Escolas): exige segundo fator (aal2) e devolve o papel
--      do usuário na instituição alvo ('master' para administradores globais).
--        - SELECT, INSERT, UPDATE: master e gestor.
--        - DELETE: somente master.
--   3. Revoga privilégios de anon e os privilégios desnecessários de authenticated.
--
-- O que muda para os usuários (conferir antes de rodar):
--   * Papel 'equipe' (8 vínculos no banco em 19/11/2026) perde acesso a estas tabelas.
--   * Quem não tiver segundo fator ativo (aal2) perde acesso, inclusive gestor e master.
--   * Telas que apenas contam PEIs (Raio-X do curso, Planejamento) passam a ver zero para
--     quem perdeu acesso: a RLS devolve lista vazia, não erro.
--   * service_role (sincronizações e funções de servidor) não é afetado.
--
-- Para dar acesso a mais um papel no futuro, acrescente o nome do papel nas listas IN (...) abaixo.

BEGIN;

-- 1. Policies antigas (abertas a qualquer membro)
DROP POLICY IF EXISTS ssc_institution ON public.student_support_cases;
DROP POLICY IF EXISTS ssc_master ON public.student_support_cases;
DROP POLICY IF EXISTS ssr_institution ON public.student_support_requests;
DROP POLICY IF EXISTS ssr_master ON public.student_support_requests;
DROP POLICY IF EXISTS sip_institution ON public.student_individual_plans;
DROP POLICY IF EXISTS sip_master ON public.student_individual_plans;
DROP POLICY IF EXISTS spa_institution ON public.student_plan_accommodations;
DROP POLICY IF EXISTS spa_master ON public.student_plan_accommodations;

-- 2. Novas policies, por comando
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'student_support_cases',
    'student_support_requests',
    'student_individual_plans',
    'student_plan_accommodations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
         USING (vertice_private.member_role(institution_id) IN (''master'',''gestor''))',
      tbl || '_select', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
         WITH CHECK (vertice_private.member_role(institution_id) IN (''master'',''gestor''))',
      tbl || '_insert', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
         USING (vertice_private.member_role(institution_id) IN (''master'',''gestor''))
         WITH CHECK (vertice_private.member_role(institution_id) IN (''master'',''gestor''))',
      tbl || '_update', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
         USING (vertice_private.member_role(institution_id) = ''master'')',
      tbl || '_delete', tbl);
  END LOOP;
END $$;

-- 3. Privilégios de tabela
REVOKE ALL ON public.student_support_cases,
              public.student_support_requests,
              public.student_individual_plans,
              public.student_plan_accommodations
  FROM anon;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.student_support_cases,
                                        public.student_support_requests,
                                        public.student_individual_plans,
                                        public.student_plan_accommodations
  FROM authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verificação (rodar depois):
--   select tablename, policyname, cmd, roles from pg_policies
--    where tablename in ('student_support_cases','student_support_requests',
--                        'student_individual_plans','student_plan_accommodations')
--    order by 1,2;
--   -- esperado: 4 policies por tabela (select, insert, update, delete), roles = {authenticated}
--
--   select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type)
--     from information_schema.role_table_grants
--    where table_schema='public'
--      and table_name in ('student_support_cases','student_support_requests',
--                         'student_individual_plans','student_plan_accommodations')
--      and grantee in ('anon','authenticated') group by 1,2 order by 2,1;
--   -- esperado: anon sem linhas; authenticated só DELETE, INSERT, SELECT, UPDATE
--
-- Reversão (recria o comportamento anterior, aberto a qualquer membro):
--   BEGIN;
--   DO $$ DECLARE tbl text; BEGIN
--     FOREACH tbl IN ARRAY ARRAY['student_support_cases','student_support_requests',
--                                'student_individual_plans','student_plan_accommodations'] LOOP
--       EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl||'_select', tbl);
--       EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl||'_insert', tbl);
--       EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl||'_update', tbl);
--       EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl||'_delete', tbl);
--     END LOOP; END $$;
--   CREATE POLICY ssc_institution ON public.student_support_cases FOR ALL USING (EXISTS (SELECT 1 FROM vertice_memberships m WHERE m.user_id = auth.uid() AND m.institution_id = student_support_cases.institution_id));
--   CREATE POLICY ssc_master ON public.student_support_cases FOR ALL USING (EXISTS (SELECT 1 FROM vertice_admins WHERE vertice_admins.user_id = auth.uid()));
--   CREATE POLICY ssr_institution ON public.student_support_requests FOR ALL USING (EXISTS (SELECT 1 FROM vertice_memberships m WHERE m.user_id = auth.uid() AND m.institution_id = student_support_requests.institution_id));
--   CREATE POLICY ssr_master ON public.student_support_requests FOR ALL USING (EXISTS (SELECT 1 FROM vertice_admins WHERE vertice_admins.user_id = auth.uid()));
--   CREATE POLICY sip_institution ON public.student_individual_plans FOR ALL USING (EXISTS (SELECT 1 FROM vertice_memberships m WHERE m.user_id = auth.uid() AND m.institution_id = student_individual_plans.institution_id));
--   CREATE POLICY sip_master ON public.student_individual_plans FOR ALL USING (EXISTS (SELECT 1 FROM vertice_admins WHERE vertice_admins.user_id = auth.uid()));
--   CREATE POLICY spa_institution ON public.student_plan_accommodations FOR ALL USING (EXISTS (SELECT 1 FROM vertice_memberships m WHERE m.user_id = auth.uid() AND m.institution_id = student_plan_accommodations.institution_id));
--   CREATE POLICY spa_master ON public.student_plan_accommodations FOR ALL USING (EXISTS (SELECT 1 FROM vertice_admins WHERE vertice_admins.user_id = auth.uid()));
--   GRANT ALL ON public.student_support_cases, public.student_support_requests, public.student_individual_plans, public.student_plan_accommodations TO anon;
--   COMMIT;
