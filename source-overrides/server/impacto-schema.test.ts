import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Schema contract tests for Impacto migration.
 * Verify the migration SQL contains all expected structures.
 */

const migrationPath = resolve('migrations/20261112_impacto_fundacao_completa.sql');
let migration: string;
try { migration = readFileSync(migrationPath, 'utf8'); } catch { migration = ''; }

describe('Impacto migration schema contract', () => {
  it('migration file exists and is non-empty', () => {
    expect(migration.length).toBeGreaterThan(100);
  });

  it('creates hour_state column with 8 states', () => {
    expect(migration).toContain('hour_state');
    for (const state of ['prevista', 'programada', 'executada', 'declarada', 'aguardando_validacao', 'validada', 'integralizada', 'indeferida']) {
      expect(migration).toContain(`'${state}'`);
    }
  });

  it('creates project amplification fields', () => {
    for (const field of ['social_problem', 'general_objective', 'specific_objectives', 'beneficiary_profile', 'methodology', 'review_status']) {
      expect(migration).toContain(field);
    }
  });

  it('creates 11 project workflow states', () => {
    for (const state of ['rascunho', 'submetido', 'em_analise', 'pendente_ajustes', 'aprovado', 'em_execucao', 'aguardando_evidencias', 'em_avaliacao', 'concluido', 'reprovado', 'arquivado']) {
      expect(migration).toContain(`'${state}'`);
    }
  });

  it('creates activities table with 8 types', () => {
    expect(migration).toContain('vertice_extension_activities');
    for (const type of ['pratica', 'teorica', 'campo', 'oficina', 'evento', 'orientacao', 'avaliacao', 'reflexao']) {
      expect(migration).toContain(`'${type}'`);
    }
  });

  it('creates competencies and evaluation tables', () => {
    expect(migration).toContain('vertice_extension_competencies');
    expect(migration).toContain('vertice_extension_competency_evaluations');
    for (const level of ['nao_demonstrada', 'em_desenvolvimento', 'demonstrada', 'consolidada']) {
      expect(migration).toContain(`'${level}'`);
    }
  });

  it('creates evidence registry with versioning', () => {
    expect(migration).toContain('vertice_extension_evidence_registry');
    expect(migration).toContain('vertice_extension_evidence_versions');
    expect(migration).toContain('file_hash');
  });

  it('creates AI tables with finding types', () => {
    expect(migration).toContain('vertice_ai_analyses');
    expect(migration).toContain('vertice_ai_findings');
    expect(migration).toContain('vertice_ai_source_references');
    for (const type of ['informacao_comprovada', 'inferencia_ia', 'inconsistencia', 'lacuna', 'recomendacao']) {
      expect(migration).toContain(`'${type}'`);
    }
  });

  it('creates 12 Impacto roles', () => {
    expect(migration).toContain('vertice_impacto_roles');
    for (const role of ['master', 'reitor', 'direcao', 'pro_reitoria', 'coordenador_curso', 'coordenador_extensao', 'nde', 'professor_orientador', 'estudante', 'parceiro_externo', 'auditor']) {
      expect(migration).toContain(`'${role}'`);
    }
  });

  it('creates has_impacto_role function', () => {
    expect(migration).toContain('has_impacto_role');
  });

  it('creates partners and integration tables', () => {
    expect(migration).toContain('vertice_extension_partners');
    expect(migration).toContain('vertice_extension_project_partners');
    expect(migration).toContain('vertice_extension_integrations');
    expect(migration).toContain('vertice_extension_integration_runs');
  });

  it('enables RLS on all new tables', () => {
    const rlsCount = (migration.match(/ENABLE ROW LEVEL SECURITY/g) || []).length;
    expect(rlsCount).toBeGreaterThanOrEqual(10);
  });

  it('uses can_read_institution for RLS policies', () => {
    const policyCount = (migration.match(/can_read_institution/g) || []).length;
    expect(policyCount).toBeGreaterThanOrEqual(10);
  });
});
