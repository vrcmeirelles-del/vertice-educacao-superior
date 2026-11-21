/**
 * Vértice Avalia 360° — catálogo curricular institucional determinístico.
 * Dados estruturados e validados; não inventa relações nem interpreta enunciados.
 * Somente memória: leitura, validação e projeção, sem rede ou persistência.
 */
import type { Catalog, Relation } from './longitudinal-engine';

export type ValidationState = 'proposed' | 'validated' | 'rejected';
export interface CatalogContext {
  institutionId: string; courseId: string; buildId: string; buildVersion: number;
}
export interface TopicNode {
  id: string; institutionId: string; courseId: string; buildId: string;
  disciplineId: string; period: number; title: string;
  parentId?: string | null; state: ValidationState;
  sourceReference?: string;
}
export interface CompetencyPlacement {
  competencyId: string; institutionId: string; courseId: string; buildId: string;
  period: number; state: ValidationState;
}
export interface CompetencyEdge {
  id: string; institutionId: string; courseId: string; buildId: string;
  fromId: string; toId: string; kind: Relation; state: ValidationState;
}
export interface CatalogInput {
  context: CatalogContext;
  knownCompetencyIds: string[];
  topics: TopicNode[];
  placements: CompetencyPlacement[];
  edges: CompetencyEdge[];
}
export interface CatalogIssue {
  code: string; detail: string; entityId?: string;
}
export interface CatalogProjection {
  ready: boolean;
  catalog: Catalog;
  issues: CatalogIssue[];
  topicParents: { id: string; parentId: string | null }[];
  fingerprint: string;
}
const validId = (v: string) => typeof v === 'string' && v.trim().length > 0;
const validPeriod = (n: number) => Number.isInteger(n) && n >= 1 && n <= 30;
export function projectInstitutionalCatalog(input: CatalogInput): CatalogProjection {
  const { context: x } = input;
  const issues: CatalogIssue[] = [];
  const issue = (code: string, detail: string, entityId?: string) =>
    issues.push({code,detail,...(entityId?{entityId}:{})});
  if (!validId(x.institutionId) || !validId(x.courseId) || !validId(x.buildId) ||
      !Number.isInteger(x.buildVersion) || x.buildVersion <= 0)
    issue('INVALID_CONTEXT','Contexto ou versão da matriz inválidos.');
  const sameScope = (v: {institutionId:string;courseId:string;buildId:string}) =>
    v.institutionId === x.institutionId && v.courseId === x.courseId && v.buildId === x.buildId;
  const known = new Set(input.knownCompetencyIds);
  if (known.size !== input.knownCompetencyIds.length || known.has('') || !known.size)
    issue('INVALID_COMPETENCIES','Identificadores de competências ausentes ou duplicados.');
  const topics = new Map<string,TopicNode>();
  for (const t of input.topics) {
    if (!sameScope(t)) { issue('CROSS_SCOPE_TOPIC','Tema fora do escopo institucional/curricular.',t.id); continue; }
    if (t.state !== 'validated') continue;
    if (!validId(t.id) || topics.has(t.id) || !validId(t.disciplineId) ||
        !validId(t.title) || !validPeriod(t.period)) {
      issue('INVALID_TOPIC','Tema inválido ou duplicado.',t.id); continue;
    }
    topics.set(t.id,t);
  }
  for (const t of topics.values()) {
    if (t.parentId && (!topics.has(t.parentId) || t.parentId === t.id))
      issue('INVALID_TOPIC_PARENT','Subtema sem tema-pai validado ou com autorreferência.',t.id);
    if (t.parentId && topics.has(t.parentId)) {
      const parent = topics.get(t.parentId)!;
      if (parent.disciplineId !== t.disciplineId) issue('CROSS_DISCIPLINE_PARENT','Subtema vinculado a tema de outra disciplina.',t.id);
      const visited = new Set<string>([t.id]);
      let next: TopicNode | undefined = parent;
      while (next) {
        if (visited.has(next.id)) {issue('TOPIC_CYCLE','Hierarquia de temas contém ciclo.',t.id);break;}
        visited.add(next.id); next = next.parentId ? topics.get(next.parentId) : undefined;
      }
    }
  }
  const placement = new Map<string,number>();
  for (const p of input.placements) {
    if (!sameScope(p)) {issue('CROSS_SCOPE_PLACEMENT','Período de competência de outra instituição/curso/matriz.',p.competencyId);continue;}
    if (p.state !== 'validated') continue;
    if (!known.has(p.competencyId) || !validPeriod(p.period) || placement.has(p.competencyId)) {
      issue('INVALID_PLACEMENT','Competência, período ou atribuição duplicada inválida.',p.competencyId);continue;
    }
    placement.set(p.competencyId,p.period);
  }
  for (const id of known) if (!placement.has(id)) issue('MISSING_PLACEMENT','Competência sem período validado.',id);
  const connections = new Map<string,{to:string;kind:Relation}[]>();
  const seen = new Set<string>();
  for (const e of input.edges) {
    if (!sameScope(e)) {issue('CROSS_SCOPE_EDGE','Relação curricular fora do escopo.',e.id);continue;}
    if (e.state !== 'validated') continue;
    if (!known.has(e.fromId) || !known.has(e.toId) || e.fromId === e.toId ||
        !['prerequisito','aprofundamento','interdisciplinar'].includes(e.kind)) {
      issue('INVALID_EDGE','Relação inválida ou autorreferente.',e.id); continue;
    }
    const key = [e.fromId,e.toId,e.kind].join('|');
    if (seen.has(key)) {issue('DUPLICATE_EDGE','Relação curricular duplicada.',e.id);continue;}
    seen.add(key);
    if (e.kind === 'prerequisito' && placement.has(e.fromId) && placement.has(e.toId)
      && placement.get(e.fromId)! > placement.get(e.toId)!)
      issue('REVERSED_PREREQUISITE','Pré-requisito de período posterior ao destino requer revisão.',e.id);
    const list = connections.get(e.fromId) || [];
    list.push({to:e.toId,kind:e.kind}); connections.set(e.fromId,list);
  }
  const prereq = new Map<string,string[]>();
  for (const [from,edges] of connections) prereq.set(from,edges.filter(e=>e.kind==='prerequisito').map(e=>e.to));
  const visited = new Set<string>(), stack = new Set<string>();
  const visit = (id:string):boolean => {
    if (stack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id);stack.add(id);
    const cyc = (prereq.get(id)||[]).some(visit);stack.delete(id);return cyc;
  };
  if ([...known].some(visit)) issue('PREREQUISITE_CYCLE','Grafo de pré-requisitos contém ciclo.');
  const catalog: Catalog = {
    competencies:[...placement].sort(([a],[b])=>a.localeCompare(b)).map(([id,period])=>({
      id,code:id,period,relations:(connections.get(id)||[]).sort((a,b)=>a.to.localeCompare(b.to))
    })),
    topics:[...topics.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(t=>({
      id:t.id,disciplineId:t.disciplineId,period:t.period
    }))
  };
  // Assinatura legível, determinística e não criptográfica — não usar como evidência de integridade.
  const fingerprint = JSON.stringify({x,ids:catalog.competencies,topics:catalog.topics});
  return {ready:issues.length===0,catalog,issues,
    topicParents:[...topics.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(t=>({id:t.id,parentId:t.parentId||null})),
    fingerprint};
}
