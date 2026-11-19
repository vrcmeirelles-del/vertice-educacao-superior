/**
 * Vértice Avalia 360° — porta de validação anterior à curadoria.
 *
 * Função pura: NÃO autentica usuário, NÃO busca permissões e NÃO persiste dados.
 * scope deve ser emitido por serviço confiável após autenticação, MFA e autorização
 * institucional/curso. NUNCA recebê-lo como afirmação do navegador.
 */
import { analyzeAssessment, type Analysis, type AnalysisInput } from './longitudinal-engine';
import type { CatalogProjection } from './institutional-catalog';
import type { CurriculumAdapterResult } from './curriculum-adapter';

export interface TrustedAssessmentScope {
  institutionId: string;
  courseId: string;
  buildId: string;
  buildVersion: number;
  authorizedBy: 'backend';
}
export interface PreflightInput {
  scope: TrustedAssessmentScope;
  source: CurriculumAdapterResult;
  projectedCatalog: CatalogProjection;
  input: AnalysisInput;
}
export type PreflightResult =
  | { ok: true; analysis: Analysis; curriculum: { buildId: string; version: number } }
  | { ok: false; reasons: string[] };

export function preflightAndAnalyze(input: PreflightInput): PreflightResult {
  const { scope, source, projectedCatalog, input: payload } = input;
  const reasons: string[] = [];
  const a = payload.assessment;
  if (scope.authorizedBy !== 'backend' || !scope.institutionId || !scope.courseId ||
      !scope.buildId || !Number.isInteger(scope.buildVersion) || scope.buildVersion < 1)
    reasons.push('UNTRUSTED_SCOPE');
  if (a.institutionId !== scope.institutionId || a.courseId !== scope.courseId)
    reasons.push('ASSESSMENT_SCOPE_MISMATCH');
  if (source.source.institutionId !== scope.institutionId ||
      source.source.courseId !== scope.courseId ||
      source.source.buildId !== scope.buildId ||
      source.source.version !== scope.buildVersion)
    reasons.push('CURRICULUM_SCOPE_MISMATCH');
  if (!source.ready || source.source.status !== 'published')
    reasons.push('CURRICULUM_NOT_READY');
  if (!projectedCatalog.ready) reasons.push('CATALOG_NOT_VALIDATED');
  // O catálogo projetado é autoritativo; metadados de catálogo fornecidos
  // pelo cliente devem ser ignorados para não forjar competências/temas.
  if (JSON.stringify(payload.catalog) !== JSON.stringify(projectedCatalog.catalog))
    reasons.push('CATALOG_PAYLOAD_MISMATCH');
  const ids = new Set(projectedCatalog.catalog.competencies.map(c => c.id));
  const topics = new Set(projectedCatalog.catalog.topics.map(t => t.id));
  if (a.requiredCompetencyIds.some(id => !ids.has(id)) ||
      a.items.some(item => item.competencyIds.some(id => !ids.has(id))))
    reasons.push('UNVALIDATED_COMPETENCY');
  if (a.requiredTopicIds.some(id => !topics.has(id)) ||
      a.items.some(item => item.topicIds.some(id => !topics.has(id))))
    reasons.push('UNVALIDATED_TOPIC');
  if (reasons.length) return {ok:false,reasons:Array.from(new Set(reasons))};

  const analysis = analyzeAssessment({...payload,catalog:projectedCatalog.catalog});
  // Bloqueios de integridade não constituem parecer positivo.
  if (analysis.status === 'incomplete') {
    return {ok:false,reasons:analysis.findings.filter(f=>f.level==='blocked').map(f=>f.code)};
  }
  return {ok:true,analysis,curriculum:{buildId:scope.buildId,version:scope.buildVersion}};
}
