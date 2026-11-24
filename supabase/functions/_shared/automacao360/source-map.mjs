// Matriz de rastreabilidade das 40 regras: fonte real verificada em produção (somente metadados)
// em 24/11/2026. Fonte "identificada" = tabela/visão existe com os campos necessários; não significa
// regra validada. Nenhuma regra é "validada" antes de comparação em modo sombra com dados autorizados.
// Gerador: scripts/automacao360/gerar-matriz.mjs (seed SQL e docs/automacao360/MATRIZ_REGRAS.md).
import { RULES } from './catalog.mjs';

const I = 'identificada', P = 'pendente';
const map = {
  'repo.overdue': ['documentary', I, 'public.vertice_repository_requests (due_date, active, not_applicable) + public.vertice_repository_files (status enviado/validado)', 'public.vertice_automation_source_documentary', 'Gestão documental; 5W2H por aprovação humana', 'Massa real: 1.461 solicitações ativas, 902 com prazo, 777 arquivos.'],
  'repo.due': ['documentary', I, 'mesma fonte de repo.overdue', 'public.vertice_automation_source_documentary', 'Responsável documental; 5W2H por aprovação humana', 'Status "devolvido" não existe nos dados atuais; 559 solicitações sem prazo são relatadas, não contadas como atraso.'],
  'sapiens.low': ['pedagogical', I, 'public.vertice_learning_course_metrics (competency, semester, graded, correct, paired_students)', null, 'Coordenação/NDE; Sapiens', 'A tabela não registra validação humana do agregado nem pré-nota; o adaptador não pode afirmar status validated sem essa origem.'],
  'curriculum.gap': ['pedagogical', I, 'vertice_app.curriculum_builds + curriculum_competencies + curriculum_discipline_links', null, 'NDE; Construção Curricular', 'Exige build aprovado como matriz versionada.'],
  'avalia.recovery': ['pedagogical', I, 'public.vertice_avalia_recovery_plans (status, rules_version)', null, 'Docente; Avalia 360°', 'Consome o motor existente do Avalia; não recalcula.'],
  'enade.gap': ['pedagogical', P, 'public.vertice_enade_course_config + vertice_enade360_records; matriz oficial de competências não localizada', null, 'Coordenação', 'Sem matriz oficial versionada a regra se abstém.'],
  'enamed.gap': ['pedagogical', P, 'fo_enamed_items pertence ao Fato & Ordem (outro produto); sem matriz ENAMED na Vértice', null, 'Coordenação médica', 'Não usar dados do Fato & Ordem sem contrato próprio (AGENTS.md).'],
  'cpa.pending': ['cpa', I, 'public.vertice_cpa_actions (status, due_date, evidence_description, evidence_url) + vertice_cpa_findings', 'public.vertice_automation_source_planning', 'CPA', 'Mapeamento resolvido: ações da CPA sem evidência registrada.'],
  'retention.alert': ['pedagogical', I, 'vertice_app.alerts (motor de Permanência existente) / public.v_student_evasion_risk', null, 'Permanência', 'Consome alertas confirmados do motor existente (0 registros hoje); não cria risco individual.'],
  'pei.overdue': ['planning', I, 'public.vertice_actions (due_date, status) vinculadas a public.vertice_goals institucionais', 'public.vertice_automation_source_planning', 'Gestor da meta', 'Mapeamento resolvido. PEI aqui = Planejamento Estratégico Institucional. pei_alerts e vertice_pei_alerts_refresh são do Plano Educacional Individualizado (homônimo) e não são fonte desta regra.'],
  'extension.pending': ['academic', I, 'public.vertice_extension_evidence + vertice_extension_projects', null, 'Extensão', ''],
  'teaching.pending': ['academic', P, 'certificados de Atividades de Ensino: nenhuma tabela de certificados encontrada', null, 'Ensino', 'Sem registro de certificados emitidos a regra se abstém.'],
  'internship.due': ['academic', I, 'public.vertice_internship_reports (due_date, status) + vertice_internship_placements', null, 'Estágio', ''],
  'tcc.overdue': ['academic', I, 'public.vertice_tcc_works (stage_deadline, stage); já calculado em public.v_institutional_alerts', null, 'Orientação', 'Reutilizar v_institutional_alerts; não recalcular.'],
  'ac.duplicate': ['academic', I, 'public.vertice_ac_duplicate_checks (resolution)', null, 'AC', 'Sinaliza candidato; não indefere.'],
  'alumni.pending': ['strategic', I, 'public.vertice_alumni_survey_invitations (responded_at, delivery_status)', null, 'Egressos', ''],
  'capture.stale': ['strategic', P, 'public.vertice_captacao_leads (etapa_funil, updated_at); política de SLA inexistente', null, 'Captação', 'Sem política de SLA versionada a regra se abstém.'],
  'market.new': ['strategic', I, 'vertice_market.sightings (descobertas a revisar)', null, 'Inteligência de Mercado', 'Rotina vertice-market-public-discovery-daily já coleta; não duplicar.'],
  'due.pending': ['strategic', I, 'public.dd_requirements + dd_requirement_state', null, 'Due Diligence', ''],
  'school.attendance': ['schools', I, 'vertice_planning.school_student_events + public.vertice_school_indicators', null, 'Gestão escolar', 'Mapeamento resolvido; 0 eventos hoje. Só a IES de nível escolas.'],
  'finance.overdue': ['strategic', P, 'public.vertice_invoices é o faturamento da própria Vértice às IES, não a mensalidade de alunos', null, 'Financeiro', 'Divergência de semântica: não existe fonte de inadimplência de alunos.'],
  'internship.overdue': ['academic', I, 'public.vertice_internship_reports; já calculado em public.v_institutional_alerts (overdue_report)', null, 'Estágio', 'Reutilizar v_institutional_alerts.'],
  'internship.hours': ['academic', I, 'public.vertice_internship_ledger_entries + vertice_internship_requirements', null, 'Estágio', ''],
  'internship.documents': ['academic', I, 'public.vertice_internship_forms + vertice_internship_requirements', null, 'Estágio', ''],
  'tcc.due': ['academic', I, 'public.vertice_tcc_works (stage_deadline, stage)', null, 'Orientação', ''],
  'tcc.documents': ['academic', I, 'public.vertice_tcc_forms + vertice_tcc_versions', null, 'Orientação', ''],
  'extension.hours': ['academic', I, 'public.vertice_extension_hour_entries (minutes, hour_state) + vertice_extension_policies', null, 'Extensão', ''],
  'extension.certificates': ['academic', P, 'nenhuma tabela de certificados de extensão encontrada', null, 'Extensão', 'Sem certificados emitidos registrados a regra se abstém.'],
  'teaching.hours': ['academic', I, 'public.vertice_teaching_activities (total_minutes, status) + vertice_private.teaching_activity_students', null, 'Ensino', ''],
  'teaching.documents': ['academic', I, 'public.vertice_teaching_activities (evidence_photos, evidence_attendance, report_submitted_at)', null, 'Ensino', ''],
  'ac.hours': ['academic', I, 'public.vertice_ac_ledger_entries / v_ac_student_balance + vertice_ac_rules', null, 'AC', ''],
  'ac.documents': ['academic', I, 'public.vertice_ac_submissions; parada > 15 dias já em v_institutional_alerts', null, 'AC', ''],
  'capture.conversion': ['strategic', I, 'public.vertice_captacao_leads (etapa_funil lead→matricula)', null, 'Captação', 'Maturidade de coorte ainda não definida pela IES.'],
  'capture.sla': ['strategic', P, 'política de SLA inexistente', null, 'Captação', ''],
  'competition.change': ['strategic', I, 'vertice_planning.competitive_events + competitive_findings', null, 'Planejamento', 'Acesso só por gateway autorizado (Bloco 07).'],
  'market.transaction': ['strategic', I, 'vertice_market.operations', null, 'Inteligência de Mercado', 'Distingue descoberta (sightings) de operação (operations).'],
  'due.blocker': ['strategic', I, 'public.dd_findings + dd_finding_history', null, 'Due Diligence', ''],
  'finance.arrears': ['strategic', P, 'sem fonte de saldo devido/vencido de alunos', null, 'Financeiro', 'Mesma divergência de finance.overdue.'],
  'finance.cashgap': ['strategic', P, 'sem fonte conciliada de caixa', null, 'Financeiro', ''],
  'alumni.response': ['strategic', I, 'public.vertice_alumni_survey_invitations (responded_at, delivery_status)', null, 'Egressos', ''],
};

export const SOURCE_MAP = Object.freeze(RULES.map((r) => {
  const m = map[r.id];
  if (!m) throw Error('regra sem mapeamento: ' + r.id);
  const [family, sourceStatus, source, adapter, destination, note] = m;
  return Object.freeze({ id: r.id, module: r.module, version: r.version, priority: r.priority, cadence: r.cadence, metric: r.metric, operator: r.op, threshold: r.threshold, minimum: r.minMetric ? { [r.minMetric]: r.min } : null, family, sourceStatus, source, adapter, destination, note });
}));
if (Object.keys(map).length !== RULES.length) throw Error('mapa com regra fora do catálogo');
