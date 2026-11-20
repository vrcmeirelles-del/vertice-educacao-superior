/**
 * Banco de Questões — contrato independente da prova.
 * Demonstração LOCAL. Não expõe ou altera alunos, PPC ou o banco institucional.
 * Guarda versões originais imutáveis: reutilizar sempre cria nova ID na avaliação.
 */
import type {QuestionDraft} from './question-draft';

export type BankStatus='rascunho'|'em_curadoria'|'validada';
export interface BankQuestion {
 bankId:string;revision:number;institutionId:string;courseId:string;discipline:string;
 createdAt:string;status:BankStatus;sourceAssessmentId?:string;
 indexLabels?:string[];
 question:Omit<QuestionDraft,'images'> & {images:[]};
}
const normalized=(v:string)=>v.normalize('NFKC').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
/** O mesmo ID e a mesma versão não devem ser modificados quando reutilizados. */
export function prepareBankQuestion(args:{
 institutionId:string;courseId:string;discipline:string;
 question:QuestionDraft;createdAt:string;bankId:string;indexLabels?:string[];
}):BankQuestion{
 const {question:q}=args;
 if(!args.institutionId||!args.courseId||!args.discipline.trim())throw Error('Selecione instituição, curso e disciplina.');
 if(!args.bankId.trim()||!Number.isFinite(Date.parse(args.createdAt)))throw Error('Identificador do banco inválido.');
 if(q.images.length)throw Error('Questões com imagens exigem armazenamento privado de mídia; não podem ser arquivadas nesta demonstração.');
 if(q.statement.trim().length<10)throw Error('Complete o enunciado da questão.');
 if(!Number.isFinite(q.points)||q.points<=0)throw Error('Informe pontuação positiva.');
 if(q.kind==='objetiva'){
  if(q.options.length<2||q.options.some(o=>!o.text.trim()))throw Error('Complete todas as alternativas.');
  if(!q.options.some(o=>o.id===q.correctOptionId))throw Error('Selecione o gabarito.');
  if(!q.answerJustification?.trim())throw Error('Justifique a resposta correta antes de arquivar a objetiva.');
  if(new Set(q.options.map(o=>normalized(o.text))).size!==q.options.length)throw Error('Há alternativas duplicadas.');
 }else{
  if(!Number.isInteger(q.answerLines??8)||(q.answerLines??8)<3||(q.answerLines??8)>60)throw Error('Informe de 3 a 60 linhas na discursiva.');
  if(!q.rubric.trim())throw Error('Defina a rubrica da questão discursiva.');
  if(!q.expectedAnswer?.trim())throw Error('Informe o padrão de resposta esperado antes de arquivar a discursiva.');
 }
 return {bankId:args.bankId,revision:1,institutionId:args.institutionId,courseId:args.courseId,
  discipline:args.discipline.trim(),createdAt:args.createdAt,status:'rascunho',
  indexLabels:[...new Set([
   ...(args.indexLabels??[]),q.spreadsheetMetadata?.topic??'',q.spreadsheetMetadata?.subtopic??'',
   ...(q.spreadsheetMetadata?.keywords.split(',')??[])
  ].map(label=>label.trim()).filter(Boolean))],
  question:{...q,spreadsheetMetadata:q.spreadsheetMetadata?{...q.spreadsheetMetadata}:undefined,id:args.bankId,disciplineId:args.discipline.trim(),
   options:q.options.map(o=>({...o})),topicIds:[...q.topicIds],
   competencyIds:[...q.competencyIds],purpose:[...q.purpose],examTags:[...q.examTags],images:[]}};
}
export function filterBankQuestions(list:BankQuestion[],args:{
 institutionId:string;courseId:string;discipline?:string;query?:string
}):BankQuestion[]{
 const normalizeSearch=(value:string)=>normalized(value).normalize('NFD').replace(/\p{M}/gu,'');
 const disc=normalized(args.discipline||''),search=normalizeSearch(args.query||'');
 return list.filter(q=>q.institutionId===args.institutionId&&q.courseId===args.courseId
  &&(!disc||normalized(q.discipline)===disc)
  &&(!search||normalizeSearch([q.question.statement,q.discipline,...(q.indexLabels??[]),...q.question.topicIds,...q.question.competencyIds,...q.question.examTags].join(' ')).includes(search)))
  .sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export function reuseBankQuestion(record:BankQuestion,newId:string,discipline:string):QuestionDraft{
 if(!newId.trim()||newId===record.bankId)throw Error('A questão reutilizada exige novo identificador.');
 if(normalized(discipline)!==normalized(record.discipline))throw Error('Disciplina incompatível com o item do banco.');
 return {...record.question,spreadsheetMetadata:record.question.spreadsheetMetadata?{...record.question.spreadsheetMetadata}:undefined,id:newId,disciplineId:discipline,
  options:record.question.options.map(o=>({...o})),
  topicIds:[...record.question.topicIds],
  competencyIds:[...record.question.competencyIds],
  purpose:[...record.question.purpose],examTags:[...record.question.examTags],images:[]};
}
