-- View: Risco de evasão cruzando módulos acadêmicos
-- Aluno com: AC pendente + TCC atrasado + estágio sem vínculo = alto risco
CREATE OR REPLACE VIEW v_student_evasion_risk AS
SELECT
  sr.id AS student_id,
  sr.institution_id,
  sr.course_id,
  sr.full_name,
  sr.enrollment_code,
  sr.academic_status,
  -- AC
  COALESCE(bal.credited_minutes, 0) AS ac_credited_minutes,
  COALESCE(bal.remaining_minutes, bal.total_required_minutes, 0) AS ac_remaining_minutes,
  COALESCE(bal.submissions_total, 0) AS ac_submissions,
  -- TCC
  (SELECT count(*) FROM vertice_tcc_works w 
   JOIN vertice_tcc_participants p ON p.work_id = w.id AND p.enrollment_id = sr.id
   WHERE w.stage NOT IN ('cancelled','archived','deposited')) AS tcc_active,
  (SELECT count(*) FROM vertice_tcc_works w 
   JOIN vertice_tcc_participants p ON p.work_id = w.id AND p.enrollment_id = sr.id
   WHERE w.stage NOT IN ('cancelled','archived','deposited') 
   AND w.stage_deadline IS NOT NULL AND w.stage_deadline < now()) AS tcc_overdue,
  -- Estágio
  (SELECT count(*) FROM vertice_internship_placements ip 
   WHERE ip.student_id = sr.id AND ip.lifecycle NOT IN ('posting_confirmed','academic_rejected','cancelled')) AS estagio_active,
  (SELECT count(*) FROM vertice_internship_placements ip 
   WHERE ip.student_id = sr.id AND ip.lifecycle IN ('posting_confirmed')) AS estagio_completed,
  -- Score de risco (0-100, maior = pior)
  LEAST(100, (
    CASE WHEN COALESCE(bal.remaining_minutes, 0) > 0 AND COALESCE(bal.submissions_total, 0) = 0 THEN 30 ELSE 0 END +
    CASE WHEN (SELECT count(*) FROM vertice_tcc_works w JOIN vertice_tcc_participants p ON p.work_id = w.id AND p.enrollment_id = sr.id WHERE w.stage NOT IN ('cancelled','archived','deposited') AND w.stage_deadline < now()) > 0 THEN 30 ELSE 0 END +
    CASE WHEN (SELECT count(*) FROM vertice_internship_placements ip WHERE ip.student_id = sr.id) = 0 THEN 20 ELSE 0 END +
    CASE WHEN sr.academic_status IN ('trancado','cancelado','jubilado') THEN 20 ELSE 0 END
  )) AS risk_score,
  -- Flags
  CASE 
    WHEN COALESCE(bal.remaining_minutes, 0) > 0 AND COALESCE(bal.submissions_total, 0) = 0 
      AND (SELECT count(*) FROM vertice_tcc_works w JOIN vertice_tcc_participants p ON p.work_id = w.id AND p.enrollment_id = sr.id WHERE w.stage NOT IN ('cancelled','archived','deposited') AND w.stage_deadline < now()) > 0
    THEN 'critical'
    WHEN COALESCE(bal.remaining_minutes, 0) > 0 AND COALESCE(bal.submissions_total, 0) = 0 THEN 'high'
    WHEN (SELECT count(*) FROM vertice_tcc_works w JOIN vertice_tcc_participants p ON p.work_id = w.id AND p.enrollment_id = sr.id WHERE w.stage NOT IN ('cancelled','archived','deposited') AND w.stage_deadline < now()) > 0 THEN 'high'
    WHEN (SELECT count(*) FROM vertice_internship_placements ip WHERE ip.student_id = sr.id) = 0 THEN 'medium'
    ELSE 'low'
  END AS risk_level
FROM vertice_student_registry sr
LEFT JOIN v_ac_student_balance bal ON bal.student_id = sr.id;

-- View: Captação ↔ módulos (leads que matricularam vs engajamento acadêmico)
CREATE OR REPLACE VIEW v_captacao_academic_engagement AS
SELECT
  l.institution_id,
  l.course_id,
  l.enrollment_semester,
  count(*) AS leads_total,
  count(*) FILTER (WHERE l.stage = 'matriculado') AS matriculados,
  count(*) FILTER (WHERE l.stage IN ('desistente','cancelado','trancamento')) AS evadidos,
  -- Engajamento dos matriculados nos módulos
  (SELECT count(DISTINCT w.id) FROM vertice_tcc_works w WHERE w.institution_id = l.institution_id AND w.course_id = l.course_id AND w.stage NOT IN ('cancelled','archived')) AS tcc_ativos,
  (SELECT coalesce(s.submissions_total, 0) FROM v_ac_course_summary s WHERE s.institution_id = l.institution_id AND s.course_id = l.course_id) AS ac_submissions,
  (SELECT coalesce(s.placements_total, 0) FROM v_internship_course_summary s WHERE s.institution_id = l.institution_id AND s.course_id = l.course_id) AS estagio_vinculos,
  (SELECT count(*) FROM vertice_extension_projects ep WHERE ep.course_ids @> ARRAY[l.course_id]) AS extensao_projetos
FROM vertice_captacao_leads l
GROUP BY l.institution_id, l.course_id, l.enrollment_semester;

-- View: Desempenho F&O cruzado com módulos acadêmicos
-- Usa vertice_roster_entries (alunos linkados) + vertice_enade_eligibility
CREATE OR REPLACE VIEW v_student_academic_performance AS
SELECT
  sr.id AS student_id,
  sr.institution_id,
  sr.course_id,
  sr.full_name,
  sr.enrollment_code,
  -- F&O linkado?
  (SELECT count(*) FROM vertice_roster_entries re WHERE re.student_registry_id = sr.id AND re.status = 'linked') > 0 AS fato_ordem_linked,
  -- ENADE elegível?
  (SELECT ee.classification FROM vertice_enade_eligibility ee WHERE ee.student_id = sr.id ORDER BY ee.created_at DESC LIMIT 1) AS enade_classification,
  -- Módulos acadêmicos
  (SELECT count(*) FROM vertice_tcc_works w JOIN vertice_tcc_participants p ON p.work_id = w.id AND p.enrollment_id = sr.id WHERE w.stage NOT IN ('cancelled','archived')) AS tcc_count,
  (SELECT coalesce(sum(le.delta_minutes), 0) FROM vertice_ac_ledger_entries le WHERE le.student_id = sr.id) AS ac_credited_minutes,
  (SELECT count(*) FROM vertice_internship_placements ip WHERE ip.student_id = sr.id AND ip.lifecycle NOT IN ('cancelled','academic_rejected')) AS estagio_count,
  (SELECT count(*) FROM vertice_extension_students es WHERE es.student_registry_id = sr.id) AS extensao_count
FROM vertice_student_registry sr;
