-- Restringe a leitura de cpf_hash e email do cadastro de alunos para o papel authenticated.
-- Motivo: o painel não precisa desses campos; só funções internas (definer/service_role) devem lê-los.
-- Escrita (INSERT/UPDATE) continua liberada; upsert da importação segue funcionando.
--
-- Verificado antes de escrever:
--  * vertice_conecta_access / _student / _surveys_student: invoker, EXECUTE só para service_role (não afetadas).
--  * vertice_ac_student_login, internship_form_write: SECURITY DEFINER (não afetadas).
--  * único objeto dependente com papel authenticated: view v_student_academic_performance (coluna fato_ordem_linked).
--    Passa a usar função definer que devolve só um booleano.
-- Nota: fato_ordem_linked antes respeitava a RLS de vertice_roster_entries de quem consulta;
--       agora é calculado com permissão da função (só booleano, só para alunos que a pessoa já enxerga).

BEGIN;

CREATE OR REPLACE FUNCTION vertice_private.registry_fo_linked(p_registry_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.vertice_student_registry sr
      JOIN public.vertice_roster_entries re ON re.cpf_hash = sr.cpf_hash AND re.status = 'linked'
     WHERE sr.id = p_registry_id
  );
$$;
REVOKE ALL ON FUNCTION vertice_private.registry_fo_linked(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION vertice_private.registry_fo_linked(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.v_student_academic_performance WITH (security_invoker = true) AS
SELECT sr.id AS student_id, sr.institution_id, sr.course_id, sr.full_name, sr.enrollment_code,
  vertice_private.registry_fo_linked(sr.id) AS fato_ordem_linked,
  ( SELECT ee.elegibility_type FROM public.vertice_enade_eligibility ee
     WHERE ee.matricula = sr.enrollment_code AND ee.institution_id = sr.institution_id
     ORDER BY ee.created_at DESC LIMIT 1) AS enade_classification,
  ( SELECT count(*) FROM public.vertice_tcc_works w
      JOIN public.vertice_tcc_participants p ON p.work_id = w.id AND p.enrollment_id = sr.id::text
     WHERE w.stage <> ALL (ARRAY['cancelled','archived'])) AS tcc_count,
  ( SELECT COALESCE(sum(le.signed_minutes), 0::bigint) FROM public.vertice_ac_ledger_entries le WHERE le.student_id = sr.id) AS ac_credited_minutes,
  ( SELECT count(*) FROM public.vertice_internship_placements ip
     WHERE ip.student_id = sr.id AND ip.lifecycle <> ALL (ARRAY['cancelled','academic_rejected'])) AS estagio_count,
  ( SELECT count(*) FROM public.vertice_extension_students es WHERE es.identity_id = sr.id) AS extensao_count
FROM public.vertice_student_registry sr;

DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'vertice_student_registry'
     AND column_name NOT IN ('cpf_hash', 'email');
  EXECUTE 'REVOKE SELECT ON public.vertice_student_registry FROM authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.vertice_student_registry TO authenticated', cols);
END $$;

COMMIT;

-- Verificação (como authenticated no app): a aba Atividades Complementares e o Raio-X devem carregar normalmente;
--   select has_column_privilege('authenticated','public.vertice_student_registry','cpf_hash','SELECT');  -- false
--   select has_column_privilege('authenticated','public.vertice_student_registry','full_name','SELECT'); -- true
-- Reversão: GRANT SELECT ON public.vertice_student_registry TO authenticated;
