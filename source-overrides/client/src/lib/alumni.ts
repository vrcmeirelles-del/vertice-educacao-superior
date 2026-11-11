// alumni.ts — Queries e tipos para Egressos 360°
import { supabase } from './supabase';

/* ── Tipos ── */

export interface AlumniProfile {
  id: string;
  full_name: string;
  social_name?: string;
  email?: string;
  phone?: string;
  preferred_channel: string;
  contact_updated_at?: string;
  comm_opt_out: boolean;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface AlumniEducation {
  id: string;
  profile_id: string;
  institution_id: string;
  course_id?: string;
  enrollment_id?: string;
  modality?: string;
  degree?: string;
  admission_year?: number;
  admission_semester?: number;
  academic_status: string;
  conclusion_year?: number;
  conclusion_semester?: number;
  graduation_date?: string;
  diploma_date?: string;
  status_source: string;
  status_verified: boolean;
  created_at: string;
  updated_at: string;
  // joins
  profile?: AlumniProfile;
  course_name?: string;
}

export interface AlumniOverview {
  institution_id: string;
  course_id?: string;
  course_name?: string;
  modality?: string;
  academic_status: string;
  conclusion_year?: number;
  conclusion_semester?: number;
  status_verified: boolean;
  total_egressos: number;
  com_contato_valido: number;
  contato_atualizado_12m: number;
}

export type AcademicStatus =
  | 'ativo' | 'provavel_concluinte' | 'concluinte' | 'integralizado'
  | 'formado' | 'diplomado' | 'egresso_acompanhado'
  | 'desistente' | 'transferido' | 'jubilado' | 'cancelado';

export const STATUS_LABELS: Record<AcademicStatus, string> = {
  ativo: 'Ativo',
  provavel_concluinte: 'Provável concluinte',
  concluinte: 'Concluinte',
  integralizado: 'Integralizado',
  formado: 'Formado',
  diplomado: 'Diplomado',
  egresso_acompanhado: 'Em acompanhamento',
  desistente: 'Desistente',
  transferido: 'Transferido',
  jubilado: 'Jubilado',
  cancelado: 'Cancelado',
};

export const EGRESSO_STATUSES: AcademicStatus[] = [
  'formado', 'diplomado', 'egresso_acompanhado', 'integralizado', 'concluinte',
];

/* ── Queries ── */

export async function fetchAlumniOverview(institutionId: string): Promise<AlumniOverview[]> {
  const { data, error } = await supabase
    .from('vertice_alumni_overview')
    .select('*')
    .eq('institution_id', institutionId);
  if (error) throw error;
  return (data ?? []) as AlumniOverview[];
}

export async function fetchAlumniEducation(
  institutionId: string,
  opts?: { courseId?: string; status?: string; page?: number; pageSize?: number }
): Promise<{ rows: AlumniEducation[]; count: number }> {
  const page = opts?.page ?? 0;
  const size = opts?.pageSize ?? 50;
  let q = supabase
    .from('vertice_alumni_education')
    .select(`
      *,
      profile:vertice_alumni_profiles!profile_id(id, full_name, social_name, email, phone, preferred_channel, comm_opt_out, contact_updated_at)
    `, { count: 'exact' })
    .eq('institution_id', institutionId)
    .order('conclusion_year', { ascending: false, nullsFirst: false })
    .order('full_name', { foreignTable: 'vertice_alumni_profiles', ascending: true })
    .range(page * size, (page + 1) * size - 1);

  if (opts?.courseId) q = q.eq('course_id', opts.courseId);
  if (opts?.status) q = q.eq('academic_status', opts.status);

  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as AlumniEducation[], count: count ?? 0 };
}

export async function fetchAlumniStats(institutionId: string) {
  const { data, error } = await supabase.rpc('alumni_stats_by_institution', {
    p_institution_id: institutionId,
  });
  // fallback: count from overview view
  if (error) {
    const overview = await fetchAlumniOverview(institutionId);
    const total = overview.reduce((s, r) => s + r.total_egressos, 0);
    const comContato = overview.reduce((s, r) => s + r.com_contato_valido, 0);
    const atualizado = overview.reduce((s, r) => s + r.contato_atualizado_12m, 0);
    return { total, comContato, atualizado, porCurso: overview };
  }
  return data;
}

/* ── Import CSV/XLSX helper ── */

export interface AlumniImportRow {
  nome: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  curso?: string;
  matricula?: string;
  modalidade?: string;
  grau?: string;
  ano_ingresso?: number;
  semestre_ingresso?: number;
  situacao?: string;
  ano_conclusao?: number;
  semestre_conclusao?: number;
  data_colacao?: string;
}

export async function importAlumniRows(
  rows: AlumniImportRow[],
  institutionId: string,
  courseMap: Map<string, string> // nome_curso → course_id
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      // Hash CPF se disponível
      const cpfDigits = row.cpf?.replace(/\D/g, '') ?? '';
      const cpfHash = cpfDigits.length === 11
        ? await hashCPF(cpfDigits)
        : null;

      // Upsert profile via RPC
      const { data: profileId, error: profErr } = await supabase.rpc('alumni_find_or_create_profile', {
        p_cpf_hash: cpfHash,
        p_full_name: row.nome.trim(),
        p_email: row.email?.trim() || null,
        p_phone: row.telefone?.trim() || null,
        p_source: 'import',
      });
      if (profErr) { errors.push(`${row.nome}: ${profErr.message}`); skipped++; continue; }

      // Resolve course
      const courseId = row.curso ? courseMap.get(row.curso.trim().toUpperCase()) ?? null : null;

      // Map status
      const statusMap: Record<string, AcademicStatus> = {
        'MATRICULADO': 'ativo', 'ATIVO': 'ativo',
        'CONCLUINTE': 'concluinte', 'INTEGRALIZADO': 'integralizado',
        'FORMADO': 'formado', 'DIPLOMADO': 'diplomado',
        'DESISTENTE': 'desistente', 'CANCELADO': 'cancelado',
        'TRANSFERIDO': 'transferido', 'TRANCADO': 'ativo',
      };
      const rawStatus = (row.situacao ?? 'ativo').trim().toUpperCase();
      const status: AcademicStatus = statusMap[rawStatus] ?? 'ativo';

      // Insert education
      const { error: edErr } = await supabase.from('vertice_alumni_education').upsert({
        profile_id: profileId,
        institution_id: institutionId,
        course_id: courseId,
        enrollment_id: row.matricula?.trim() || null,
        modality: row.modalidade?.trim() || null,
        degree: row.grau?.trim() || null,
        admission_year: row.ano_ingresso || null,
        admission_semester: row.semestre_ingresso || null,
        academic_status: status,
        conclusion_year: row.ano_conclusao || null,
        conclusion_semester: row.semestre_conclusao || null,
        graduation_date: row.data_colacao || null,
        status_source: 'import',
      }, { onConflict: 'institution_id,course_id,enrollment_id' });

      if (edErr) { errors.push(`${row.nome}: ${edErr.message}`); skipped++; }
      else { imported++; }
    } catch (e: any) {
      errors.push(`${row.nome}: ${e.message}`);
      skipped++;
    }
  }
  return { imported, skipped, errors };
}

async function hashCPF(cpfDigits: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(cpfDigits);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
