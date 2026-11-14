// cpa.ts — Queries e tipos para CPA e Autoavaliação Institucional
import { supabase } from './supabase';

/* ── Tipos ── */

export interface CpaReference { id: string; code: string; title: string; version: string; status: string; source_url?: string; notes?: string; }
export interface CpaReferenceObject { id: string; reference_id: string; object_code: string; internal_code?: string; axis?: string; title: string; description?: string; sort_order: number; }
export interface CpaMember { id: string; institution_id: string; full_name: string; role: string; segment?: string; appointment_ref?: string; start_date?: string; end_date?: string; active: boolean; }
export interface CpaMeeting { id: string; institution_id: string; meeting_date: string; title?: string; agenda?: string; minutes_url?: string; decisions?: string; }
export interface CpaCycle { id: string; institution_id: string; title: string; reference_id?: string; start_date?: string; end_date?: string; status: string; methodology?: string; }
export interface CpaInstrument { notes?: string | null; id: string; institution_id: string; cycle_id?: string; title: string; version: number; target_audience: string; status: string; course_id?: string; }
export interface CpaCampaign { id: string; institution_id: string; cycle_id?: string; instrument_id: string; title: string; opens_at: string; closes_at: string; target_audience: string; status: string; channels: string[]; complementary_hours_enabled: boolean; }
export interface CpaFinding { id: string; institution_id: string; cycle_id?: string; finding_type: string; dimension?: string; title: string; description?: string; indicator_name?: string; indicator_value?: number; decision_status: string; decision_notes?: string; reference_object_id?: string; created_at: string; }
export interface CpaAction { id: string; finding_id: string; title: string; responsible?: string; due_date?: string; status: string; evidence_url?: string; efficacy_assessment?: string; }
export interface CpaFeedback { id: string; institution_id: string; cycle_id?: string; title: string; audience?: string; channel?: string; delivered_at?: string; }
export interface CpaCampaignIndicator { campaign_id: string; campaign_title: string; target_audience: string; campaign_status: string; total_eligible: number; total_invited: number; total_delivered: number; total_completed: number; total_in_progress: number; total_abandoned: number; pct_completion?: number; }
export interface CpaCycleSummary { cycle_id: string; cycle_title: string; cycle_status: string; campaigns: number; findings: number; findings_deliberated: number; actions: number; actions_completed: number; actions_with_evidence: number; feedbacks_delivered: number; }

/* ── Queries ── */

export const fetchReferences = async () => {
  const { data, error } = await supabase.from('vertice_cpa_references').select('*').order('version', { ascending: false });
  if (error) throw error; return (data ?? []) as CpaReference[];
};
export const fetchReferenceObjects = async (refId: string) => {
  const { data, error } = await supabase.from('vertice_cpa_reference_objects').select('*').eq('reference_id', refId).order('sort_order');
  if (error) throw error; return (data ?? []) as CpaReferenceObject[];
};
export const fetchMembers = async (instId: string) => {
  const { data, error } = await supabase.from('vertice_cpa_members').select('*').eq('institution_id', instId).order('active', { ascending: false });
  if (error) throw error; return (data ?? []) as CpaMember[];
};
export const fetchMeetings = async (instId: string) => {
  const { data, error } = await supabase.from('vertice_cpa_meetings').select('*').eq('institution_id', instId).order('meeting_date', { ascending: false }).limit(50);
  if (error) throw error; return (data ?? []) as CpaMeeting[];
};
export const fetchCycles = async (instId: string) => {
  const { data, error } = await supabase.from('vertice_cpa_cycles').select('*').eq('institution_id', instId).order('created_at', { ascending: false });
  if (error) throw error; return (data ?? []) as CpaCycle[];
};
export const fetchInstruments = async (instId: string) => {
  const { data, error } = await supabase.from('vertice_cpa_instruments').select('*').eq('institution_id', instId).order('created_at', { ascending: false });
  if (error) throw error; return (data ?? []) as CpaInstrument[];
};
export const fetchCampaigns = async (instId: string) => {
  const { data, error } = await supabase.from('vertice_cpa_campaigns').select('*').eq('institution_id', instId).order('created_at', { ascending: false });
  if (error) throw error; return (data ?? []) as CpaCampaign[];
};
export const fetchCpaFindings = async (instId: string) => {
  const { data, error } = await supabase.from('vertice_cpa_findings').select('*').eq('institution_id', instId).order('created_at', { ascending: false });
  if (error) throw error; return (data ?? []) as CpaFinding[];
};
export const fetchCpaActions = async (instId: string) => {
  const { data, error } = await supabase.from('vertice_cpa_actions').select('*').eq('institution_id', instId).order('created_at', { ascending: false });
  if (error) throw error; return (data ?? []) as CpaAction[];
};
export const fetchCpaFeedbacks = async (instId: string) => {
  const { data, error } = await supabase.from('vertice_cpa_feedbacks').select('*').eq('institution_id', instId).order('created_at', { ascending: false });
  if (error) throw error; return (data ?? []) as CpaFeedback[];
};
export const fetchCampaignIndicators = async (instId: string) => {
  const { data, error } = await supabase.from('v_cpa_campaign_indicators').select('*').eq('institution_id', instId);
  if (error) throw error; return (data ?? []) as CpaCampaignIndicator[];
};
export const fetchCycleSummary = async (instId: string) => {
  const { data, error } = await supabase.from('v_cpa_cycle_summary').select('*').eq('institution_id', instId);
  if (error) throw error; return (data ?? []) as CpaCycleSummary[];
};

/* ── Mutations ── */

export const createCycle = async (cycle: Partial<CpaCycle> & { institution_id: string }) => {
  const { data, error } = await supabase.from('vertice_cpa_cycles').insert(cycle).select().single();
  if (error) throw error; return data as CpaCycle;
};
export const createInstrument = async (inst: Partial<CpaInstrument> & { institution_id: string }) => {
  const { data, error } = await supabase.from('vertice_cpa_instruments').insert(inst).select().single();
  if (error) throw error; return data as CpaInstrument;
};
export const createCampaign = async (camp: Partial<CpaCampaign> & { institution_id: string; instrument_id: string }) => {
  const { data, error } = await supabase.from('vertice_cpa_campaigns').insert(camp).select().single();
  if (error) throw error; return data as CpaCampaign;
};
export const createCpaFinding = async (f: Partial<CpaFinding> & { institution_id: string }) => {
  const { data, error } = await supabase.from('vertice_cpa_findings').insert(f).select().single();
  if (error) throw error; return data as CpaFinding;
};
export const createCpaAction = async (a: Partial<CpaAction> & { finding_id: string; institution_id: string }) => {
  const { data, error } = await supabase.from('vertice_cpa_actions').insert(a).select().single();
  if (error) throw error; return data as CpaAction;
};
export const updateCpaActionStatus = async (id: string, status: string, evidence?: { url?: string; efficacy?: string }) => {
  const u: any = { status, updated_at: new Date().toISOString() };
  if (evidence?.url) u.evidence_url = evidence.url;
  if (evidence?.efficacy) u.efficacy_assessment = evidence.efficacy;
  if (status === 'avaliada') u.evaluated_at = new Date().toISOString();
  const { error } = await supabase.from('vertice_cpa_actions').update(u).eq('id', id);
  if (error) throw error;
};
export const createMember = async (m: Partial<CpaMember> & { institution_id: string; full_name: string; role: string }) => {
  const { data, error } = await supabase.from('vertice_cpa_members').insert(m).select().single();
  if (error) throw error; return data as CpaMember;
};
export const createFeedback = async (f: Partial<CpaFeedback> & { institution_id: string; title: string }) => {
  const { data, error } = await supabase.from('vertice_cpa_feedbacks').insert(f).select().single();
  if (error) throw error; return data as CpaFeedback;
};

/* ── Questões ── */

export interface CpaQuestion {
  id: string; instrument_id: string; stable_code: string; sort_order: number;
  section?: string; dimension?: string; question_text: string; objective?: string;
  question_type: string; scale_config?: any; options?: any; required: boolean;
  sinaes_axis?: string; sinaes_dimension?: string; segment?: string; category?: string;
  reference_object_id?: string; descriptor_code?: string;
  depends_on?: string; show_when_value?: string;
  created_at: string;
}

export const fetchQuestions = async (instrumentId: string) => {
  const { data, error } = await supabase.from('vertice_cpa_questions').select('*').eq('instrument_id', instrumentId).order('sort_order');
  if (error) throw error; return (data ?? []) as CpaQuestion[];
};
export const createQuestion = async (q: Partial<CpaQuestion> & { instrument_id: string; stable_code: string; question_text: string; question_type: string }) => {
  const { data, error } = await supabase.from('vertice_cpa_questions').insert(q).select().single();
  if (error) throw error; return data as CpaQuestion;
};
export const updateQuestion = async (id: string, updates: Partial<CpaQuestion>) => {
  const { data, error } = await supabase.from('vertice_cpa_questions').update(updates).eq('id', id).select().single();
  if (error) throw error; return data as CpaQuestion;
};
export const deleteQuestion = async (id: string) => {
  const { error } = await supabase.from('vertice_cpa_questions').delete().eq('id', id);
  if (error) throw error;
};
export const updateInstrument = async (id: string, updates: Partial<CpaInstrument>) => {
  const { data, error } = await supabase.from('vertice_cpa_instruments').update(updates).eq('id', id).select().single();
  if (error) throw error; return data as CpaInstrument;
};
