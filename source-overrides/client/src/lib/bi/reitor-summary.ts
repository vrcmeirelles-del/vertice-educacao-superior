import type { ResumoCompliance } from '../eorbit/types';

// A source ID (sem_42) is not a calendar period. Do not infer chronology from it.
function semesterKey(value: string): number | null {
  const match = /^(\d{4})\/0?([12])$/.exec(value);
  return match ? Number(match[1]) * 2 + Number(match[2]) : null;
}
export function latestSemesterSummary<T extends { semestre: string }>(rows: readonly T[]): T | null {
  let latest: T | null = null;
  let key = -Infinity;
  for (const row of rows) {
    const candidate = semesterKey(row.semestre);
    if (candidate !== null && candidate > key) { latest = row; key = candidate; }
  }
  return latest;
}
export type ReitorCompliance = { semestre: string; plano: number | null; notas: number | null };
export function reitorCompliance(rows: readonly ResumoCompliance[]): ReitorCompliance | null {
  const latest = latestSemesterSummary(rows);
  if (!latest) return null;
  const sameSemester = rows.filter(row => semesterKey(row.semestre) === semesterKey(latest.semestre));
  const percentage = (tipo: ResumoCompliance['tipo']) => {
    const row = sameSemester.find(item => item.tipo === tipo);
    return row && row.totalDisciplinas > 0 && Number.isFinite(row.percentual) ? row.percentual : null;
  };
  return { semestre: latest.semestre, plano: percentage('plano'), notas: percentage('notas') };
}
export function sourceDate(value: string | null): string {
  if (!value) return 'Não informada';
  // Dates without a time are calendar dates, not midnight UTC instants.
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00' : value);
  return Number.isNaN(date.getTime()) ? 'Não informada' : date.toLocaleDateString('pt-BR');
}
