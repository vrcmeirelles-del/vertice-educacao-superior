/**
 * Avalia 360° — checklist técnico do item e do caderno.
 * Algoritmo determinístico por regras explícitas: sem IA, sem interpretação
 * semântica do texto. Mesmos dados, mesmo resultado. Cada regra tem código,
 * gravidade e mensagem para que a decisão do colegiado seja auditável.
 *
 * Gravidade:
 *  - 'bloqueio': impede o envio para validação (o servidor repete as regras estruturais);
 *  - 'alerta': exige atenção do docente e fica visível ao revisor, mas não bloqueia.
 */
import {bloomProfile} from './bloom';
export type ChecklistSeverity = 'bloqueio' | 'alerta';
export interface ChecklistIssue {
  code: string;
  severity: ChecklistSeverity;
  message: string;
  /** Índice (0-based) da questão, ausente nas regras do caderno. */
  questionIndex?: number;
}
/** Subconjunto estrutural: aceita a questão em edição e a salva no servidor. */
export interface ChecklistQuestion {
  kind: 'objetiva' | 'discursiva';
  statement: string;
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
  answerJustification?: string;
  rubric: string;
  expectedAnswer?: string;
  points: number;
  competencyIds: string[];
  topicIds: string[];
  images: Array<{ altText: string; rightsStatus: string }>;
  bloomLevel?: number;
  rubricCriteria?: Array<{ id: string; label: string; points: number }>;
}
export interface ChecklistBlueprint {
  requiredCompetencyIds: string[];
  requiredTopicIds: string[];
  competencyLabels?: Record<string, string>;
  topicLabels?: Record<string, string>;
}
export interface ChecklistResult {
  issues: ChecklistIssue[];
  blocking: number;
  warnings: number;
  /** Distribuição das letras do gabarito nas objetivas. */
  answerKey: Record<string, number>;
  canSubmit: boolean;
}

/** Limiares explícitos, versionados com o código (revisáveis pelo NDE). */
export const CHECKLIST_RULES = {
  version: '2026.11-1',
  /** Correta com mais de 1,6x o tamanho médio das demais. */
  longestCorrectRatio: 1.6,
  /** Correta mais longa em mais da metade das objetivas (mín. 4). */
  longestCorrectShare: 0.5,
  /** Uma letra concentrando mais de 40% do gabarito (mín. 5 objetivas). */
  answerKeyConcentration: 0.4,
  /** Sequência de gabaritos iguais consecutivos. */
  answerKeyRun: 3,
  minStatementChars: 10,
} as const;

const norm = (v: string) =>
  v.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
const ALL_OR_NONE = /\b(todas|nenhuma)\s+(d?as\s+)?(alternativas\s+|opcoes\s+|afirmativas\s+)?(anteriores|acima)\b/;
const NEGATIVE = /\b(nao|exceto|incorreta|incorreto|falsa|falso)\b/;
// Negativa destacada: em CAIXA ALTA no original (ex.: NÃO, EXCETO, INCORRETA).
const NEGATIVE_HIGHLIGHTED = /\b(NÃO|NAO|EXCETO|INCORRETA|INCORRETO|FALSA|FALSO)\b/;
// Pistas absolutas costumam denunciar a alternativa errada.
const ABSOLUTE = /\b(sempre|nunca|jamais|todo|toda|todos|todas|nenhum|nenhuma|somente|exclusivamente)\b/;

export function checkQuestion(q: ChecklistQuestion, index: number): ChecklistIssue[] {
  const out: ChecklistIssue[] = [];
  const add = (code: string, severity: ChecklistSeverity, message: string) =>
    out.push({ code, severity, message, questionIndex: index });
  const statement = q.statement.trim();
  if (statement.length < CHECKLIST_RULES.minStatementChars)
    add('ENUNCIADO_CURTO', 'bloqueio', 'Enunciado com menos de 10 caracteres.');
  if (!Number.isFinite(q.points) || q.points <= 0)
    add('PONTUACAO_INVALIDA', 'bloqueio', 'Pontuação deve ser positiva.');
  if (!q.competencyIds.length && !q.topicIds.length)
    add('SEM_VINCULO_CURRICULAR', 'alerta', 'Questão sem competência nem tema vinculado.');

  if (q.kind === 'objetiva') {
    const texts = q.options.map(o => o.text.trim());
    if (q.options.length < 2 || texts.some(t => !t))
      add('ALTERNATIVA_VAZIA', 'bloqueio', 'Há alternativa sem texto.');
    if (!q.options.some(o => o.id === q.correctOptionId))
      add('SEM_GABARITO', 'bloqueio', 'Alternativa correta não definida.');
    if (!q.answerJustification?.trim())
      add('SEM_JUSTIFICATIVA', 'bloqueio', 'Justificativa do gabarito ausente.');
    const normalized = texts.map(norm).filter(Boolean);
    if (new Set(normalized).size !== normalized.length)
      add('ALTERNATIVA_DUPLICADA', 'bloqueio', 'Há alternativas com o mesmo texto.');
    if (normalized.some(t => ALL_OR_NONE.test(t)))
      add('TODAS_NENHUMA', 'alerta', 'Evite "todas/nenhuma das anteriores": reduz a qualidade do item.');
    if (NEGATIVE.test(norm(statement)) && !NEGATIVE_HIGHLIGHTED.test(statement))
      add('NEGATIVA_SEM_DESTAQUE', 'alerta', 'Enunciado negativo (não, exceto, incorreta) sem destaque em maiúsculas.');
    const correct = q.options.find(o => o.id === q.correctOptionId);
    const others = q.options.filter(o => o.id !== q.correctOptionId && o.text.trim());
    if (correct && others.length) {
      const avg = others.reduce((s, o) => s + o.text.trim().length, 0) / others.length;
      if (avg > 0 && correct.text.trim().length > avg * CHECKLIST_RULES.longestCorrectRatio)
        add('CORRETA_MAIS_LONGA', 'alerta', 'A alternativa correta é bem mais longa que as demais: pista involuntária.');
      const absoluteWrong = others.filter(o => ABSOLUTE.test(norm(o.text))).length;
      if (others.length >= 3 && absoluteWrong === others.length)
        add('PISTA_ABSOLUTA', 'alerta', 'Todas as alternativas erradas usam termos absolutos (sempre, nunca, somente…).');
    }
  } else {
    if (!q.rubric.trim() && !(q.rubricCriteria?.length)) add('SEM_RUBRICA', 'bloqueio', 'Rubrica da discursiva ausente.');
    if (q.rubricCriteria?.length) {
      if (q.rubricCriteria.some(c => !c.label.trim() || !(c.points > 0)))
        add('RUBRICA_CRITERIO', 'bloqueio', 'Critério da rubrica sem descrição ou sem pontos.');
      const total = Math.round(q.rubricCriteria.reduce((s, c) => s + (Number(c.points) || 0), 0) * 100) / 100;
      if (Math.abs(total - q.points) > 0.001)
        add('RUBRICA_SOMA', 'bloqueio', 'A soma dos critérios (' + total + ') difere da pontuação da questão (' + q.points + ').');
    }
    if (!q.expectedAnswer?.trim()) add('SEM_PADRAO_RESPOSTA', 'bloqueio', 'Padrão de resposta esperado ausente.');
  }
  q.images.forEach((im, j) => {
    if (!im.altText.trim())
      add('IMAGEM_SEM_DESCRICAO', 'bloqueio', 'Imagem ' + (j + 1) + ' sem descrição acessível.');
    if (!['autoral', 'licenciado', 'uso_autorizado'].includes(im.rightsStatus))
      add('IMAGEM_SEM_DIREITO', 'bloqueio', 'Imagem ' + (j + 1) + ' sem declaração de direito de uso.');
  });
  return out;
}

export function checkAssessment(questions: ChecklistQuestion[], blueprint?: ChecklistBlueprint, options?: {purpose?: string; period?: number}): ChecklistResult {
  const issues: ChecklistIssue[] = [];
  const summative = options?.purpose === 'somativa';
  if (!questions.length) issues.push({ code: 'CADERNO_VAZIO', severity: 'bloqueio', message: 'Inclua ao menos uma questão.' });
  questions.forEach((q, i) => {
    const own = checkQuestion(q, i);
    // Somativa: competência obrigatória (base do diagnóstico por competência). O servidor aplica a mesma regra.
    if (summative && !q.competencyIds.length) {
      issues.push(...own.filter(x => x.code !== 'SEM_VINCULO_CURRICULAR'),
        {code: 'SOMATIVA_SEM_COMPETENCIA', severity: 'bloqueio', questionIndex: i,
         message: 'Avaliação somativa: vincule a questão a ao menos uma competência.'});
    } else issues.push(...own);
  });

  const objectives = questions.filter(q => q.kind === 'objetiva' && q.options.some(o => o.id === q.correctOptionId));
  const answerKey: Record<string, number> = {};
  for (const q of objectives) answerKey[q.correctOptionId] = (answerKey[q.correctOptionId] || 0) + 1;
  if (objectives.length >= 5) {
    const [letter, count] = Object.entries(answerKey).sort((a, b) => b[1] - a[1])[0];
    if (count / objectives.length > CHECKLIST_RULES.answerKeyConcentration)
      issues.push({ code: 'GABARITO_CONCENTRADO', severity: 'alerta',
        message: 'A letra ' + letter + ' é o gabarito de ' + count + ' de ' + objectives.length + ' objetivas.' });
  }
  let run = 1;
  for (let i = 1; i < objectives.length; i++) {
    run = objectives[i].correctOptionId === objectives[i - 1].correctOptionId ? run + 1 : 1;
    if (run === CHECKLIST_RULES.answerKeyRun) {
      issues.push({ code: 'GABARITO_SEQUENCIA', severity: 'alerta',
        message: CHECKLIST_RULES.answerKeyRun + ' objetivas seguidas com a mesma letra no gabarito.' });
      break;
    }
  }
  if (objectives.length >= 4) {
    const longest = objectives.filter(q => {
      const correct = q.options.find(o => o.id === q.correctOptionId)!.text.trim().length;
      return q.options.every(o => o.id === q.correctOptionId || o.text.trim().length < correct);
    }).length;
    if (longest / objectives.length > CHECKLIST_RULES.longestCorrectShare)
      issues.push({ code: 'CORRETA_MAIS_LONGA_PADRAO', severity: 'alerta',
        message: 'A correta é a alternativa mais longa em ' + longest + ' de ' + objectives.length + ' objetivas.' });
  }
  if (blueprint) {
    const usedC = new Set(questions.flatMap(q => q.competencyIds));
    const usedT = new Set(questions.flatMap(q => q.topicIds));
    const missingC = blueprint.requiredCompetencyIds.filter(id => !usedC.has(id));
    const missingT = blueprint.requiredTopicIds.filter(id => !usedT.has(id));
    if (missingC.length)
      issues.push({ code: 'COMPETENCIA_DESCOBERTA', severity: 'alerta',
        message: 'Competências planejadas sem questão: ' + missingC.map(id => blueprint.competencyLabels?.[id] || id).join(', ') + '.' });
    if (missingT.length)
      issues.push({ code: 'TEMA_DESCOBERTO', severity: 'alerta',
        message: 'Temas planejados sem questão: ' + missingT.map(id => blueprint.topicLabels?.[id] || id).join(', ') + '.' });
  }
  if (summative) questions.forEach((q, i) => {
    if (q.kind === 'discursiva' && !q.rubricCriteria?.length)
      issues.push({code: 'RUBRICA_SEM_CRITERIOS', severity: 'alerta', questionIndex: i,
        message: 'Somativa: estruture a rubrica em critérios com pontos para permitir a dupla correção.'});
  });
  const bloom = bloomProfile(questions, {purpose: options?.purpose, period: options?.period});
  if (bloom.misaligned)
    issues.push({code: 'BLOOM_BAIXO', severity: 'alerta',
      message: Math.round((bloom.lowShare ?? 0) * 100) + '% das questões classificadas estão em Lembrar/Compreender numa avaliação somativa do ' + options?.period + 'º período.'});
  const blocking = issues.filter(i => i.severity === 'bloqueio').length;
  return { issues, blocking, warnings: issues.length - blocking, answerKey, canSubmit: blocking === 0 && questions.length > 0 };
}

/** Motivos padronizados de devolução: base dos indicadores por motivo. */
export const RETURN_REASONS = [
  ['enunciado', 'Enunciado (clareza, autossuficiência)'],
  ['alternativas', 'Alternativas (plausibilidade, paralelismo)'],
  ['gabarito', 'Gabarito ou justificativa'],
  ['rubrica', 'Rubrica ou padrão de resposta'],
  ['alinhamento_curricular', 'Alinhamento à competência ou ao PPC'],
  ['nivel_dificuldade', 'Nível de dificuldade'],
  ['acessibilidade', 'Acessibilidade'],
  ['direitos_imagem', 'Direitos de uso de imagem'],
  ['outro', 'Outro'],
] as const;
export type ReturnReason = typeof RETURN_REASONS[number][0];

/** Converte questões de um snapshot salvo para o formato do checklist (revisão pelo colegiado). */
export function checklistQuestionsFromSnapshot(questions:Array<Record<string,unknown>>):ChecklistQuestion[]{
 const str=(v:unknown)=>typeof v==='string'?v:'';
 const arr=(v:unknown)=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'):[];
 return questions.map(q=>({
  kind:q.kind==='discursiva'?'discursiva':'objetiva',statement:str(q.statement),
  options:Array.isArray(q.options)?(q.options as Array<Record<string,unknown>>).map(o=>({id:str(o.id),text:str(o.text)})):[],
  correctOptionId:str(q.correctOptionId),answerJustification:str(q.answerJustification),
  rubric:str(q.rubric),expectedAnswer:str(q.expectedAnswer),
  points:typeof q.points==='number'?q.points:0,competencyIds:arr(q.competencyIds),topicIds:arr(q.topicIds),
  images:Array.isArray(q.images)?(q.images as Array<Record<string,unknown>>).map(im=>({altText:str(im.altText),rightsStatus:str(im.rightsStatus)})):[],
  ...(typeof q.bloomLevel==='number'?{bloomLevel:q.bloomLevel}:{}),
  ...(Array.isArray(q.rubricCriteria)?{rubricCriteria:(q.rubricCriteria as Array<Record<string,unknown>>).map(c=>({id:str(c.id),label:str(c.label),points:typeof c.points==='number'?c.points:0}))}:{}),
 }));
}
