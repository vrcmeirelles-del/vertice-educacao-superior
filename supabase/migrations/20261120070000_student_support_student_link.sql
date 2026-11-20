-- Vínculo do caso de apoio/PEI com a base de alunos, com busca por nome ou matrícula.
--
-- Fontes (consultadas em 20/11/2026):
--   * Escolas:  vertice_planning.school_students (0 registros hoje; a escola de demonstração ainda não tem alunos).
--   * Superior: public.vertice_student_registry (251 registros: 250 não verificados, 1 verificado).
--
-- O que esta migration faz:
--   1. Acrescenta duas colunas opcionais em student_support_cases, uma por fonte, com chave estrangeira
--      e no máximo uma preenchida. Os campos student_name e student_matricula continuam sendo gravados,
--      então casos antigos e casos digitados à mão seguem funcionando.
--   2. Cria a função de busca vertice_support_student_search(instituição, texto), com os mesmos limites
--      de acesso das tabelas de apoio (master e gestor, com segundo fator), mínimo de 2 caracteres e
--      no máximo 25 resultados. A função escolhe a fonte pelo tier da instituição.
--
-- Ordem: rodar esta migration ANTES de publicar o código que chama a função.

BEGIN;

-- 1. Vínculo opcional com o cadastro de origem
ALTER TABLE public.student_support_cases
  ADD COLUMN IF NOT EXISTS school_student_id uuid
    REFERENCES vertice_planning.school_students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registry_student_id uuid
    REFERENCES public.vertice_student_registry(id) ON DELETE SET NULL;

ALTER TABLE public.student_support_cases
  DROP CONSTRAINT IF EXISTS student_support_cases_one_student_ref;
ALTER TABLE public.student_support_cases
  ADD CONSTRAINT student_support_cases_one_student_ref
  CHECK (school_student_id IS NULL OR registry_student_id IS NULL);

CREATE INDEX IF NOT EXISTS student_support_cases_school_student_idx
  ON public.student_support_cases (school_student_id) WHERE school_student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS student_support_cases_registry_student_idx
  ON public.student_support_cases (registry_student_id) WHERE registry_student_id IS NOT NULL;

-- 2. Busca de alunos
CREATE OR REPLACE FUNCTION vertice_private.support_student_search(p_institution uuid, p_query text)
RETURNS TABLE(student_source text, student_id uuid, student_name text, enrollment_code text, group_label text, verified boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  q text := lower(left(btrim(coalesce(p_query, '')), 120));
  v_tier text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE = '42501';
  END IF;
  IF coalesce(vertice_private.member_role(p_institution), '') NOT IN ('master', 'gestor') THEN
    RAISE EXCEPTION 'Busca de estudantes restrita à gestão autorizada, com segundo fator' USING ERRCODE = '42501';
  END IF;
  IF length(q) < 2 THEN
    RETURN;
  END IF;

  SELECT i.tier INTO v_tier FROM public.vertice_institutions i WHERE i.id = p_institution;

  IF v_tier = 'escolas' THEN
    RETURN QUERY
      SELECT 'school'::text, s.id, s.full_name::text, s.enrollment_code::text,
             (c.name || ' · ' || c.year)::text, true
      FROM vertice_planning.school_students s
      JOIN public.vertice_school_classes c ON c.id = s.class_id
      WHERE s.institution_id = p_institution
        AND s.status = 'active'
        AND (strpos(lower(s.full_name), q) > 0 OR strpos(lower(s.enrollment_code), q) > 0)
      ORDER BY lower(s.full_name), s.id
      LIMIT 25;
  ELSE
    RETURN QUERY
      SELECT 'registry'::text, r.id, r.full_name::text, r.enrollment_code::text,
             co.name::text, coalesce(r.verified, false)
      FROM public.vertice_student_registry r
      LEFT JOIN public.vertice_courses co ON co.id = r.course_id
      WHERE r.institution_id = p_institution
        AND r.academic_status = 'active'
        AND (strpos(lower(r.full_name), q) > 0 OR strpos(lower(r.enrollment_code), q) > 0)
      ORDER BY lower(r.full_name), r.id
      LIMIT 25;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.vertice_support_student_search(p_institution uuid, p_query text)
RETURNS TABLE(student_source text, student_id uuid, student_name text, enrollment_code text, group_label text, verified boolean)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT * FROM vertice_private.support_student_search(p_institution, p_query);
$$;

REVOKE ALL ON FUNCTION vertice_private.support_student_search(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vertice_support_student_search(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vertice_private.support_student_search(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_support_student_search(uuid, text) TO authenticated, service_role;

COMMIT;

-- Verificação (rodar depois):
--   select column_name from information_schema.columns
--    where table_name='student_support_cases' and column_name in ('school_student_id','registry_student_id');
--   -- esperado: 2 linhas
--   select p.proname, n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where p.proname in ('support_student_search','vertice_support_student_search');
--   -- esperado: 2 linhas
--
-- Reversão:
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.vertice_support_student_search(uuid, text);
--   DROP FUNCTION IF EXISTS vertice_private.support_student_search(uuid, text);
--   ALTER TABLE public.student_support_cases
--     DROP CONSTRAINT IF EXISTS student_support_cases_one_student_ref,
--     DROP COLUMN IF EXISTS school_student_id,
--     DROP COLUMN IF EXISTS registry_student_id;
--   COMMIT;
