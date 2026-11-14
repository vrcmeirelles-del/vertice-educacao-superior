// tcc.ts — Query layer para TCC e Produção Acadêmica 360
import { supabase } from './supabase';

// ── Types ──

export interface TccWorkType {
  id: string; institution_id: string; code: string; label: string;
  description: string | null; requires_defense: boolean; requires_qualification: boolean; active: boolean;
}

export interface TccWork {
  id: string; institution_id: string; course_id: string;
  academic_term: string; work_type_id: string; title: string;
  abstract: string | null; keywords: string[] | null;
  problem_statement: string | null; justification: string | null;
  general_objective: string | null; specific_objectives: string[] | null;
  methodology: string | null; research_line: string | null; modality: string | null;
  stage: string; version: number;
  stage_deadline: string | null;
  created_at: string; updated_at: string;
  // joined
  work_type?: TccWorkType;
  course_name?: string;
  authors?: TccParticipant[];
  advisor?: TccParticipant;
}

export interface TccParticipant {
  id: string; institution_id: string; work_id: string;
  person_name: string; person_email: string | null; enrollment_id: string | null;
  course_id: string | null; role: string;
  valid_from: string; valid_until: string | null;
  replaced_by_id: string | null; replacement_reason: string | null;
}

export interface TccVersion {
  id: string; work_id: string; version_number: number; version_type: string;
  submitted_by: string | null; submitted_at: string;
  source_mode: string; document_id: string | null; external_url: string | null;
  visibility: string; doi: string | null; content_hash: string | null;
}

export interface TccTask {
  id: string; work_id: string; title: string; description: string | null;
  responsible: string; deadline: string | null; status: string;
  evidence: string | null; completed_at: string | null;
}

export interface TccSupervision {
  id: string; work_id: string; supervision_type: string; modality: string | null;
  scheduled_at: string | null; held_at: string | null; duration_minutes: number | null;
  participants: string[] | null; agenda: string | null; decisions: string | null;
  pending_items: string | null; next_steps: string | null; status: string;
  recorded_by: string;
}

export interface TccDefense {
  id: string; work_id: string; defense_type: string;
  scheduled_at: string | null; location: string | null; status: string;
  result: string | null; final_grade: number | null; notes: string | null;
  members?: TccDefenseMember[];
}

export interface TccDefenseMember {
  id: string; member_name: string; member_email: string | null;
  member_institution: string | null; role: string; is_external: boolean;
  grade: number | null; opinion: string | null;
}

export interface TccReferenceSet {
  id: string; course_id: string; reference_type: string;
  title: string; version_label: string; is_active: boolean;
  effective_from: string | null;
}

export interface TccReferenceElement {
  id: string; reference_set_id: string; kind: string;
  code: string | null; text: string; applicability: string;
  sdg_goal_id: number | null; sdg_target_id: number | null;
}

export interface TccAlignmentSuggestion {
  id: string; work_id: string; reference_element_id: string;
  evidence_scope: string; strength: string;
  work_excerpt: string | null; reference_excerpt: string | null;
  rationale: string; limitations: string[] | null;
  latest_decision?: string;
}

export interface TccHourDeclaration {
  id: string; work_id: string; participant_id: string; person_name: string;
  activity_type: string; declared_minutes: number; activity_date: string;
  status: string; validated_by: string | null;
}

export interface TccCourseSummary {
  institution_id: string; course_id: string; course_name: string;
  works_total: number; works_active: number; authors_distinct: number;
  works_draft: number; works_in_review: number; works_approved: number;
  works_in_execution: number; works_final_phase: number; works_assessed: number;
  works_deposited: number; works_overdue: number; advisors_active: number;
  hours_validated_minutes: number; alignments_validated: number; alignments_total: number;
}

// ── Stage labels ──
export const STAGE_LABELS: Record<string, string> = {
  draft: 'Rascunho', submitted: 'Submetido', under_review: 'Em análise',
  changes_requested: 'Ajustes solicitados', project_approved: 'Projeto aprovado',
  in_execution: 'Em execução', final_submitted: 'Versão final submetida',
  defense_scheduled: 'Banca agendada', assessed: 'Avaliado',
  post_defense_changes: 'Correções pós-banca', final_validated: 'Final validado',
  deposited: 'Depositado', suspended: 'Suspenso', cancelled: 'Cancelado', archived: 'Arquivado',
};

export const STAGE_COLORS: Record<string, string> = {
  draft: '#94a3b8', submitted: '#3b82f6', under_review: '#8b5cf6',
  changes_requested: '#f59e0b', project_approved: '#10b981',
  in_execution: '#0891b2', final_submitted: '#6366f1',
  defense_scheduled: '#ec4899', assessed: '#14b8a6',
  post_defense_changes: '#f97316', final_validated: '#22c55e',
  deposited: '#059669', suspended: '#ef4444', cancelled: '#dc2626', archived: '#64748b',
};

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  orientation: 'Orientação', coorientation: 'Coorientação', meeting: 'Reunião',
  research: 'Pesquisa', data_analysis: 'Análise de dados', writing: 'Redação',
  revision: 'Revisão', defense: 'Banca', other: 'Outra',
};

export const ROLE_LABELS: Record<string, string> = {
  author: 'Autor(a)', discipline_teacher: 'Professor(a) da disciplina',
  advisor: 'Orientador(a)', coadvisor: 'Coorientador(a)',
  examiner: 'Examinador(a)', reviewer: 'Revisor(a)',
};

// ── Queries ──

export async function fetchWorkTypes(institutionId: string) {
  const { data, error } = await supabase.from('vertice_tcc_work_types')
    .select('*').eq('institution_id', institutionId).eq('active', true).order('label');
  if (error) throw error;
  return (data ?? []) as TccWorkType[];
}

export async function fetchWorks(institutionId: string, courseId?: string) {
  let q = supabase.from('vertice_tcc_works').select('*, work_type:vertice_tcc_work_types(*)')
    .eq('institution_id', institutionId).order('updated_at', { ascending: false });
  if (courseId) q = q.eq('course_id', courseId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TccWork[];
}

export async function fetchWorkDetail(workId: string) {
  const { data } = await supabase.from('vertice_tcc_works')
    .select('*, work_type:vertice_tcc_work_types(*)').eq('id', workId).maybeSingle();
  return data as TccWork | null;
}

export async function fetchParticipants(workId: string) {
  const { data } = await supabase.from('vertice_tcc_participants')
    .select('*').eq('work_id', workId).order('role').order('valid_from');
  return (data ?? []) as TccParticipant[];
}

export async function fetchVersions(workId: string) {
  const { data } = await supabase.from('vertice_tcc_versions')
    .select('*').eq('work_id', workId).order('version_number', { ascending: false });
  return (data ?? []) as TccVersion[];
}

export async function fetchTasks(workId: string) {
  const { data } = await supabase.from('vertice_tcc_tasks')
    .select('*').eq('work_id', workId).order('deadline');
  return (data ?? []) as TccTask[];
}

export async function fetchSupervisions(workId: string) {
  const { data } = await supabase.from('vertice_tcc_supervisions')
    .select('*').eq('work_id', workId).order('scheduled_at', { ascending: false });
  return (data ?? []) as TccSupervision[];
}

export async function fetchDefenses(workId: string) {
  const { data } = await supabase.from('vertice_tcc_defenses')
    .select('*, members:vertice_tcc_defense_members(*)').eq('work_id', workId).order('scheduled_at', { ascending: false });
  return (data ?? []) as TccDefense[];
}

export async function fetchReferenceSets(institutionId: string, courseId: string) {
  const { data } = await supabase.from('vertice_tcc_reference_sets')
    .select('*').eq('institution_id', institutionId).eq('course_id', courseId).order('created_at', { ascending: false });
  return (data ?? []) as TccReferenceSet[];
}

export async function fetchReferenceElements(referenceSetId: string) {
  const { data } = await supabase.from('vertice_tcc_reference_elements')
    .select('*').eq('reference_set_id', referenceSetId).order('kind').order('code');
  return (data ?? []) as TccReferenceElement[];
}

export async function fetchAlignmentSuggestions(workId: string) {
  const { data } = await supabase.from('vertice_tcc_alignment_suggestions')
    .select('*').eq('work_id', workId).order('created_at', { ascending: false });
  return (data ?? []) as TccAlignmentSuggestion[];
}

export async function fetchHourDeclarations(workId: string) {
  const { data } = await supabase.from('vertice_tcc_hour_declarations')
    .select('*').eq('work_id', workId).order('activity_date', { ascending: false });
  return (data ?? []) as TccHourDeclaration[];
}

export async function fetchCourseSummary(institutionId: string) {
  const { data, error } = await supabase.from('v_tcc_course_summary')
    .select('*').eq('institution_id', institutionId);
  if (error) throw error;
  return (data ?? []) as TccCourseSummary[];
}

export async function fetchTransitions(workId: string) {
  const { data } = await supabase.from('vertice_tcc_transitions')
    .select('*').eq('work_id', workId).order('created_at', { ascending: false });
  return (data ?? []) as any[];
}

export async function fetchSdgLinks(workId: string) {
  const { data } = await supabase.from('vertice_tcc_sdg_links')
    .select('*, goal:vertice_sdg_goals(*), target:vertice_sdg_targets(*)')
    .eq('work_id', workId);
  return (data ?? []) as any[];
}

// ── Mutations ──

export async function createWork(work: Partial<TccWork>) {
  const { data, error } = await supabase.from('vertice_tcc_works').insert(work).select().single();
  if (error) throw error;
  return data as TccWork;
}

export async function updateWork(id: string, updates: Partial<TccWork>) {
  const { data, error } = await supabase.from('vertice_tcc_works')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data as TccWork;
}

export async function createParticipant(p: Partial<TccParticipant>) {
  const { data, error } = await supabase.from('vertice_tcc_participants').insert(p).select().single();
  if (error) throw error;
  return data as TccParticipant;
}

export async function createTask(t: Partial<TccTask> & { institution_id: string }) {
  const { data, error } = await supabase.from('vertice_tcc_tasks').insert(t).select().single();
  if (error) throw error;
  return data as TccTask;
}

export async function updateTask(id: string, updates: Partial<TccTask>) {
  const { data, error } = await supabase.from('vertice_tcc_tasks')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data as TccTask;
}

export async function createSupervision(s: Partial<TccSupervision> & { institution_id: string }) {
  const { data, error } = await supabase.from('vertice_tcc_supervisions').insert(s).select().single();
  if (error) throw error;
  return data as TccSupervision;
}

export async function createVersion(v: Partial<TccVersion> & { institution_id: string }) {
  const { data, error } = await supabase.from('vertice_tcc_versions').insert(v).select().single();
  if (error) throw error;
  return data as TccVersion;
}

export async function createDefense(d: Partial<TccDefense> & { institution_id: string }) {
  const { data, error } = await supabase.from('vertice_tcc_defenses').insert(d).select().single();
  if (error) throw error;
  return data as TccDefense;
}

export async function createHourDeclaration(h: Partial<TccHourDeclaration> & { institution_id: string }) {
  const { data, error } = await supabase.from('vertice_tcc_hour_declarations').insert(h).select().single();
  if (error) throw error;
  return data as TccHourDeclaration;
}

export async function transitionWork(workId: string, institutionId: string, toStage: string, reason: string, actorName: string, actorRole: string, expectedVersion: number) {
  // Insert transition record
  await supabase.from('vertice_tcc_transitions').insert({
    institution_id: institutionId, work_id: workId,
    from_stage: '', to_stage: toStage, reason, actor_name: actorName,
    actor_role: actorRole, expected_version: expectedVersion,
  });
  // Update work stage
  const { data, error } = await supabase.from('vertice_tcc_works')
    .update({ stage: toStage, version: expectedVersion + 1, updated_at: new Date().toISOString() })
    .eq('id', workId).eq('version', expectedVersion).select().single();
  if (error) throw error;
  return data as TccWork;
}

// ── Helpers ──

export function minutesToHours(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h${min}min` : `${h}h`;
}
