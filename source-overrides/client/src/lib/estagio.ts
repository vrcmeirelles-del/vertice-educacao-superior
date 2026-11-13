// estagio.ts — Query layer para Estágio Obrigatório 360
import { supabase } from './supabase';

export interface InternshipOrg { id: string; name: string; trade_name: string|null; identifier: string|null; city: string|null; status: string; }
export interface InternshipField { id: string; organization_id: string; name: string; location_type: string; capacity: number|null; status: string; area_of_practice: string|null; }
export interface InternshipRule { id: string; course_id: string; component_name: string; curriculum_version: string; total_required_minutes: number; max_daily_minutes: number|null; is_active: boolean; }
export interface InternshipPlacement { id: string; student_id: string; course_id: string; rule_id: string; field_id: string; organization_id: string; nature: string; location_type: string; starts_at: string; ends_at: string|null; advisor_name: string|null; supervisor_name: string|null; lifecycle: string; version: number; created_at: string; student_name?: string; course_name?: string; org_name?: string; field_name?: string; }
export interface InternshipAttendance { id: string; placement_id: string; activity_date: string; started_at: string; ended_at: string; break_minutes: number; net_minutes: number; activity_description: string|null; field_confirmed_by: string|null; academic_decision: string|null; }
export interface InternshipReport { id: string; placement_id: string; report_type: string; period_start: string|null; period_end: string|null; status: string; due_date: string|null; }
export interface InternshipCourseSummary { institution_id: string; course_id: string; course_name: string; placements_total: number; placements_active: number; internal_count: number; external_count: number; students_distinct: number; completed: number; sent_to_secretariat: number; hours_validated_minutes: number; organizations_count: number; }

export const LIFECYCLE_LABELS: Record<string,string> = {
  requested:'Solicitado', preparing:'Em preparação', under_review:'Em análise',
  adjustments:'Ajustes', authorized:'Autorizado', active:'Em andamento',
  suspended:'Suspenso', field_change:'Mudança de campo', operationally_ended:'Encerrado operacionalmente',
  academic_review:'Em avaliação final', academic_approved:'Aprovado academicamente',
  academic_rejected:'Reprovado', sent_to_secretariat:'Encaminhado à secretaria',
  posting_confirmed:'Lançamento confirmado', cancelled:'Cancelado',
};

export const LIFECYCLE_COLORS: Record<string,string> = {
  requested:'#94a3b8', preparing:'#3b82f6', under_review:'#8b5cf6', adjustments:'#f59e0b',
  authorized:'#10b981', active:'#0891b2', suspended:'#ef4444', field_change:'#f97316',
  operationally_ended:'#6366f1', academic_review:'#ec4899', academic_approved:'#22c55e',
  academic_rejected:'#dc2626', sent_to_secretariat:'#7c3aed', posting_confirmed:'#059669', cancelled:'#64748b',
};

export async function fetchOrganizations(instId: string) {
  const { data } = await supabase.from('vertice_internship_organizations').select('*').eq('institution_id', instId).order('name');
  return (data ?? []) as InternshipOrg[];
}
export async function fetchFields(instId: string, orgId?: string) {
  let q = supabase.from('vertice_internship_fields').select('*').eq('institution_id', instId);
  if (orgId) q = q.eq('organization_id', orgId);
  const { data } = await q.order('name');
  return (data ?? []) as InternshipField[];
}
export async function fetchInternshipRules(instId: string, courseId?: string) {
  let q = supabase.from('vertice_internship_rules').select('*').eq('institution_id', instId).eq('is_active', true);
  if (courseId) q = q.eq('course_id', courseId);
  const { data } = await q.order('component_name');
  return (data ?? []) as InternshipRule[];
}
export async function fetchPlacements(instId: string, courseId?: string) {
  let q = supabase.from('vertice_internship_placements').select('*').eq('institution_id', instId).order('created_at', { ascending: false });
  if (courseId) q = q.eq('course_id', courseId);
  const { data } = await q;
  return (data ?? []) as InternshipPlacement[];
}
export async function fetchAttendance(placementId: string) {
  const { data } = await supabase.from('vertice_internship_attendance').select('*').eq('placement_id', placementId).order('activity_date', { ascending: false });
  return (data ?? []) as InternshipAttendance[];
}
export async function fetchReports(placementId: string) {
  const { data } = await supabase.from('vertice_internship_reports').select('*').eq('placement_id', placementId).order('period_start', { ascending: false });
  return (data ?? []) as InternshipReport[];
}
export async function fetchInternshipCourseSummary(instId: string) {
  const { data } = await supabase.from('v_internship_course_summary').select('*').eq('institution_id', instId);
  return (data ?? []) as InternshipCourseSummary[];
}
export function minutesToHours(m: number): string {
  const h = Math.floor(m / 60); const min = m % 60;
  return min > 0 ? `${h}h${min}min` : `${h}h`;
}
