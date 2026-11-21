-- Sinais do Sapiens (Fato & Ordem) no Vértice: tradução de token para matrícula.
-- O Fato & Ordem envia apenas tokens; a matrícula e o curso ficam na Vértice, que já os detém.
-- Somente a função de borda (service_role) chama esta função, após validar sessão, MFA e papel.
CREATE OR REPLACE FUNCTION public.vertice_sapiens_signal_roster(p_institution uuid, p_tokens text[])
RETURNS TABLE(student_token text, course_id uuid, course_name text, enrollment_ref text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT l.student_token::text, l.course_id, c.name, l.enrollment_ref
    FROM vertice_private.learning_students l
    JOIN public.vertice_courses c ON c.id = l.course_id AND c.institution_id = l.institution_id
   WHERE l.institution_id = p_institution
     AND l.active
     AND cardinality(p_tokens) <= 20000
     AND l.student_token = ANY(p_tokens);
$$;
REVOKE ALL ON FUNCTION public.vertice_sapiens_signal_roster(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_sapiens_signal_roster(uuid, text[]) TO service_role;
