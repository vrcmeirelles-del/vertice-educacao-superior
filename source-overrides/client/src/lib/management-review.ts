import type { Row } from './area';
import { instrumentIndicators, isInstrumentRequest, latestDocuments, repositorySemester } from './repository';

export type ReviewData = { goals: Row[]; measurements: Row[]; actions: Row[]; diagnosis: Row[]; requests: Row[]; files: Row[] };
/** Read-only reconciliation: never scores documents or infers regulatory applicability. */
export function managementReview(data: ReviewData, institutionId: string, courseId: string, semester: string) {
  const scoped = (rows: Row[]) => rows.filter(r => r.institution_id === institutionId);
  const goals = scoped(data.goals).filter(g => g.course_id === courseId && g.status !== 'cancelada');
  const requests = scoped(data.requests).filter(r => r.course_id === courseId && r.active !== false && isInstrumentRequest(r) && (!semester || repositorySemester(r.semester) === repositorySemester(semester)));
  const requestIds = new Set(requests.map(r => r.id));
  // Select latest version BEFORE classification: newer support material cannot revive old evidence.
  const latest = latestDocuments(scoped(data.files).filter(f => requestIds.has(String(f.request_id))));
  const evidence = requests.map(request => {
    const file = latest.get(request.id);
    const eligible = file && (!file.document_category || file.document_category === 'instrumento');
    const state = request.not_applicable === true ? 'nsa' : !file ? 'pendente' : !eligible ? 'classificacao' : String(file.status);
    return { request, file, state, indicators: instrumentIndicators(request.indicator) };
  });
  const reconciled = goals.map(goal => {
    const documents = evidence.filter(e => e.request.goal_id === goal.id);
    const measurements = scoped(data.measurements).filter(m => m.goal_id === goal.id && m.value !== null && m.value !== '' && m.value !== undefined && Number.isFinite(Number(m.value))).sort((a,b) => String(a.measured_on).localeCompare(String(b.measured_on)) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) || a.id.localeCompare(b.id));
    const actions = scoped(data.actions).filter(a => a.goal_id === goal.id && a.course_id === courseId && a.status !== 'cancelada');
    const gaps = [!measurements.length && 'Sem medição válida: não é possível comprovar o resultado da meta.', !documents.length && 'Sem exigência documental vinculada neste recorte.', !actions.length && 'Sem ação 5W2H vinculada ao curso e à meta.', documents.some(e => e.state === 'pendente') && 'Há documento ainda não enviado.', documents.some(e => e.state === 'enviado') && 'Há envio aguardando validação humana.', documents.some(e => e.state === 'devolvido') && 'Há documento devolvido para correção.', documents.some(e => e.state === 'classificacao') && 'Última versão não está classificada como evidência do instrumento.'].filter(Boolean) as string[];
    return { goal, documents, actions, latestMeasurement: measurements.at(-1), gaps };
  });
  const codes = [...new Set(evidence.flatMap(e => e.indicators))].sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
  return { goals: reconciled, evidence, indicators: codes.map(code => ({ code, evidence: evidence.filter(e => e.indicators.includes(code)) })), unlinked: evidence.filter(e => !e.request.goal_id || !goals.some(g => g.id === e.request.goal_id)), diagnosis: scoped(data.diagnosis).filter(d => d.course_id === courseId), concept: null };
}
