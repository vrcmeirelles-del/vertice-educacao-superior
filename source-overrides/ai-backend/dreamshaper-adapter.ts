/**
 * Adaptador DreamShaper — Import CSV/XLSX para o módulo de extensão
 *
 * Conforme plano Impacto:
 * - Prévia antes de importação
 * - Validação de campos obrigatórios
 * - Idempotência (não duplica registros)
 * - Histórico de importações
 * - Reconciliação com dados existentes
 *
 * [Não verificado] O DreamShaper não confirmou disponibilidade de API, LTI ou SSO.
 * Este adaptador opera sobre exports CSV/XLSX da plataforma, não integração direta.
 * Capacidades contratuais não confirmadas estão documentadas, não presumidas.
 */

// ============================================================
// Tipos
// ============================================================

export interface DreamShaperStudent {
  externalId: string;                    // ID do DreamShaper
  registrationNumber: string;            // matrícula
  courseName: string;                    // nome do curso
  projectTitle: string;                  // nome do projeto/desafio
  hoursCompleted: number;                // horas registradas
  completionDate: string | null;         // data de conclusão
  status: 'concluido' | 'em_andamento' | 'nao_iniciado' | 'desistente';
  competencies: string[];                // competências desenvolvidas
}

export interface ImportPreview {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: ImportValidationError[];
  duplicateRows: number;                 // já existem no sistema
  newRows: number;                       // serão criados
  updatedRows: number;                   // serão atualizados
  students: DreamShaperStudent[];        // prévia dos primeiros 20
  warnings: string[];
}

export interface ImportValidationError {
  row: number;
  field: string;
  value: string;
  reason: string;
}

export interface ImportResult {
  importId: string;
  timestamp: string;
  fileName: string;
  totalProcessed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ImportValidationError[];
}

// ============================================================
// Mapeamento de colunas
// ============================================================

/** Colunas esperadas no CSV/XLSX do DreamShaper.
 * Nomes flexíveis — aceita variações comuns. */
const COLUMN_MAP: Record<string, string[]> = {
  externalId:          ['id', 'external_id', 'id_aluno', 'student_id'],
  registrationNumber:  ['matricula', 'registration', 'ra', 'registro'],
  courseName:          ['curso', 'course', 'programa'],
  projectTitle:        ['projeto', 'project', 'desafio', 'challenge'],
  hoursCompleted:      ['horas', 'hours', 'carga_horaria', 'ch'],
  completionDate:      ['data_conclusao', 'completion_date', 'concluido_em'],
  status:              ['status', 'situacao', 'estado'],
  competencies:        ['competencias', 'competencies', 'habilidades', 'skills'],
};

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // remove acentos
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function mapColumns(headers: string[]): Map<string, number> {
  const normalized = headers.map(normalizeHeader);
  const mapping = new Map<string, number>();

  for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
    const idx = normalized.findIndex(h => aliases.includes(h));
    if (idx >= 0) mapping.set(field, idx);
  }

  return mapping;
}

// ============================================================
// Preview (sem efeito colateral)
// ============================================================

export function previewImport(
  rows: string[][],                      // primeira linha = headers
  existingRegistrations: Set<string>,    // matrículas já no sistema
): ImportPreview {
  if (rows.length < 2) {
    return {
      fileName: '', totalRows: 0, validRows: 0, invalidRows: [],
      duplicateRows: 0, newRows: 0, updatedRows: 0, students: [], warnings: ['Arquivo vazio ou sem dados.'],
    };
  }

  const headers = rows[0];
  const columnMap = mapColumns(headers);
  const warnings: string[] = [];

  // Verificar campos obrigatórios
  const required = ['registrationNumber', 'projectTitle', 'hoursCompleted'];
  for (const field of required) {
    if (!columnMap.has(field)) {
      warnings.push(`Coluna obrigatória "${field}" não encontrada. Aliases aceitos: ${COLUMN_MAP[field].join(', ')}`);
    }
  }

  const students: DreamShaperStudent[] = [];
  const invalidRows: ImportValidationError[] = [];
  let duplicateRows = 0;
  let newRows = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const student = parseRow(row, columnMap, i);

    if (student.errors.length > 0) {
      invalidRows.push(...student.errors);
      continue;
    }

    if (existingRegistrations.has(student.data!.registrationNumber)) {
      duplicateRows++;
    } else {
      newRows++;
    }

    if (students.length < 20) {
      students.push(student.data!);
    }
  }

  return {
    fileName: '',
    totalRows: rows.length - 1,
    validRows: rows.length - 1 - invalidRows.length,
    invalidRows,
    duplicateRows,
    newRows,
    updatedRows: duplicateRows,
    students,
    warnings,
  };
}

function parseRow(
  row: string[],
  columnMap: Map<string, number>,
  rowNumber: number,
): { data: DreamShaperStudent | null; errors: ImportValidationError[] } {
  const errors: ImportValidationError[] = [];
  const get = (field: string): string => {
    const idx = columnMap.get(field);
    return idx !== undefined && idx < row.length ? row[idx].trim() : '';
  };

  const registrationNumber = get('registrationNumber');
  if (!registrationNumber) {
    errors.push({ row: rowNumber, field: 'registrationNumber', value: '', reason: 'Matrícula obrigatória.' });
  }

  const projectTitle = get('projectTitle');
  if (!projectTitle) {
    errors.push({ row: rowNumber, field: 'projectTitle', value: '', reason: 'Projeto obrigatório.' });
  }

  const hoursRaw = get('hoursCompleted');
  const hours = parseFloat(hoursRaw);
  if (isNaN(hours) || hours < 0) {
    errors.push({ row: rowNumber, field: 'hoursCompleted', value: hoursRaw, reason: 'Horas deve ser número >= 0.' });
  }

  const statusRaw = get('status').toLowerCase();
  const statusMap: Record<string, DreamShaperStudent['status']> = {
    concluido: 'concluido', completed: 'concluido', finalizado: 'concluido',
    em_andamento: 'em_andamento', in_progress: 'em_andamento', cursando: 'em_andamento',
    nao_iniciado: 'nao_iniciado', not_started: 'nao_iniciado',
    desistente: 'desistente', dropped: 'desistente', evadido: 'desistente',
  };
  const status = statusMap[normalizeHeader(statusRaw)] || 'em_andamento';

  const competenciesRaw = get('competencies');
  const competencies = competenciesRaw
    ? competenciesRaw.split(/[;|,]/).map(c => c.trim()).filter(Boolean)
    : [];

  if (errors.length > 0) return { data: null, errors };

  return {
    data: {
      externalId: get('externalId') || `ds-${rowNumber}`,
      registrationNumber,
      courseName: get('courseName'),
      projectTitle,
      hoursCompleted: Math.round(hours),
      completionDate: get('completionDate') || null,
      status,
      competencies,
    },
    errors: [],
  };
}

// ============================================================
// Documentação de capacidades não confirmadas
// ============================================================

/**
 * CAPACIDADES DREAMSHAPER — STATUS DE INTEGRAÇÃO
 *
 * [Não verificado] As seguintes capacidades dependem de contrato:
 * - API REST: link de portal encontrado, mas sem documentação pública
 * - LTI 1.3: não confirmado
 * - SSO/SAML: não confirmado
 * - Webhooks: não confirmado
 *
 * Este adaptador opera exclusivamente sobre:
 * - Export CSV/XLSX manual da plataforma DreamShaper
 * - Upload pelo coordenador no módulo de extensão
 *
 * Para integração direta, será necessário:
 * 1. Confirmação contratual das capacidades
 * 2. Credenciais de API (se disponível)
 * 3. Mapeamento de campos específico da instância
 */
