-- Avalia 360 | RECUPERAÇÃO PARCIAL DA BRANCH DE HOMOLOGAÇÃO (NÃO PRODUÇÃO)
-- Dependência: migração de origem 202610260001_access_foundation.sql aplicada.
-- Base: conferência read-only dos objetos atuais no Supabase principal em 2026-11-19.
-- Este script repõe APENAS autorização de curso e vínculo docente necessários ao Avalia.
-- NÃO equivale à restauração integral das 226 migrações da produção.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS vertice_courses_institution_id_pair
  ON public.vertice_courses(id,institution_id);

CREATE OR REPLACE FUNCTION vertice_private.member_role(target uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE
  WHEN NOT coalesce((SELECT auth.jwt()->>'aal') = 'aal2', false) THEN NULL
  WHEN vertice_private.is_master() THEN 'master'
  ELSE (SELECT m.role FROM public.vertice_memberships m
    WHERE m.user_id=(SELECT auth.uid()) AND m.institution_id=target)
 END;
$$;
CREATE OR REPLACE FUNCTION vertice_private.has_role(target uuid,roles text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(vertice_private.member_role(target)='master'
   OR vertice_private.member_role(target)=ANY(roles),false);
$$;
REVOKE ALL ON FUNCTION vertice_private.member_role(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION vertice_private.has_role(uuid,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_private.member_role(uuid),
  vertice_private.has_role(uuid,text[]) TO authenticated;

CREATE TABLE public.vertice_learning_staff_scope(
 institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id) ON DELETE CASCADE,
 course_id uuid NOT NULL,
 subject_code text NOT NULL CHECK(length(subject_code) BETWEEN 1 AND 120),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 granted_by uuid REFERENCES auth.users(id),
 granted_at timestamptz NOT NULL DEFAULT now(),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(institution_id,course_id,subject_code,user_id),
 FOREIGN KEY(course_id,institution_id) REFERENCES public.vertice_courses(id,institution_id)
);
ALTER TABLE public.vertice_learning_staff_scope ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vertice_learning_staff_scope FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.vertice_learning_staff_scope TO authenticated;
GRANT ALL ON public.vertice_learning_staff_scope TO service_role;
CREATE POLICY learning_staff_read
 ON public.vertice_learning_staff_scope FOR SELECT TO authenticated
 USING (
  (user_id=(SELECT auth.uid()) AND (SELECT auth.jwt()->>'aal')='aal2')
  OR (vertice_private.can_read_institution(institution_id)
   AND vertice_private.has_role(institution_id,
    ARRAY['gestor','reitor','diretor_geral','diretor_pedagogico','procurador']))
 );
CREATE POLICY learning_staff_manage_insert
 ON public.vertice_learning_staff_scope FOR INSERT TO authenticated
 WITH CHECK (vertice_private.can_read_institution(institution_id)
   AND vertice_private.has_role(institution_id,
     ARRAY['gestor','reitor','diretor_geral','diretor_pedagogico','procurador']));
CREATE POLICY learning_staff_manage_update
 ON public.vertice_learning_staff_scope FOR UPDATE TO authenticated
 USING (vertice_private.can_read_institution(institution_id)
   AND vertice_private.has_role(institution_id,
     ARRAY['gestor','reitor','diretor_geral','diretor_pedagogico','procurador']))
 WITH CHECK (vertice_private.can_read_institution(institution_id)
   AND vertice_private.has_role(institution_id,
     ARRAY['gestor','reitor','diretor_geral','diretor_pedagogico','procurador']));
CREATE POLICY learning_staff_manage_delete
 ON public.vertice_learning_staff_scope FOR DELETE TO authenticated
 USING (vertice_private.can_read_institution(institution_id)
   AND vertice_private.has_role(institution_id,
     ARRAY['gestor','reitor','diretor_geral','diretor_pedagogico','procurador']));
COMMIT;
