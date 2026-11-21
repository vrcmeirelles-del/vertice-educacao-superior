/**
 * Adaptador Vértice Avalia 360° para a Construção Curricular existente.
 * Sem consultas, mutações, suposições sobre períodos ou leitura semântica.
 * Recebe somente registros já autorizados e filtrados pela aplicação.
 */
import type { Catalog, Competency, Relation, Topic } from './longitudinal-engine';

export type CurriculumStatus = 'draft' | 'published' | 'archived';
export type DisciplineCategory = 'profissional' | 'instrumental' | 'basica';
export interface CurriculumBuildRow {
  id: string; institution_id: string; course_id: string;
  version: number; status: CurriculumStatus;
  graduate_profile?: string | null; dcn_reference?: string | null;
}
export interface CurriculumCompetencyRow {
  id: string; build_id: string; code: string; title: string;
  description?: string | null; sort_order: number;
}
export interface CurriculumDisciplineLinkRow {
  id: string; competency_id: string; discipline_name: string;
  category: DisciplineCategory; sort_order: number;
}
/** Novas relações curriculares são fornecidas como dados EXPLÍCITOS, não presumidas do banco. */
export interface VerifiedCurricularRelation {
  sourceCompetencyId: string; targetCompetencyId: string; kind: Relation;
  status: 'validated' | 'proposed';
}
export interface PeriodAssignment {
  competencyId: string; period: number; status: 'validated' | 'proposed';
}
export interface CuratedTopic {
  id: string; disciplineId: string; period: number; status: 'validated' | 'proposed';
}
export interface AdapterInput {
  institutionId: string; courseId: string; build: CurriculumBuildRow;
  competencies: CurriculumCompetencyRow[];
  links: CurriculumDisciplineLinkRow[];
  periods?: PeriodAssignment[];
  relations?: VerifiedCurricularRelation[];
  topics?: CuratedTopic[];
}
export interface AdapterDiagnostic {
  code: string; message: string; entityId?: string;
}
export interface CurriculumAdapterResult {
  ready: boolean;
  source: { buildId: string; version: number; status: CurriculumStatus; institutionId: string; courseId: string };
  catalog: Catalog;
  disciplines: { competencyId: string; name: string; category: DisciplineCategory }[];
  diagnostics: AdapterDiagnostic[];
}
export function adaptCurriculum(input: AdapterInput): CurriculumAdapterResult {
  const { build, institutionId, courseId } = input;
  const diagnostics: AdapterDiagnostic[] = [];
  const report = (code: string, message: string, entityId?: string) =>
    diagnostics.push({code,message,...(entityId ? {entityId}: {})});
  const scopeOk = Boolean(institutionId && courseId && build.id &&
    build.institution_id === institutionId && build.course_id === courseId);
  if (!scopeOk) report('SCOPE_MISMATCH','Identificador da instituição ou curso incompatível com a matriz.');
  if (build.status !== 'published') report('UNPUBLISHED_BUILD','Matriz sem status de publicação; análise não deve ser apresentada como vigente.');
  if (!Number.isInteger(build.version) || build.version < 1) report('INVALID_VERSION','Versão curricular inválida.');
  const ownCompetencies = input.competencies.filter(c => c.build_id === build.id);
  if (ownCompetencies.length !== input.competencies.length)
    report('CROSS_BUILD_COMPETENCY','Competência pertence a outra versão da matriz.');
  const ids = new Set<string>();
  const codes = new Set<string>();
  for (const c of ownCompetencies) {
    if (!c.id || ids.has(c.id)) report('DUPLICATE_COMPETENCY','Identificador de competência ausente ou duplicado.',c.id);
    if (!c.code?.trim() || codes.has(c.code.trim().toLowerCase()))
      report('DUPLICATE_CODE','Código de competência ausente ou duplicado.',c.id);
    ids.add(c.id); codes.add((c.code || '').trim().toLowerCase());
  }
  if (!ownCompetencies.length) report('EMPTY_COMPETENCIES','Matriz sem competências cadastradas.');
  const periodById = new Map<string,number>();
  for (const p of input.periods || []) {
    if (!ids.has(p.competencyId)) {report('UNKNOWN_PERIOD_COMPETENCY','Período aponta para competência inexistente na matriz.',p.competencyId);continue;}
    if (p.status !== 'validated') continue;
    if (!Number.isInteger(p.period) || p.period < 1) {report('INVALID_PERIOD','Período inválido.',p.competencyId);continue;}
    if (periodById.has(p.competencyId)) report('DUPLICATE_PERIOD','Mais de um período validado para a competência.',p.competencyId);
    else periodById.set(p.competencyId,p.period);
  }
  const missing = ownCompetencies.filter(c => !periodById.has(c.id));
  for (const c of missing) report('PERIOD_UNMAPPED','A Construção Curricular não registra período da competência; atribuição explícita necessária.',c.id);
  const relationsById = new Map<string,Competency['relations']>();
  for (const r of input.relations || []) {
    if (r.status !== 'validated') continue;
    if (!ids.has(r.sourceCompetencyId) || !ids.has(r.targetCompetencyId) || r.sourceCompetencyId === r.targetCompetencyId) {
      report('INVALID_RELATION','Relação curricular inválida ou fora da matriz.',r.sourceCompetencyId); continue;
    }
    if (!['prerequisito','aprofundamento','interdisciplinar'].includes(r.kind)) {
      report('INVALID_RELATION_KIND','Tipo de relação não reconhecido.',r.sourceCompetencyId);continue;
    }
    const relationships = relationsById.get(r.sourceCompetencyId) || [];
    if (!relationships.some(x=>x.to===r.targetCompetencyId && x.kind===r.kind))
      relationships.push({to:r.targetCompetencyId,kind:r.kind});
    relationsById.set(r.sourceCompetencyId,relationships);
  }
  const disciplines: CurriculumAdapterResult['disciplines'] = [];
  for (const l of input.links) {
    if (!ids.has(l.competency_id)) {report('UNKNOWN_LINK_COMPETENCY','Vínculo de disciplina com competência de outra matriz.',l.id);continue;}
    if (!l.discipline_name?.trim() || !['profissional','instrumental','basica'].includes(l.category)) {
      report('INVALID_DISCIPLINE','Vínculo de disciplina inválido.',l.id); continue;
    }
    disciplines.push({competencyId:l.competency_id,name:l.discipline_name.trim(),category:l.category});
  }
  const topics: Topic[] = [];
  const topicIds = new Set<string>();
  for (const t of input.topics || []) {
    if (t.status !== 'validated') continue;
    if (!t.id || topicIds.has(t.id) || !t.disciplineId || !Number.isInteger(t.period) || t.period < 1) {
      report('INVALID_TOPIC','Tema inválido ou duplicado.',t.id);continue;
    }
    topicIds.add(t.id);
    topics.push({id:t.id,disciplineId:t.disciplineId,period:t.period});
  }
  const competencies: Competency[] = ownCompetencies
    .filter(c=>periodById.has(c.id))
    .map(c=>({id:c.id,code:c.code,period:periodById.get(c.id)!,relations:relationsById.get(c.id)||[]}));
  return {
    ready:scopeOk && build.status==='published' && diagnostics.length===0,
    source:{buildId:build.id,version:build.version,status:build.status,institutionId,courseId},
    catalog:{competencies,topics},disciplines,diagnostics
  };
}
