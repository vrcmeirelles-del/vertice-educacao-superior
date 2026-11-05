/**
 * Tipos para dados espelhados do e-ORBIT (portal acadêmico da UNITOP).
 *
 * Todas as tabelas usam o prefixo vertice_eorbit_ no Supabase.
 * RLS por instituicao_id.
 */

// ---------- Semestres ----------
export interface Semestre {
  id: number;
  codigo: string;        // "2024/01"
  descricao: string;
  instituicao_id: string;
}

// ---------- Cursos e-ORBIT ----------
export interface CursoEorbit {
  id: number;
  codigo: number;
  nome: string;
  grau: string | null;
  modalidade: string | null;
  situacao: string | null;
  instituicao_id: string;
}

export interface CursoNormalizado {
  id: number;
  nome_eorbit: string;
  nome_normalizado: string;
  codigo_eorbit: number | null;
  instituicao_id: string;
}

// ---------- Quantitativo ----------
export interface Quantitativo {
  id: number;
  semestre_id: number;
  curso_id: number;
  grade_id: number | null;
  total_vinculos: number;
  total_matriculados: number;
  pre_matriculado: number;
  transferido: number;
  trancado: number;
  abandono: number;
  concluido: number;
  graduado: number;
  cancelado: number;
  troca_de_curso: number;
  falecido: number;
  data_extracao: string | null;
  fonte: string | null;
  instituicao_id: string;
}

// ---------- ENADE ----------
export interface Enade {
  id: number;
  semestre: string;
  curso_id: number;
  curso_nome: string;
  habilitados: number;
  instituicao_id: string;
}

// ---------- Compliance Plano ----------
export interface CompliancePlano {
  id: number;
  semestre_id: number;
  curso_id: number;
  total_disciplinas: number;
  enviados: number;
  nao_enviados: number;
  percentual_envio: number;
  instituicao_id: string;
}

export interface CompliancePlanoDetalhe {
  id: number;
  semestre_id: number;
  curso_id: number;
  professor_id: number;
  professor_nome: string;
  disciplina_codigo: number;
  disciplina_nome: string;
  status_plano: string;      // 'enviado' | 'não enviado'
  instituicao_id: string;
}

// ---------- Compliance Notas ----------
export interface ComplianceNotas {
  id: number;
  semestre_id: number;
  curso_id: number;
  total_disciplinas: number;
  postadas: number;
  nao_postadas: number;
  percentual_postagem: number;
  instituicao_id: string;
}

export interface ComplianceNotasDetalhe {
  id: number;
  semestre_id: number;
  curso_id: number;
  professor_id: number;
  professor_nome: string;
  disciplina_codigo: number;
  disciplina_nome: string;
  status_notas: string;      // 'postadas' | 'não postadas'
  instituicao_id: string;
}

// ---------- Diário de Classe ----------
export interface DiarioClasse {
  id: number;
  semestre_id: number;
  curso_id: number;
  professor_id: number;
  professor_nome: string;
  disciplina_codigo: number;
  disciplina_nome: string;
  periodo_turma: string;
  status_plano: string;      // 'p' = postado, 'f' = falta
  status_notas: string;
  status_conteudo: string;   // 'a' = ausente
  status_cadastro: string;   // 'm' = ok
  instituicao_id: string;
}

// ---------- Frequência de Conteúdo ----------
export interface FrequenciaConteudo {
  id: number;
  semestre: string;
  curso_nome: string;
  professor_nome: string;
  disciplina_codigo: string;
  disciplina_nome: string;
  periodo_turma: string;
  instituicao_id: string;
}

// ---------- Professores ----------
export interface Professor {
  id: number;
  codigo: number;
  nome: string;
  email: string | null;
  titulacao: string | null;
  regime: string | null;
  instituicao_id: string;
}

// ---------- Vestibular ----------
export interface VestibularEdital {
  id: number;
  codigo: string;
  descricao: string;
  data_inicio: string | null;
  data_fim: string | null;
  situacao: string | null;
  instituicao_id: string;
}

export interface VestibularCurso {
  id: number;
  edital_id: number;
  curso_nome: string;
  turno: string | null;
  vagas: number;
  inscritos: number | null;
  aprovados: number | null;
  matriculados: number | null;
  instituicao_id: string;
}

// ---------- Biblioteca ----------
export interface BibliotecaResumo {
  id: number;
  total_titulos: number;
  total_exemplares: number;
  data_extracao: string | null;
  instituicao_id: string;
}

export interface BibliotecaCDD {
  id: number;
  codigo_cdd: string;
  descricao: string;
  quantidade: number;
  instituicao_id: string;
}

export interface BibliotecaDecada {
  id: number;
  decada: string;
  quantidade: number;
  instituicao_id: string;
}

// ---------- Filtro geral ----------
export interface FiltroEorbit {
  instituicaoId: string;
  semestreId?: number;
  cursoId?: number;
}

// ---------- Resumos agregados ----------
export interface ResumoQuantitativo {
  semestre: string;
  semestreId: number;
  totalMatriculados: number;
  totalVinculos: number;
  preMatriculado: number;
  trancado: number;
  abandono: number;
  concluido: number;
  transferido: number;
  cancelado: number;
}

export interface ResumoCompliance {
  tipo: 'plano' | 'notas';
  semestre: string;
  semestreId: number;
  totalDisciplinas: number;
  conformes: number;           // enviados (plano) ou postadas (notas)
  naoConformes: number;
  percentual: number;
}

export interface ResumoDiario {
  semestreId: number;
  semestre: string;
  totalRegistros: number;
  planoOk: number;
  notasOk: number;
  conteudoOk: number;
  cadastroOk: number;
}
