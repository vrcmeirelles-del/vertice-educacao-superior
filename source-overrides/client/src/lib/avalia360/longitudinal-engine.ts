/**
 * Vértice Avalia 360° — núcleo determinístico v1.
 * Não lê semanticamente enunciados nem atribui notas. Não acessa banco ou rede.
 * Todos os vínculos são DECLARADOS/VALIDADOS e toda saída é rastreável.
 */
export type Purpose = 'diagnostica' | 'formativa' | 'somativa';
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type Relation = 'prerequisito' | 'aprofundamento' | 'interdisciplinar';
export type EvidenceStatus = 'declarada' | 'validada';
export interface Competency {
  id: string; code: string; period: number;
  relations?: { to: string; kind: Relation }[];
}
export interface Topic { id: string; disciplineId: string; period: number; }
export interface Item {
  id: string; disciplineId: string; topicIds: string[];
  competencyIds: string[]; estimatedDifficulty: Difficulty;
  purpose: Purpose[]; points: number;
  evidence: EvidenceStatus;
  examTags?: string[];
}
export interface Assessment {
  id: string; institutionId: string; courseId: string; period: number;
  disciplineId: string; purpose: Purpose[];
  examFocus?: string; targetDifficulty: Difficulty;
  requiredCompetencyIds: string[]; requiredTopicIds: string[];
  items: Item[];
}
export interface Catalog { competencies: Competency[]; topics: Topic[]; }
export interface ItemResult { itemId: string; correct: number; graded: number; }
export interface AnalysisInput { assessment: Assessment; catalog: Catalog; results?: ItemResult[]; }
export interface Finding { code: string; level: 'info' | 'attention' | 'blocked'; message: string; itemIds?: string[]; }
export interface Analysis {
  version: '1.0.0'; assessmentId: string; status: 'valid' | 'incomplete';
  totals: { items: number; points: number; meanEstimatedDifficulty: number | null };
  coverage: { competencies: { id: string; items: number; verifiedItems: number }[];
    topics: { id: string; items: number }[] };
  longitudinal: { itemId: string; current: string[]; prior: string[]; links: Relation[] }[];
  difficulty: { level: Difficulty; count: number }[];
  performance: { itemId: string; graded: number; accuracy: number | null; status: string }[];
  findings: Finding[];
}
const unique = (values: string[]): string[] => Array.from(new Set(values));
const round = (n: number) => Math.round(n * 10000) / 10000;
const diffs: Difficulty[] = [1, 2, 3, 4, 5];
export function analyzeAssessment({ assessment: a, catalog, results = [] }: AnalysisInput): Analysis {
  const findings: Finding[] = [];
  const c = new Map(catalog.competencies.map(x => [x.id, x]));
  const t = new Map(catalog.topics.map(x => [x.id, x]));
  const add = (code: string, level: Finding['level'], message: string, itemIds?: string[]) =>
    findings.push({ code, level, message, ...(itemIds?.length ? { itemIds } : {}) });
  if (!a.institutionId || !a.courseId || !a.id || !a.disciplineId || !Number.isInteger(a.period) || a.period < 1)
    add('INVALID_CONTEXT', 'blocked', 'Identificação institucional, disciplina ou período inválidos.');
  if (!a.items.length) add('EMPTY_ASSESSMENT', 'blocked', 'Avaliação sem questões.');
  if (!diffs.includes(a.targetDifficulty)) add('INVALID_TARGET_DIFFICULTY', 'blocked', 'Dificuldade-alvo fora de 1–5.');
  if (!a.purpose.length || a.purpose.some(p => !['diagnostica','formativa','somativa'].includes(p)))
    add('INVALID_PURPOSE', 'blocked', 'Finalidade pedagógica inválida.');
  const itemIds = new Set<string>();
  for (const item of a.items) {
    if (!item.id || itemIds.has(item.id)) add('DUPLICATE_ITEM_ID', 'blocked', 'Questão sem identificador único.', [item.id]);
    itemIds.add(item.id);
    if (!Number.isFinite(item.points) || item.points <= 0) add('INVALID_POINTS','blocked','Pontuação deve ser positiva.',[item.id]);
    if (!diffs.includes(item.estimatedDifficulty)) add('INVALID_DIFFICULTY','blocked','Dificuldade da questão fora de 1–5.',[item.id]);
    if (!item.purpose.length || item.purpose.some(p => !a.purpose.includes(p)))
      add('PURPOSE_MISMATCH','attention','Finalidade da questão não consta da avaliação.',[item.id]);
    if (!item.topicIds.length || !item.competencyIds.length)
      add('MISSING_TAGS','attention','Questão sem tema ou competência cadastrada.',[item.id]);
    if (item.evidence !== 'validada') add('DECLARED_ONLY','info','Vínculos informados, ainda sem validação pedagógica do conteúdo.',[item.id]);
    for (const id of unique(item.competencyIds)) if (!c.has(id))
      add('UNKNOWN_COMPETENCY','blocked',`Competência desconhecida: ${id}.`,[item.id]);
    for (const id of unique(item.topicIds)) if (!t.has(id))
      add('UNKNOWN_TOPIC','blocked',`Tema desconhecido: ${id}.`,[item.id]);
    if (a.examFocus && !(item.examTags || []).includes(a.examFocus))
      add('EXAM_TAG_MISSING','attention','Questão sem vínculo declarado com o exame selecionado.',[item.id]);
  }
  for (const id of a.requiredCompetencyIds) if (!c.has(id)) add('UNKNOWN_REQUIRED_COMPETENCY','blocked',`Competência requerida ausente do catálogo: ${id}.`);
  for (const id of a.requiredTopicIds) if (!t.has(id)) add('UNKNOWN_REQUIRED_TOPIC','blocked',`Tema requerido ausente do catálogo: ${id}.`);
  const coverage = {
    competencies: unique(a.requiredCompetencyIds).map(id => ({ id, items: a.items.filter(x => x.competencyIds.includes(id)).length,
      verifiedItems: a.items.filter(x => x.competencyIds.includes(id) && x.evidence === 'validada').length })),
    topics: unique(a.requiredTopicIds).map(id => ({ id, items: a.items.filter(x => x.topicIds.includes(id)).length }))
  };
  for (const x of coverage.competencies) if (!x.items) add('COMPETENCY_GAP','attention',`Competência ${x.id} não contemplada.`);
  for (const x of coverage.topics) if (!x.items) add('TOPIC_GAP','attention',`Tema ${x.id} não contemplado.`);
  const longitudinal = a.items.map(item => {
    const current = unique(item.competencyIds.filter(id => c.get(id)?.period === a.period));
    const future = unique(item.competencyIds.filter(id => (c.get(id)?.period ?? -1) > a.period));
    if (future.length) add('FUTURE_COMPETENCY','attention','Competência prevista para período posterior; verificar intencionalidade.',[item.id]);
    const prior = unique(item.competencyIds.filter(id => (c.get(id)?.period ?? Infinity) < a.period));
    const links = unique(item.competencyIds.flatMap(id => (c.get(id)?.relations || [])
      .filter(r => item.competencyIds.includes(r.to)).map(r => r.kind))) as Relation[];
    if (prior.length && !links.length) add('PRIOR_WITHOUT_LINK','info','Competência anterior declarada sem relação longitudinal explícita.',[item.id]);
    return { itemId: item.id, current, prior, links };
  });
  const difficulty = diffs.map(level => ({ level, count: a.items.filter(x => x.estimatedDifficulty === level).length }));
  const validDifficulties = a.items.filter(x => diffs.includes(x.estimatedDifficulty));
  const meanEstimatedDifficulty = validDifficulties.length ?
    round(validDifficulties.reduce((sum,x) => sum + x.estimatedDifficulty,0)/validDifficulties.length) : null;
  if (meanEstimatedDifficulty !== null && diffs.includes(a.targetDifficulty) && Math.abs(meanEstimatedDifficulty-a.targetDifficulty) >= 0.75)
    add('DIFFICULTY_MISMATCH','attention',
      meanEstimatedDifficulty < a.targetDifficulty ? 'Composição abaixo do desafio pretendido; revisar complexidade e cobertura.' :
        'Composição acima do desafio pretendido; revisar adequação à turma.');
  const resultsById = new Map(results.map(x => [x.itemId,x]));
  for (const r of results) if (!itemIds.has(r.itemId) || !Number.isInteger(r.graded) || !Number.isInteger(r.correct) || r.graded < 0 || r.correct < 0 || r.correct > r.graded)
    add('INVALID_RESULT','blocked','Resultado de correção inválido ou associado a item inexistente.',[r.itemId]);
  const performance = a.items.map(item => {
    const r = resultsById.get(item.id);
    const valid = r && Number.isInteger(r.graded) && Number.isInteger(r.correct) && r.graded >= 0 && r.correct >= 0 && r.correct <= r.graded;
    return { itemId:item.id, graded:valid?r!.graded:0, accuracy:valid && r!.graded > 0 ? round(r!.correct/r!.graded) : null,
      status:!valid || r!.graded===0?'sem_dados':r!.graded<5?'amostra_reduzida':'descritivo' };
  });
  return { version:'1.0.0', assessmentId:a.id,
    status:findings.some(f=>f.level==='blocked')?'incomplete':'valid',
    totals:{items:a.items.length,points:round(a.items.reduce((s,x)=>s+(Number.isFinite(x.points)?x.points:0),0)),meanEstimatedDifficulty},
    coverage,longitudinal,difficulty,performance,findings };
}
