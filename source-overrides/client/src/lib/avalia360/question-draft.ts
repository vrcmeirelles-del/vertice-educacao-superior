/**
 * Avalia 360° — Modelo de rascunho docente.
 * Preparação local, sem postagem de dados, correção ou IA.
 */
import type { Difficulty, Purpose } from './longitudinal-engine';
import type { PendingQuestionImage } from './QuestionImageField';

export type QuestionKind = 'objetiva' | 'discursiva';
export interface AnswerOption { id: string; text: string; }
export interface QuestionDraft {
  id: string;
  disciplineId: string;
  kind: QuestionKind;
  statement: string;
  options: AnswerOption[];
  correctOptionId: string;
  /** Fundamentação fornecida pelo docente; nunca impressa no caderno discente. */
  answerJustification?: string;
  rubric: string;
  /** Número de pautas com espaçamento de linha 1,5 na prova (3–60). */
  answerLines?: number;
  /** Resposta-modelo docente: referência, não nota automática nem texto para o PDF do aluno. */
  expectedAnswer?: string;
  topicIds: string[];
  competencyIds: string[];
  purpose: Purpose[];
  estimatedDifficulty: Difficulty;
  points: number;
  examTags: string[];
  images: PendingQuestionImage[];
  /** Origem no Banco de Questões, para que a estatística observada volte ao item. */
  sourceBankId?: string;
  /** Erro conceitual que cada alternativa errada revela (id da alternativa → descrição curta). */
  distractorNotes?: Record<string, string>;
  /** Nível de Bloom definido pelo professor (1 Lembrar … 6 Criar); prevalece sobre a sugestão por verbo. */
  bloomLevel?: number;
  /** Rubrica estruturada da discursiva: a soma dos critérios deve ser igual à pontuação da questão. */
  rubricCriteria?: Array<{ id: string; label: string; points: number }>;
  spreadsheetMetadata?: {
    topic:string;subtopic:string;keywords:string;competencies:string;
    fileName:string;imagePosition:string;caption:string;altText:string;
  };
}
export interface DraftIssue {
  field: string;
  code: string;
  message: string;
}
export function validateQuestionDraft(
  draft: QuestionDraft,
  allowedTopicIds: string[],
  allowedCompetencyIds: string[]
): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const add = (field: string, code: string, message: string) => issues.push({field,code,message});
  if (!draft.id.trim()) add('id','ID_REQUIRED','Identificador da questão é obrigatório.');
  if (!draft.disciplineId.trim()) add('disciplineId','DISCIPLINE_REQUIRED','Informe a disciplina.');
  if (!draft.statement.trim()) add('statement','STATEMENT_REQUIRED','Informe o enunciado.');
  if (!['objetiva','discursiva'].includes(draft.kind)) add('kind','INVALID_KIND','Tipo inválido.');
  if (!Number.isFinite(draft.points) || draft.points<=0)
    add('points','INVALID_POINTS','A pontuação deve ser positiva.');
  if (![1,2,3,4,5].includes(draft.estimatedDifficulty))
    add('estimatedDifficulty','INVALID_DIFFICULTY','Selecione a dificuldade de 1 a 5.');
  if (!draft.purpose.length || draft.purpose.some(p=>!['diagnostica','formativa','somativa'].includes(p)))
    add('purpose','INVALID_PURPOSE','Indique pelo menos uma finalidade pedagógica válida.');
  const tset = new Set(allowedTopicIds), cset = new Set(allowedCompetencyIds);
  if (!draft.topicIds.length || draft.topicIds.some(id=>!tset.has(id)) ||
      new Set(draft.topicIds).size !== draft.topicIds.length)
    add('topicIds','INVALID_TOPICS','Selecione temas cadastrados e sem duplicidade.');
  if (!draft.competencyIds.length || draft.competencyIds.some(id=>!cset.has(id)) ||
      new Set(draft.competencyIds).size !== draft.competencyIds.length)
    add('competencyIds','INVALID_COMPETENCIES','Selecione competências cadastradas e sem duplicidade.');
  if (draft.kind==='objetiva') {
    if (draft.options.length<2 || draft.options.length>8)
      add('options','INVALID_OPTIONS_COUNT','Use de 2 a 8 alternativas.');
    const identifiers = new Set(draft.options.map(x=>x.id));
    if (identifiers.size!==draft.options.length || draft.options.some(x=>!x.id.trim() || !x.text.trim()))
      add('options','INVALID_OPTIONS','As alternativas precisam de identificadores distintos e texto.');
    if (!draft.answerJustification?.trim())
      add('answerJustification','MISSING_JUSTIFICATION','Justifique a alternativa correta para curadoria e calibração.');
    if (!identifiers.has(draft.correctOptionId))
      add('correctOptionId','INVALID_KEY','Selecione o gabarito da questão.');
  } else {
    if (!Number.isInteger(draft.answerLines??8)||(draft.answerLines??8)<3||(draft.answerLines??8)>60)
      add('answerLines','INVALID_RESPONSE_LINES','Informe entre 3 e 60 linhas de resposta.');
    if (!draft.rubric.trim()) add('rubric','MISSING_RUBRIC','Questão discursiva exige rubrica de correção.');
    if (!draft.expectedAnswer?.trim()) add('expectedAnswer','MISSING_EXPECTED_ANSWER','Informe o padrão de resposta esperado para orientar a correção.');
  }
  if (draft.images.length>12) add('images','TOO_MANY_IMAGES','Máximo de 12 figuras por questão.');
  for (const im of draft.images) {
    if (!im.file || im.file.size<=0 || im.file.size>10*1024*1024 ||
        !['image/png','image/jpeg','image/webp'].includes(im.file.type))
      add('images','INVALID_FILE','Formato ou tamanho da imagem inválido.');
    if (!im.altText.trim()) add('images','MISSING_ALT_TEXT','Descreva a imagem para acessibilidade.');
    if (!im.rightsStatus || im.rightsStatus==='nao_informado')
      add('images','MISSING_RIGHTS','Confirme os direitos de uso da imagem.');
    if (im.placement==='alternativa' && (draft.kind!=='objetiva' ||
        !draft.options.some(x=>x.id===im.alternativeId)))
      add('images','INVALID_ALTERNATIVE_REFERENCE','A figura deve referenciar uma alternativa válida.');
  }
  return issues;
}
