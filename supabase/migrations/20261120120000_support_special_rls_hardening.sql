-- Endurecimento das tabelas irmãs de Inclusão (student_support_*) e Regime Especial (student_special_*).
--
-- Situação encontrada em 20/11/2026 (consulta ao banco real), mesmo problema já corrigido em
-- 20261119223000 para as 4 tabelas do PEI:
--   * Todas têm policies FOR ALL que liberam leitura e escrita a QUALQUER usuário com vínculo na
--     instituição (qualquer papel), sem with_check e sem exigir segundo fator.
--   * Nas tabelas student_special_*, a policy "master" libera quem tem papel 'master' em QUALQUER
--     instituição, não só administradores globais.
--   * anon tem privilégios de tabela (barrado hoje só pela RLS) e authenticated tem TRUNCATE etc.
--   * Estas tabelas guardam documentos (laudos), avaliações, encaminhamentos e diários: dado de
--     saúde/deficiência de estudante (LGPD, dado sensível).
--
-- O que esta migration faz (23 tabelas, lista abaixo):
--   1. Remove todas as policies atuais dessas tabelas.
--   2. Cria policies por comando, TO authenticated, via vertice_private.member_role()
--      (exige aal2 e devolve 'master' para administradores globais):
--        SELECT/INSERT/UPDATE: master, gestor e equipe (fase inicial: acesso amplo aos papéis internos, a restringir após a curadoria).   DELETE: somente master.
--      Tabelas de auditoria (*_audit): SELECT e INSERT para master/gestor; sem UPDATE; DELETE só master.
--      student_special_plan_versions não tem institution_id: segue a instituição do plano pai.
--   3. Revoga todos os privilégios de anon e TRUNCATE/TRIGGER/REFERENCES de authenticated.
--
-- Impacto (conferir antes de rodar):
--   * Papéis internos (master, gestor, equipe) mantêm acesso; quem não tiver MFA ativo (aal2) perde, inclusive gestor. Anon perde tudo.
--   * Telas de Acompanhamento Especial passam a listar vazio (não erro) para quem perdeu acesso.
--   * service_role não é afetado. Contagem em 20/11/2026: tabelas praticamente vazias
--     (student_special_cases 1, student_special_plans 1, demais 0).
--   * Para liberar mais um papel depois, acrescente-o nas listas IN (...) abaixo.

BEGIN;

DO $$
DECLARE
  tbl text;
  pol record;
  audit_tbls text[] := ARRAY['student_support_audit','student_special_audit'];
  inst_tbls text[] := ARRAY[
    'student_course_support_actions','student_special_audit','student_special_cases',
    'student_special_categories','student_special_course_actions','student_special_decisions',
    'student_special_documents','student_special_plans','student_special_regulatory_evidence',
    'student_special_requests','student_special_return_plans','student_special_reviews',
    'student_special_teacher_logs','student_support_assessments','student_support_audit',
    'student_support_documents','student_support_referrals','student_support_regulatory_evidence',
    'student_support_reviews','student_teacher_support_logs',
    -- PEI e cadastro de estudantes: recriadas para incluir 'equipe' (fase inicial, antes da curadoria)
    'student_support_cases','student_support_requests','student_individual_plans','student_plan_accommodations'
  ];
  gate text;
BEGIN
  FOREACH tbl IN ARRAY inst_tbls || ARRAY['student_special_plan_versions'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tbl LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, tbl);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    IF tbl = 'student_special_plan_versions' THEN
      gate := '(SELECT vertice_private.member_role(p.institution_id) FROM public.student_special_plans p WHERE p.id = plan_id)';
    ELSE
      gate := 'vertice_private.member_role(institution_id)';
    END IF;

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s IN (''master'',''gestor'',''equipe''))', tbl||'_select', tbl, gate);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s IN (''master'',''gestor'',''equipe''))', tbl||'_insert', tbl, gate);
    IF NOT (tbl = ANY(audit_tbls)) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s IN (''master'',''gestor'',''equipe'')) WITH CHECK (%s IN (''master'',''gestor'',''equipe''))', tbl||'_update', tbl, gate, gate);
    END IF;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s = ''master'')', tbl||'_delete', tbl, gate);

    EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl);
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM authenticated', tbl);
  END LOOP;
END $$;

-- Cadastro de estudantes: inclui 'equipe' em INSERT/UPDATE (importação), mantendo DELETE só master.
DO $$
BEGIN
  DROP POLICY IF EXISTS student_reg_insert ON public.vertice_student_registry;
  DROP POLICY IF EXISTS student_reg_update ON public.vertice_student_registry;
  CREATE POLICY student_reg_insert ON public.vertice_student_registry FOR INSERT TO authenticated
    WITH CHECK (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'));
  CREATE POLICY student_reg_update ON public.vertice_student_registry FOR UPDATE TO authenticated
    USING (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'))
    WITH CHECK (vertice_private.member_role(institution_id) IN ('master','gestor','equipe'));
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verificação (rodar depois):
--   select tablename, count(*) n, string_agg(cmd, ',' order by cmd) cmds
--     from pg_policies
--    where schemaname='public' and (tablename like 'student\_support\_%' or tablename like 'student\_special\_%'
--          or tablename in ('student_teacher_support_logs','student_course_support_actions'))
--    group by 1 order by 1;
--   -- esperado: 4 policies (DELETE,INSERT,SELECT,UPDATE) por tabela; 3 (DELETE,INSERT,SELECT) nas duas de auditoria
--
--   select table_name, grantee, string_agg(privilege_type, ',') from information_schema.role_table_grants
--    where table_schema='public' and grantee in ('anon') and (table_name like 'student\_support\_%' or table_name like 'student\_special\_%')
--    group by 1,2;
--   -- esperado: nenhuma linha
--
-- Reversão: recriar, em cada tabela, policies FOR ALL abertas a vínculo da instituição
-- (ver 20261119223000 para o formato) e GRANT ALL ... TO anon. Não recomendado.
