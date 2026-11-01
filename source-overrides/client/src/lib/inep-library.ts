export type LibraryDocument = {
  id: string; institution_id: string; library_key: string; version: string;
  code: string | null; dimension: number; indicator: string; file_name: string;
  title: string; original_path: string; format: 'docx' | 'pdf' | 'xlsx';
  size_bytes: number; is_placeholder: boolean;
};
export const LIBRARY_DIMENSIONS = [
  ['0', 'D0-Apoio'], ['1', 'D1-Didatico'], ['2', 'D2-Docente'], ['3', 'D3-Infra'],
] as const;
export function normalizeLibraryText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}
export function filterLibrary(documents: LibraryDocument[], filters: {
  query: string; dimension: string; indicator: string; format: string; references: boolean;
}) {
  const terms = normalizeLibraryText(filters.query).trim().split(/\s+/).filter(Boolean);
  return documents.filter(d => (!filters.dimension || String(d.dimension) === filters.dimension)
    && (!filters.indicator || d.indicator === filters.indicator)
    && (!filters.format || d.format === filters.format)
    && (!filters.references || d.is_placeholder)
    && terms.every(term => normalizeLibraryText([d.code, d.file_name, d.title, d.indicator].join(' ')).includes(term)))
    .sort((a, b) => a.indicator.localeCompare(b.indicator, 'pt-BR', { numeric: true })
      || a.file_name.localeCompare(b.file_name, 'pt-BR'));
}
