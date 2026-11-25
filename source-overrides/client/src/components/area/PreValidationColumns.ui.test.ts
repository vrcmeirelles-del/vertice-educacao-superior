import { describe, expect, it } from 'vitest';
import { PREVALIDATION_QUEUE_COLUMNS } from './PreValidationQueue';
import { PREVALIDATION_PANEL_COLUMNS } from './PreValidationPanel';

// O texto extraído (vários MB por IES) nunca deve ir para o navegador nas telas de pré-validação.
describe('colunas lidas pelas telas de pré-validação', () => {
  for (const [nome, cols] of [['fila', PREVALIDATION_QUEUE_COLUMNS], ['painel', PREVALIDATION_PANEL_COLUMNS]] as const) {
    it(`${nome}: lista explícita, sem texto extraído`, () => {
      const lista = cols.split(',');
      expect(lista).not.toContain('*');
      expect(lista).not.toContain('extracted_text');
      expect(lista).not.toContain('extracted_pages');
      expect(new Set(lista).size).toBe(lista.length);
    });
  }
  it('fila mantém as colunas usadas para deduplicar a origem', () => {
    for (const c of ['id', 'source_table', 'repository_file_id', 'document_id', 'ai_status']) expect(PREVALIDATION_QUEUE_COLUMNS.split(',')).toContain(c);
  });
});
