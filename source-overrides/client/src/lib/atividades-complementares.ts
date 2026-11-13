// atividades-complementares.ts — Query layer para AC 360
import { supabase } from './supabase';

export interface AcRule { id: string; institution_id: string; course_id: string; curriculum_version: string; rule_version: string; total_required_minutes: number; is_active: boolean; effective_from: string; }
export interface AcCategory { id: string; rule_id: string; code: string; label: string; description: string|null; max_per_item_minutes: number|null; max_category_minutes: number|null; conversion_numerator: number; conversion_denominator: number; sort_order: number; }
export interface AcSubmission { id: string; student_id: string; rule_id: string; category_id: string|null; title: string; issuer: string|null; documentary_minutes: number|null; status: string; created_at: string; updated_at: string; }
export interface AcExtraction { id: string; submission_id: string; participant_name: string|null; issuer: string|null; event_title: string|null; documentary_minutes: number|null; extraction_quality: string|null; suggested_category_id: string|null; warnings: string[]|null; }
export interface AcDecision { id: string; submission_id: string; decision: string; awarded_minutes: number|null; reviewer_name: string; reason: string|null; decided_at: string; }
export interface AcStudentBalance { institution_id: string; student_id: string; full_name: string; enrollment_code: string; course_id: string; rule_id: string; total_required_minutes: number; credited_minutes: number; remaining_minutes: number; submissions_total: number; submissions_pending: number; }
export interface AcCourseSummary { institution_id: string; course_id: string; course_name: string; students_with_rule: number; students_with_submissions: number; submissions_total: number; submissions_pending: number; submissions_approved: number; total_credited_minutes: number; }
export interface StudentRegistryEntry { id: string; institution_id: string; course_id: string; enrollment_code: string; full_name: string; email: string; academic_status: string; verified: boolean; }

export const AC_STATUS_LABELS: Record<string,string> = {
  draft:'Rascunho', submitted:'Submetido', extracting:'Extraindo', suggestion_ready:'Sugestão pronta',
  under_review:'Em análise', adjustments_requested:'Ajuste solicitado', approved:'Deferido',
  partially_approved:'Parcialmente deferido', denied:'Indeferido', credited:'Creditado',
  report_sent:'Relatório enviado', posting_confirmed:'Lançamento confirmado',
};

export const PROTOCOL_STATUS_LABELS: Record<string,string> = {
  generated:'Gerado', awaiting_signature:'Aguardando assinatura', signed:'Assinado',
  sent:'Enviado', received:'Recebido', posted:'Lançado', returned:'Devolvido', superseded:'Substituído',
};

export async function fetchAcRules(instId: string, courseId?: string) {
  let q = supabase.from('vertice_ac_rules').select('*').eq('institution_id', instId).eq('is_active', true);
  if (courseId) q = q.eq('course_id', courseId);
  const { data } = await q.order('course_id');
  return (data ?? []) as AcRule[];
}
export async function fetchAcCategories(ruleId: string) {
  const { data } = await supabase.from('vertice_ac_categories').select('*').eq('rule_id', ruleId).order('sort_order');
  return (data ?? []) as AcCategory[];
}
export async function fetchAcSubmissions(instId: string, studentId?: string) {
  let q = supabase.from('vertice_ac_submissions').select('*').eq('institution_id', instId).order('updated_at', { ascending: false });
  if (studentId) q = q.eq('student_id', studentId);
  const { data } = await q;
  return (data ?? []) as AcSubmission[];
}
export async function fetchAcStudentBalance(instId: string) {
  const { data } = await supabase.from('v_ac_student_balance').select('*').eq('institution_id', instId);
  return (data ?? []) as AcStudentBalance[];
}
export async function fetchAcCourseSummary(instId: string) {
  const { data } = await supabase.from('v_ac_course_summary').select('*').eq('institution_id', instId);
  return (data ?? []) as AcCourseSummary[];
}
export async function fetchStudentRegistry(instId: string, courseId?: string) {
  let q = supabase.from('vertice_student_registry').select('*').eq('institution_id', instId);
  if (courseId) q = q.eq('course_id', courseId);
  const { data } = await q.order('full_name').limit(500);
  return (data ?? []) as StudentRegistryEntry[];
}
export async function fetchProtocols(instId: string, module: string) {
  const { data } = await supabase.from('vertice_secretariat_protocols').select('*').eq('institution_id', instId).eq('module', module).order('created_at', { ascending: false });
  return (data ?? []) as any[];
}
export function minutesToHours(m: number): string {
  const h = Math.floor(m / 60); const min = m % 60;
  return min > 0 ? `${h}h${min}min` : `${h}h`;
}
