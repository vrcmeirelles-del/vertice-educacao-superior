/**
 * Painel Executivo de BI — Consultas agregadas
 *
 * Cada função busca dados já filtrados por instituição e semestre,
 * agregando no banco via Supabase (RLS ativo).
 * Fuso: America/Sao_Paulo (registrado aqui como referência).
 */

import { supabase } from '@/lib/supabase';
import type { Row } from '@/lib/area';
import type {
  FiltroBI, KpiResumo, EtapaFunil, FatiaCategoria,
  SerieTemporal, PontoSerie, Alerta, CursoRisco,
  CelulaHeatmap, SaudeIndicador,
} from './types';
import { fmtInt, fmtPct, fmtBRL } from './format';

// ---------------------------------------------------------------- helpers
async function fetchAll<T>(table: string, filters: Record<string, unknown>, order = 'id'): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select('*').order(order, { ascending: true });
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

function variacao(atual: number, anterior: number | null): number | null {
  if (anterior === null || anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

function atingimento(valor: number | null, meta: number | null): number | null {
  if (valor === null || meta === null || meta === 0) return null;
  return (valor / meta) * 100;
}

// ---------------------------------------------------------------- cursos
type Course = Row & { institution_id: string; name: string; vacancies?: number; degree?: string; status?: string };

async function getCourses(filtro: FiltroBI): Promise<Course[]> {
  const all = await fetchAll<Course>('vertice_courses', { institution_id: filtro.instituicaoId }, 'name');
  return all.filter(c => {
    if (filtro.cursoId && c.id !== filtro.cursoId) return false;
    if (filtro.grau && c.degree !== filtro.grau) return false;
    if (c.status === 'extinto') return false;
    return true;
  });
}

// ---------------------------------------------------------------- matrículas
type Enrollment = Row & {
  course_id: string; semester: string; student_status: string;
  class_label: string; enrolled: number; capacity: number;
  reported_total: number | null;
};

async function getEnrollments(filtro: FiltroBI): Promise<Enrollment[]> {
  const all = await fetchAll<Enrollment>(
    'vertice_enrollment_snapshots',
    { institution_id: filtro.instituicaoId },
    'semester'
  );
  const courses = await getCourses(filtro);
  const ids = new Set(courses.map(c => c.id));
  return all.filter(e => ids.has(e.course_id) && e.student_status === 'MATRICULADO');
}

function enrolledBySemester(enrollments: Enrollment[]): Map<string, number> {
  const bySem = new Map<string, Map<string, Enrollment[]>>();
  for (const e of enrollments) {
    if (!bySem.has(e.semester)) bySem.set(e.semester, new Map());
    const byCourse = bySem.get(e.semester)!;
    if (!byCourse.has(e.course_id)) byCourse.set(e.course_id, []);
    byCourse.get(e.course_id)!.push(e);
  }
  const result = new Map<string, number>();
  for (const [sem, byCourse] of bySem) {
    let total = 0;
    for (const rows of byCourse.values()) {
      const classes = rows.filter(r => r.class_label !== '__TOTAL_CURSO__');
      const reported = rows.find(r => r.reported_total !== null)?.reported_total ?? null;
      const sum = classes.reduce((s, r) => s + r.enrolled, 0);
      const totalRow = rows.find(r => r.class_label === '__TOTAL_CURSO__');
      total += reported ?? (classes.length ? sum : totalRow?.enrolled ?? 0);
    }
    result.set(sem, total);
  }
  return result;
}

// ---------------------------------------------------------------- semestres disponíveis
export async function getSemestres(instituicaoId: string): Promise<string[]> {
  const all = await fetchAll<Enrollment>(
    'vertice_enrollment_snapshots',
    { institution_id: instituicaoId },
    'semester'
  );
  const semesters = [...new Set(all.filter(e => e.student_status === 'MATRICULADO').map(e => e.semester))];
  return semesters.sort().reverse();
}
// ---------------------------------------------------------------- KPIs
export async function getKPIs(filtro: FiltroBI): Promise<KpiResumo[]> {
  const enrollments = await getEnrollments(filtro);
  const courses = await getCourses(filtro);
  const semesters = [...new Set(enrollments.map(e => e.semester))].sort();
  const currentSem = filtro.semestre ?? semesters.at(-1) ?? '';
  const prevSem = semesters[semesters.indexOf(currentSem) - 1] ?? null;

  const bySem = enrolledBySemester(enrollments);
  const matriculados = bySem.get(currentSem) ?? 0;
  const matriculadosPrev = prevSem ? (bySem.get(prevSem) ?? null) : null;

  // Vagas ofertadas (soma de vacancies dos cursos ativos)
  const vagasOfertadas = courses.reduce((s, c) => s + (Number(c.vacancies) || 0), 0);
  const ocupacao = vagasOfertadas > 0 ? (matriculados / vagasOfertadas) * 100 : null;

  // Evasão aproximada: (anterior - atual) / anterior
  const evasao = matriculadosPrev !== null && matriculadosPrev > 0
    ? ((matriculadosPrev - matriculados) / matriculadosPrev) * 100
    : null;
  const retencao = evasao !== null ? 100 - evasao : null;

  // Captação (leads e matrículas)
  const captacaoSnaps = await fetchAll<Row>('vertice_captacao_snapshots', { institution_id: filtro.instituicaoId }, 'mes');
  const totalLeads = captacaoSnaps.reduce((s, r) => s + Number(r.total_leads ?? 0), 0);
  const totalMatCaptacao = captacaoSnaps.reduce((s, r) => s + Number(r.total_matriculas ?? 0), 0);
  const totalInvest = captacaoSnaps.reduce((s, r) => s + Number(r.investimento_total ?? 0), 0);
  const cac = totalMatCaptacao > 0 ? totalInvest / totalMatCaptacao : null;
  const conversao = totalLeads > 0 ? (totalMatCaptacao / totalLeads) * 100 : null;

  // Metas
  const goals = await fetchAll<Row>('vertice_goals', { institution_id: filtro.instituicaoId });
  const metasAtivas = goals.filter(g => g.status === 'ativa').length;
  const metasConcluidas = goals.filter(g => g.status === 'concluida').length;
  const metaTotal = metasAtivas + metasConcluidas;
  const atingimentoMetas = metaTotal > 0 ? (metasConcluidas / metaTotal) * 100 : null;

  // Tendências (série de matriculados por semestre)
  const tendenciaMatriculas = semesters.map(s => bySem.get(s) ?? 0);
  const tendenciaCaptacao = captacaoSnaps.map(r => Number(r.total_matriculas ?? 0));
  const tendenciaLeads = captacaoSnaps.map(r => Number(r.total_leads ?? 0));

  const kpis: KpiResumo[] = [
    {
      chave: 'matriculados',
      rotulo: 'Alunos Matriculados',
      valor: matriculados,
      unidade: 'qtd',
      variacaoPct: variacao(matriculados, matriculadosPrev),
      meta: null,
      atingimentoMeta: null,
      tendencia: tendenciaMatriculas,
      direcaoDesejada: 'cima',
      definicao: 'Soma de matrículas ativas no semestre, por curso, conforme snapshots do sistema.',
    },
    {
      chave: 'ocupacao',
      rotulo: 'Ocupação de Vagas',
      valor: ocupacao,
      unidade: 'pct',
      variacaoPct: null,
      meta: null,
      atingimentoMeta: null,
      tendencia: [],
      direcaoDesejada: 'cima',
      definicao: 'Matriculados ÷ vagas ofertadas (campo vacancies dos cursos ativos).',
    },
    {
      chave: 'evasao',
      rotulo: 'Evasão Estimada',
      valor: evasao !== null ? Math.max(0, evasao) : null,
      unidade: 'pct',
      variacaoPct: null,
      meta: null,
      atingimentoMeta: null,
      tendencia: [],
      direcaoDesejada: 'baixo',
      definicao: 'Aproximação: (matriculados semestre anterior − matriculados atual) ÷ matriculados anterior. Critério: snapshot de matrícula ativa.',
    },
    {
      chave: 'retencao',
      rotulo: 'Retenção',
      valor: retencao !== null ? Math.min(100, retencao) : null,
      unidade: 'pct',
      variacaoPct: null,
      meta: null,
      atingimentoMeta: null,
      tendencia: [],
      direcaoDesejada: 'cima',
      definicao: '1 − evasão. Percentual de alunos que permaneceram.',
    },
    {
      chave: 'conversao',
      rotulo: 'Conversão de Captação',
      valor: conversao,
      unidade: 'pct',
      variacaoPct: null,
      meta: null,
      atingimentoMeta: null,
      tendencia: tendenciaCaptacao,
      direcaoDesejada: 'cima',
      definicao: 'Matrículas atribuídas ÷ total de leads no período (dados de captação).',
    },
    {
      chave: 'cac',
      rotulo: 'CAC',
      valor: cac,
      unidade: 'brl',
      variacaoPct: null,
      meta: null,
      atingimentoMeta: null,
      tendencia: [],
      direcaoDesejada: 'baixo',
      definicao: 'Custo de aquisição por aluno: investimento total em captação ÷ matrículas atribuídas.',
    },
    {
      chave: 'metas',
      rotulo: 'Metas Concluídas',
      valor: atingimentoMetas,
      unidade: 'pct',
      variacaoPct: null,
      meta: null,
      atingimentoMeta: null,
      tendencia: [],
      direcaoDesejada: 'cima',
      definicao: 'Metas com status "concluída" ÷ total de metas ativas e concluídas.',
    },
  ];

  return kpis;
}

// ---------------------------------------------------------------- série temporal (matrículas por semestre)
export async function getSerieTemporal(filtro: FiltroBI): Promise<SerieTemporal> {
  const enrollments = await getEnrollments(filtro);
  const bySem = enrolledBySemester(enrollments);
  const pontos: PontoSerie[] = [...bySem.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sem, val]) => ({ data: sem, valor: val }));

  return { chave: 'matriculas_semestre', rotulo: 'Matrículas por Semestre', pontos };
}

// ---------------------------------------------------------------- funil de captação
export async function getFunil(filtro: FiltroBI): Promise<EtapaFunil[]> {
  type Lead = Row & { etapa_funil: string };
  const leads = await fetchAll<Lead>('vertice_captacao_leads', { institution_id: filtro.instituicaoId });
  const etapasOrdem = ['lead', 'contato', 'visita', 'inscricao', 'matricula'];
  const rotulos: Record<string, string> = {
    lead: 'Lead', contato: 'Contato', visita: 'Visita',
    inscricao: 'Inscrição', matricula: 'Matrícula',
  };
  const contagem = new Map<string, number>();
  for (const l of leads) {
    const key = l.etapa_funil;
    contagem.set(key, (contagem.get(key) ?? 0) + 1);
  }
  // Só incluir etapas que realmente existem nos dados
  const etapas = etapasOrdem.filter(e => (contagem.get(e) ?? 0) > 0);
  return etapas.map((e, i) => {
    const volume = contagem.get(e) ?? 0;
    const anterior = i > 0 ? (contagem.get(etapas[i - 1]) ?? 0) : null;
    return {
      etapa: rotulos[e] ?? e,
      volume,
      conversaoPct: anterior !== null && anterior > 0 ? (volume / anterior) * 100 : null,
    };
  });
}

// ---------------------------------------------------------------- composição por curso
export async function getComposicaoPorCurso(filtro: FiltroBI): Promise<FatiaCategoria[]> {
  const enrollments = await getEnrollments(filtro);
  const courses = await getCourses(filtro);
  const currentSem = filtro.semestre ?? [...new Set(enrollments.map(e => e.semester))].sort().at(-1) ?? '';
  const semEnrollments = enrollments.filter(e => e.semester === currentSem);

  const byCourse = new Map<string, number>();
  for (const e of semEnrollments) {
    if (e.class_label === '__TOTAL_CURSO__') continue;
    byCourse.set(e.course_id, (byCourse.get(e.course_id) ?? 0) + e.enrolled);
  }

  const total = [...byCourse.values()].reduce((s, v) => s + v, 0);
  const result: FatiaCategoria[] = [...byCourse.entries()]
    .map(([courseId, valor]) => ({
      chave: courseId,
      rotulo: courses.find(c => c.id === courseId)?.name ?? courseId,
      valor,
      participacaoPct: total > 0 ? (valor / total) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor);

  return result;
}

// ---------------------------------------------------------------- cursos em risco (ocupação < 60%)
export async function getCursosRisco(filtro: FiltroBI): Promise<CursoRisco[]> {
  const courses = await getCourses(filtro);
  const enrollments = await getEnrollments(filtro);
  const semesters = [...new Set(enrollments.map(e => e.semester))].sort();
  const currentSem = filtro.semestre ?? semesters.at(-1) ?? '';
  const prevSem = semesters[semesters.indexOf(currentSem) - 1] ?? null;

  const bySem = enrolledBySemester(enrollments);
  const result: CursoRisco[] = [];

  for (const c of courses) {
    const vacancies = Number(c.vacancies) || 0;
    if (vacancies <= 0) continue;

    const currentEnrollments = enrollments
      .filter(e => e.course_id === c.id && e.semester === currentSem && e.class_label !== '__TOTAL_CURSO__')
      .reduce((s, e) => s + e.enrolled, 0);

    const ocupacao = (currentEnrollments / vacancies) * 100;

    // Tendência vs semestre anterior
    const prevEnrollments = prevSem
      ? enrollments
          .filter(e => e.course_id === c.id && e.semester === prevSem && e.class_label !== '__TOTAL_CURSO__')
          .reduce((s, e) => s + e.enrolled, 0)
      : null;

    const tendencia = prevEnrollments === null ? 'estavel' as const
      : currentEnrollments > prevEnrollments ? 'subindo' as const
      : currentEnrollments < prevEnrollments ? 'caindo' as const
      : 'estavel' as const;

    const sinal = ocupacao < 40 ? 'critico' as const
      : ocupacao < 60 ? 'atencao' as const
      : 'ok' as const;

    if (sinal !== 'ok') {
      result.push({
        id: c.id,
        nome: c.name,
        grau: c.degree ?? '',
        ocupacaoPct: Math.round(ocupacao * 10) / 10,
        tendencia,
        sinal,
      });
    }
  }

  return result.sort((a, b) => (a.ocupacaoPct ?? 0) - (b.ocupacaoPct ?? 0));
}

// ---------------------------------------------------------------- alertas
export async function getAlertas(filtro: FiltroBI): Promise<Alerta[]> {
  const alertas: Alerta[] = [];

  // Cursos com ocupação crítica
  const risco = await getCursosRisco(filtro);
  for (const c of risco.filter(r => r.sinal === 'critico').slice(0, 3)) {
    alertas.push({
      severidade: 'critico',
      descricao: `${c.nome}: ocupação de ${fmtPct(c.ocupacaoPct ?? 0)}`,
      href: `/master#${new URLSearchParams({ instituicao: filtro.instituicaoId, curso: c.id })}`,
    });
  }
  for (const c of risco.filter(r => r.sinal === 'atencao').slice(0, 2)) {
    alertas.push({
      severidade: 'atencao',
      descricao: `${c.nome}: ocupação de ${fmtPct(c.ocupacaoPct ?? 0)}`,
      href: `/master#${new URLSearchParams({ instituicao: filtro.instituicaoId, curso: c.id })}`,
    });
  }

  // Metas vencidas
  const goals = await fetchAll<Row>('vertice_goals', { institution_id: filtro.instituicaoId });
  const today = new Date().toISOString().slice(0, 10);
  const vencidas = goals.filter(g =>
    g.status === 'ativa' && g.due_date && String(g.due_date) < today
  );
  if (vencidas.length > 0) {
    alertas.push({
      severidade: 'critico',
      descricao: `${vencidas.length} meta${vencidas.length > 1 ? 's' : ''} com prazo vencido`,
      href: `/master#${new URLSearchParams({ instituicao: filtro.instituicaoId, aba: 'metas' })}`,
    });
  }

  // Ações atrasadas
  const actions = await fetchAll<Row>('vertice_actions', { institution_id: filtro.instituicaoId });
  const atrasadas = actions.filter(a =>
    a.status !== 'concluida' && a.status !== 'cancelada' && a.due_date && String(a.due_date) < today
  );
  if (atrasadas.length > 0) {
    alertas.push({
      severidade: 'atencao',
      descricao: `${atrasadas.length} ação${atrasadas.length > 1 ? 'ões' : ''} em atraso`,
      href: `/master#${new URLSearchParams({ instituicao: filtro.instituicaoId, aba: 'plano' })}`,
    });
  }

  // Achados abertos de diagnóstico
  const diagnosis = await fetchAll<Row>('vertice_diagnosis_items', { institution_id: filtro.instituicaoId });
  const abertos = diagnosis.filter(d => d.status !== 'resolvido');
  const altaPrioridade = abertos.filter(d => d.priority === 'alta');
  if (altaPrioridade.length > 0) {
    alertas.push({
      severidade: 'atencao',
      descricao: `${altaPrioridade.length} achado${altaPrioridade.length > 1 ? 's' : ''} de alta prioridade em aberto`,
      href: `/master#${new URLSearchParams({ instituicao: filtro.instituicaoId, aba: 'diagnostico' })}`,
    });
  }

  return alertas.sort((a, b) =>
    (a.severidade === 'critico' ? 0 : a.severidade === 'atencao' ? 1 : 2) -
    (b.severidade === 'critico' ? 0 : b.severidade === 'atencao' ? 1 : 2)
  );
}

// ---------------------------------------------------------------- saúde do período
export async function getSaudePeriodo(filtro: FiltroBI): Promise<SaudeIndicador[]> {
  const kpis = await getKPIs(filtro);
  const indicadores: SaudeIndicador[] = [];

  const find = (chave: string) => kpis.find(k => k.chave === chave);

  const mat = find('matriculados');
  if (mat?.valor !== null && mat?.valor !== undefined) {
    const sinal = mat.variacaoPct !== null
      ? (mat.variacaoPct >= 0 ? 'ok' : mat.variacaoPct > -5 ? 'atencao' : 'critico')
      : 'ok';
    indicadores.push({ rotulo: 'Matrículas', sinal: sinal as any, valor: fmtInt(mat.valor) });
  }

  const evasao = find('evasao');
  if (evasao?.valor !== null && evasao?.valor !== undefined) {
    const sinal = evasao.valor < 5 ? 'ok' : evasao.valor < 10 ? 'atencao' : 'critico';
    indicadores.push({ rotulo: 'Evasão', sinal: sinal as any, valor: fmtPct(evasao.valor) });
  }

  const conv = find('conversao');
  if (conv?.valor !== null && conv?.valor !== undefined) {
    const sinal = conv.valor >= 15 ? 'ok' : conv.valor >= 8 ? 'atencao' : 'critico';
    indicadores.push({ rotulo: 'Conversão', sinal: sinal as any, valor: fmtPct(conv.valor) });
  }

  const ocup = find('ocupacao');
  if (ocup?.valor !== null && ocup?.valor !== undefined) {
    const sinal = ocup.valor >= 70 ? 'ok' : ocup.valor >= 50 ? 'atencao' : 'critico';
    indicadores.push({ rotulo: 'Ocupação', sinal: sinal as any, valor: fmtPct(ocup.valor) });
  }

  const metas = find('metas');
  if (metas?.valor !== null && metas?.valor !== undefined) {
    const sinal = metas.valor >= 60 ? 'ok' : metas.valor >= 30 ? 'atencao' : 'critico';
    indicadores.push({ rotulo: 'Metas', sinal: sinal as any, valor: fmtPct(metas.valor) });
  }

  return indicadores;
}

// ---------------------------------------------------------------- heatmap (matrículas por curso × semestre)
export async function getHeatmap(filtro: FiltroBI): Promise<CelulaHeatmap[]> {
  const enrollments = await getEnrollments(filtro);
  const courses = await getCourses(filtro);
  const cells: CelulaHeatmap[] = [];

  const grouped = new Map<string, Map<string, number>>();
  for (const e of enrollments) {
    if (e.class_label === '__TOTAL_CURSO__') continue;
    if (!grouped.has(e.course_id)) grouped.set(e.course_id, new Map());
    const sem = grouped.get(e.course_id)!;
    sem.set(e.semester, (sem.get(e.semester) ?? 0) + e.enrolled);
  }

  for (const [courseId, sems] of grouped) {
    const name = courses.find(c => c.id === courseId)?.name ?? courseId;
    for (const [sem, valor] of sems) {
      cells.push({ linha: name, coluna: sem, valor });
    }
  }

  return cells;
}

// ---------------------------------------------------------------- exportação CSV
export async function exportCSV(filtro: FiltroBI): Promise<string> {
  const kpis = await getKPIs(filtro);
  const linhas = ['Indicador;Valor;Unidade;Variação %;Definição'];
  for (const k of kpis) {
    const val = k.valor !== null
      ? k.unidade === 'brl' ? fmtBRL(k.valor) : k.unidade === 'pct' ? fmtPct(k.valor) : fmtInt(k.valor)
      : '—';
    const vari = k.variacaoPct !== null ? fmtPct(k.variacaoPct) : 'sem base';
    linhas.push(`"${k.rotulo}";"${val}";"${k.unidade}";"${vari}";"${k.definicao}"`);
  }
  return linhas.join('\n');
}
