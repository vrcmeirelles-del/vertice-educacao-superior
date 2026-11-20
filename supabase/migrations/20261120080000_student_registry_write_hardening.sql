-- Endurecimento da ESCRITA no cadastro de estudantes (public.vertice_student_registry).
--
-- Situação encontrada em 20/11/2026 (consulta ao banco real):
--   * A policy student_reg_write é FOR ALL e usa vertice_private.can_read_institution(), que é verdadeira
--     para qualquer usuário com vínculo na instituição, em qualquer papel e sem segundo fator.
--     Na prática, quem só deveria LER o cadastro também pode inserir, alterar e apagar alunos
--     (a tabela guarda nome, matrícula, e-mail e hash de CPF).
--   * authenticated tem TRUNCATE, TRIGGER e REFERENCES sobre a tabela.
--
-- O que esta migration faz:
--   1. Remove student_reg_write.
--   2. Cria policies por comando, para authenticated, com vertice_private.member_role() (exige segundo fator):
--        - INSERT e UPDATE: master e gestor.
--        - DELETE: somente master.
--   3. Revoga TRUNCATE, TRIGGER e REFERENCES de authenticated.
--
-- Não muda:
--   * A leitura (student_reg_read) continua aberta a quem tem vínculo na instituição. Ela expõe cpf_hash e
--     e-mail a todos os papéis, porque a tela de Atividades Complementares lê todas as colunas (select *).
--     Fechar isso exige mudar o código antes; fica como etapa seguinte.
--   * service_role e as funções SECURITY DEFINER (portal do aluno, Conecta, Atividades de Ensino).
--
-- O que muda para os usuários (conferir antes de rodar):
--   * A importação da base de alunos em Atividades Complementares (upsert pelo navegador) passa a funcionar
--     só para master e gestor com segundo fator. O papel 'equipe' deixa de importar.
--   * Quem não tiver segundo fator ativo (aal2) perde a escrita.

BEGIN;

DROP POLICY IF EXISTS student_reg_write ON public.vertice_student_registry;

CREATE POLICY student_reg_insert ON public.vertice_student_registry
  FOR INSERT TO authenticated
  WITH CHECK (vertice_private.member_role(institution_id) IN ('master', 'gestor'));

CREATE POLICY student_reg_update ON public.vertice_student_registry
  FOR UPDATE TO authenticated
  USING (vertice_private.member_role(institution_id) IN ('master', 'gestor'))
  WITH CHECK (vertice_private.member_role(institution_id) IN ('master', 'gestor'));

CREATE POLICY student_reg_delete ON public.vertice_student_registry
  FOR DELETE TO authenticated
  USING (vertice_private.member_role(institution_id) = 'master');

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.vertice_student_registry FROM authenticated;

COMMIT;

-- Verificação (rodar depois):
--   select policyname, cmd, roles from pg_policies where tablename='vertice_student_registry' order by 1;
--   -- esperado: student_reg_delete, student_reg_insert, student_reg_read, student_reg_update
--   select grantee, string_agg(privilege_type, ',' order by privilege_type)
--     from information_schema.role_table_grants
--    where table_schema='public' and table_name='vertice_student_registry' and grantee='authenticated' group by 1;
--   -- esperado: DELETE,INSERT,SELECT,UPDATE
--
-- Reversão:
--   BEGIN;
--   DROP POLICY IF EXISTS student_reg_insert ON public.vertice_student_registry;
--   DROP POLICY IF EXISTS student_reg_update ON public.vertice_student_registry;
--   DROP POLICY IF EXISTS student_reg_delete ON public.vertice_student_registry;
--   CREATE POLICY student_reg_write ON public.vertice_student_registry FOR ALL
--     USING (vertice_private.can_read_institution(institution_id));
--   GRANT TRUNCATE, TRIGGER, REFERENCES ON public.vertice_student_registry TO authenticated;
--   COMMIT;
