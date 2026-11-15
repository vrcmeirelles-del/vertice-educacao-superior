/**
 * Consultas aos dados espelhados do e-ORBIT (Supabase).
 *
 * Cada função retorna dados já filtrados por instituição e,
 * opcionalmente, por semestre. RLS ativo no banco.
 */

import { supabase } from '@/lib/supabase';
import type {
  Semestre, CursoEorbit, CursoNormalizado, Quantitativo, Enade,
  CompliancePlano, CompliancePlanoDetalhe, ComplianceNotas, ComplianceNotasDetalhe,
  DiarioClasse, FrequenciaConteudo, Professor,
  VestibularEdital, VestibularCurso,
  BibliotecaResumo, BibliotecaCDD, BibliotecaDecada,
  FiltroEorbit, ResumoQuantitativo, ResumoCompliance, ResumoDiario,
} from './types';

// ---------------------------------------------------------------- helper
async function fetchAll<T>(
  table: string,
  filters: Record<string, unknown>,
  order = 'id',
  columns = '*',
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(columns).order(order, { ascending: true });
    if (order !== 'id') q = q.order('id', { ascending: true });
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '') q = q.eq(k, v);
    }
    const { data, error } = await q.range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

// ---------------------------------------------------------------- Semestres
export async function getSemestres(instId: string): Promise<Semestre[]> {
  return fetchAll<Semestre>('vertice_eorbit_semestres', { instituicao_id: instId }, 'semestre', '*,codigo:semestre');
}

// ---------------------------------------------------------------- Cursos
export async function getCursos(instId: string): Promise<CursoEorbit[]> {
  return fetchAll<CursoEorbit>('vertice_eorbit_cursos', { instituicao_id: instId }, 'nome');
}

export async function getCursosNormalizados(instId: string): Promise<CursoNormalizado[]> {
  return fetchAll<CursoNormalizado>('vertice_eorbit_cursos_normalizados', { instituicao_id: instId }, 'curso_canonico', '*,nome_normalizado:curso_canonico');
}

// ---------------------------------------------------------------- Quantitativo
export async function getQuantitativo(filtro: FiltroEorbit): Promise<Quantitativo[]> {
  const filters: Record<string, unknown> = { instituicao_id: filtro.instituicaoId };
  if (filtro.semestreId) filters.semestre_id = filtro.semestreId;
  if (filtro.cursoId) filters.curso_id = filtro.cursoId;
  return fetchAll<Quantitativo>('vertice_eorbit_quantitativo', filters, 'semestre_id');
}

export async function getResumoQuantitativo(
  instId: string,
  semestres: Semestre[],
): Promise<ResumoQuantitativo[]> {
  const all = await getQuantitativo({ instituicaoId: instId });
  const semMap = new Map(semestres.map(s => [s.id, s.codigo]));

  const bySem = new Map<number, Quantitativo[]>();
  for (const q of all) {
    if (!bySem.has(q.semestre_id)) bySem.set(q.semestre_id, []);
    bySem.get(q.semestre_id)!.push(q);
  }

  return [...bySem.entries()]
    .map(([semId, rows]) => ({
      semestreId: semId,
      semestre: semMap.get(semId) ?? `sem_${semId}`,
      totalMatriculados: rows.reduce((s, r) => s + r.total_matriculados, 0),
      totalVinculos: rows.reduce((s, r) => s + r.total_vinculos, 0),
      preMatriculado: rows.reduce((s, r) => s + r.pre_matriculado, 0),
      trancado: rows.reduce((s, r) => s + r.trancado, 0),
      abandono: rows.reduce((s, r) => s + r.abandono, 0),
      concluido: rows.reduce((s, r) => s + r.concluido, 0),
      transferido: rows.reduce((s, r) => s + r.transferido, 0),
      cancelado: rows.reduce((s, r) => s + r.cancelado, 0),
    }))
    .sort((a, b) => a.semestre.localeCompare(b.semestre));
}

// ---------------------------------------------------------------- ENADE
export async function getEnade(instId: string): Promise<Enade[]> {
  return fetchAll<Enade>('vertice_eorbit_enade', { instituicao_id: instId }, 'semestre');
}

// ---------------------------------------------------------------- Compliance
export async function getCompliancePlano(filtro: FiltroEorbit): Promise<CompliancePlano[]> {
  const filters: Record<string, unknown> = { instituicao_id: filtro.instituicaoId };
  if (filtro.semestreId) filters.semestre_id = filtro.semestreId;
  return fetchAll<CompliancePlano>('vertice_eorbit_compliance_plano', filters, 'semestre_id',
    '*,enviados:plano_enviado,nao_enviados:plano_nao_enviado,percentual_envio:percentual_conformidade');
}

export async function getCompliancePlanoDetalhe(filtro: FiltroEorbit): Promise<CompliancePlanoDetalhe[]> {
  const filters: Record<string, unknown> = { instituicao_id: filtro.instituicaoId };
  if (filtro.semestreId) filters.semestre_id = filtro.semestreId;
  if (filtro.cursoId) filters.curso_id = filtro.cursoId;
  return fetchAll<CompliancePlanoDetalhe>('vertice_eorbit_compliance_plano_detalhe', filters, 'semestre_id');
}

export async function getComplianceNotas(filtro: FiltroEorbit): Promise<ComplianceNotas[]> {
  const filters: Record<string, unknown> = { instituicao_id: filtro.instituicaoId };
  if (filtro.semestreId) filters.semestre_id = filtro.semestreId;
  return fetchAll<ComplianceNotas>('vertice_eorbit_compliance_notas', filters, 'semestre_id',
    '*,postadas:notas_postadas,nao_postadas:notas_nao_postadas,percentual_postagem:percentual_conformidade');
}

export async function getComplianceNotasDetalhe(filtro: FiltroEorbit): Promise<ComplianceNotasDetalhe[]> {
  const filters: Record<string, unknown> = { instituicao_id: filtro.instituicaoId };
  if (filtro.semestreId) filters.semestre_id = filtro.semestreId;
  if (filtro.cursoId) filters.curso_id = filtro.cursoId;
  return fetchAll<ComplianceNotasDetalhe>('vertice_eorbit_compliance_notas_detalhe', filters, 'semestre_id');
}

export async function getResumoCompliance(
  instId: string,
  semestres: Semestre[],
): Promise<ResumoCompliance[]> {
  const [planos, notas] = await Promise.all([
    getCompliancePlano({ instituicaoId: instId }),
    getComplianceNotas({ instituicaoId: instId }),
  ]);
  const semMap = new Map(semestres.map(s => [s.id, s.codigo]));
  const result: ResumoCompliance[] = [];

  // Plano
  const planosBySem = new Map<number, CompliancePlano[]>();
  for (const p of planos) {
    if (!planosBySem.has(p.semestre_id)) planosBySem.set(p.semestre_id, []);
    planosBySem.get(p.semestre_id)!.push(p);
  }
  for (const [semId, rows] of planosBySem) {
    const total = rows.reduce((s, r) => s + r.total_disciplinas, 0);
    const env = rows.reduce((s, r) => s + r.enviados, 0);
    result.push({
      tipo: 'plano',
      semestreId: semId,
      semestre: semMap.get(semId) ?? `sem_${semId}`,
      totalDisciplinas: total,
      conformes: env,
      naoConformes: total - env,
      percentual: total > 0 ? (env / total) * 100 : 0,
    });
  }

  // Notas
  const notasBySem = new Map<number, ComplianceNotas[]>();
  for (const n of notas) {
    if (!notasBySem.has(n.semestre_id)) notasBySem.set(n.semestre_id, []);
    notasBySem.get(n.semestre_id)!.push(n);
  }
  for (const [semId, rows] of notasBySem) {
    const total = rows.reduce((s, r) => s + r.total_disciplinas, 0);
    const post = rows.reduce((s, r) => s + r.postadas, 0);
    result.push({
      tipo: 'notas',
      semestreId: semId,
      semestre: semMap.get(semId) ?? `sem_${semId}`,
      totalDisciplinas: total,
      conformes: post,
      naoConformes: total - post,
      percentual: total > 0 ? (post / total) * 100 : 0,
    });
  }

  return result.sort((a, b) => a.semestre.localeCompare(b.semestre) || a.tipo.localeCompare(b.tipo));
}

// ---------------------------------------------------------------- Diário de Classe
export async function getDiarioClasse(filtro: FiltroEorbit): Promise<DiarioClasse[]> {
  const filters: Record<string, unknown> = { instituicao_id: filtro.instituicaoId };
  if (filtro.semestreId) filters.semestre_id = filtro.semestreId;
  if (filtro.cursoId) filters.curso_id = filtro.cursoId;
  return fetchAll<DiarioClasse>('vertice_eorbit_diario_classe', filters, 'semestre_id');
}

export async function getResumoDiario(
  instId: string,
  semestres: Semestre[],
): Promise<ResumoDiario[]> {
  const all = await getDiarioClasse({ instituicaoId: instId });
  const semMap = new Map(semestres.map(s => [s.id, s.codigo]));

  const bySem = new Map<number, DiarioClasse[]>();
  for (const d of all) {
    if (!bySem.has(d.semestre_id)) bySem.set(d.semestre_id, []);
    bySem.get(d.semestre_id)!.push(d);
  }

  return [...bySem.entries()].map(([semId, rows]) => ({
    semestreId: semId,
    semestre: semMap.get(semId) ?? `sem_${semId}`,
    totalRegistros: rows.length,
    planoOk: rows.filter(r => r.status_plano === 'p').length,
    notasOk: rows.filter(r => r.status_notas === 'p').length,
    conteudoOk: rows.filter(r => r.status_conteudo === 'p').length,
    cadastroOk: rows.filter(r => r.status_cadastro === 'm').length,
  })).sort((a, b) => a.semestre.localeCompare(b.semestre));
}

// ---------------------------------------------------------------- Frequência de Conteúdo
export async function getFrequenciaConteudo(filtro: FiltroEorbit): Promise<FrequenciaConteudo[]> {
  const filters: Record<string, unknown> = { instituicao_id: filtro.instituicaoId };
  if (filtro.semestreId) {
    // frequencia_conteudo uses 'semestre' string, not semestre_id
  }
  return fetchAll<FrequenciaConteudo>('vertice_eorbit_frequencia_conteudo', filters, 'semestre');
}

// ---------------------------------------------------------------- Professores
export async function getProfessores(instId: string): Promise<Professor[]> {
  return fetchAll<Professor>('vertice_eorbit_professores', { instituicao_id: instId }, 'nome');
}

// ---------------------------------------------------------------- Vestibular
export async function getVestibularEditais(instId: string): Promise<VestibularEdital[]> {
  return fetchAll<VestibularEdital>('vertice_eorbit_vestibular_editais', { instituicao_id: instId }, 'edital_id',
    '*,codigo:edital_id,descricao:edital_nome');
}

export async function getVestibularCursos(instId: string): Promise<VestibularCurso[]> {
  return fetchAll<VestibularCurso>('vertice_eorbit_vestibular_cursos', { instituicao_id: instId }, 'curso', '*,curso_nome:curso');
}

// ---------------------------------------------------------------- Biblioteca
export async function getBibliotecaResumo(instId: string): Promise<BibliotecaResumo | null> {
  const rows = await fetchAll<BibliotecaResumo>('vertice_eorbit_biblioteca_resumo', { instituicao_id: instId });
  return rows[0] ?? null;
}

export async function getBibliotecaCDD(instId: string): Promise<BibliotecaCDD[]> {
  return fetchAll<BibliotecaCDD>('vertice_eorbit_biblioteca_cdd', { instituicao_id: instId }, 'quantidade');
}

export async function getBibliotecaDecada(instId: string): Promise<BibliotecaDecada[]> {
  return fetchAll<BibliotecaDecada>('vertice_eorbit_biblioteca_decada', { instituicao_id: instId }, 'decada');
}
