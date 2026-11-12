import { describe, it, expect } from 'vitest';
import { previewImport } from '../ai-backend/dreamshaper-adapter';

describe('DreamShaper adapter — previewImport', () => {
  it('returns empty warning for files with no data rows', () => {
    const result = previewImport([['matricula', 'horas']], new Set());
    expect(result.totalRows).toBe(0);
    expect(result.warnings).toContain('Arquivo vazio ou sem dados.');
  });

  it('returns empty warning for completely empty input', () => {
    const result = previewImport([], new Set());
    expect(result.totalRows).toBe(0);
  });

  it('maps PT column names correctly', () => {
    const rows = [
      ['matricula', 'projeto', 'horas', 'status'],
      ['2024001', 'Projeto A', '60', 'concluido'],
      ['2024002', 'Projeto B', '40', 'em_andamento'],
    ];
    const result = previewImport(rows, new Set());
    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(2);
    expect(result.newRows).toBe(2);
    expect(result.duplicateRows).toBe(0);
    expect(result.students.length).toBe(2);
    expect(result.students[0].registrationNumber).toBe('2024001');
    expect(result.students[0].hoursCompleted).toBe(60);
    expect(result.warnings.length).toBe(0);
  });

  it('maps EN column names correctly', () => {
    const rows = [
      ['registration', 'project', 'hours', 'status'],
      ['EN001', 'Challenge X', '30', 'concluido'],
    ];
    const result = previewImport(rows, new Set());
    expect(result.validRows).toBe(1);
    expect(result.students[0].registrationNumber).toBe('EN001');
  });

  it('detects duplicate registrations', () => {
    const rows = [
      ['matricula', 'projeto', 'horas'],
      ['2024001', 'Projeto A', '60'],
      ['2024002', 'Projeto B', '40'],
    ];
    const existing = new Set(['2024001']);
    const result = previewImport(rows, existing);
    expect(result.duplicateRows).toBe(1);
    expect(result.newRows).toBe(1);
  });

  it('reports missing required columns', () => {
    const rows = [
      ['nome', 'email'],
      ['João', 'joao@test.com'],
    ];
    const result = previewImport(rows, new Set());
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('registrationNumber'))).toBe(true);
  });

  it('limits preview to 20 students', () => {
    const headers = ['matricula', 'projeto', 'horas'];
    const dataRows = Array.from({ length: 30 }, (_, i) => [
      `MAT${String(i).padStart(3, '0')}`, 'Projeto X', '10',
    ]);
    const result = previewImport([headers, ...dataRows], new Set());
    expect(result.totalRows).toBe(30);
    expect(result.students.length).toBe(20);
  });

  it('handles accented and mixed-case headers', () => {
    const rows = [
      ['Matrícula', 'PROJETO', 'Carga_Horária'],
      ['2024099', 'Teste Acentos', '25'],
    ];
    const result = previewImport(rows, new Set());
    expect(result.validRows).toBe(1);
    expect(result.students[0].hoursCompleted).toBe(25);
  });
});
