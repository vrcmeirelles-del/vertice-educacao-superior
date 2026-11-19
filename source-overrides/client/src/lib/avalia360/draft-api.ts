/**
 * Avalia 360° — cliente de integração de rascunhos (dependente da futura RPC).
 * O backend define usuário, instituição, disciplina e permissões pela sessão.
 * Dados contendo arquivos File NÃO são serializados em JSON.
 */
import {supabase} from '@/lib/supabase';
import type {QuestionDraft} from './question-draft';

export interface DraftReceipt {
 id:string;revision:number;status:'draft'|'submitted'|'validated'|'archived';
}
export interface DraftApiFailure {code:string;message:string}
export type DraftApiResult={ok:true;receipt:DraftReceipt}|{ok:false;error:DraftApiFailure};
export interface DraftSaveInput {
 institutionId:string;courseId:string;disciplineId:string;
 draftId?:string;expectedRevision?:number;buildId?:string;
 questions:QuestionDraft[];
}
function sanitizeQuestion(q:QuestionDraft) {
 // Os metadados de mídia dependem de upload privado validado e
 // não podem ser fabricados a partir de File ou IDs locais.
 return {
  id:q.id,disciplineId:q.disciplineId,kind:q.kind,statement:q.statement,
  options:q.options,correctOptionId:q.correctOptionId,rubric:q.rubric,
  topicIds:q.topicIds,competencyIds:q.competencyIds,
  purpose:q.purpose,estimatedDifficulty:q.estimatedDifficulty,
  points:q.points,examTags:q.examTags,
  pendingImageCount:q.images.length
 };
}
export async function saveAssessmentDraft(input:DraftSaveInput):Promise<DraftApiResult> {
 if (!input.institutionId || !input.courseId || !input.disciplineId || !input.questions.length)
  return {ok:false,error:{code:'INVALID_INPUT',message:'Identificação de curso, disciplina e questões obrigatória.'}};
 if (input.questions.some(q=>q.images.length>0))
  return {ok:false,error:{code:'IMAGE_UPLOAD_REQUIRED',message:'Conclua o upload privado das imagens antes de salvar o rascunho.'}};
 if (input.expectedRevision!==undefined && (!Number.isInteger(input.expectedRevision)||input.expectedRevision<1))
  return {ok:false,error:{code:'INVALID_REVISION',message:'Versão de rascunho inválida.'}};
 try {
  // A RPC deverá exigir JWT/MFA AAL2, autoria e vínculo de curso por RLS/SQL.
  const {data,error}=await supabase.rpc('vertice_avalia_draft', {
   p_institution:input.institutionId,
   p_course:input.courseId,
   p_discipline:input.disciplineId,
   p_action:input.draftId?'update':'create',
   p_payload:{
    ...(input.draftId?{id:input.draftId}:{}),
    ...(input.expectedRevision?{expectedRevision:input.expectedRevision}:{}),
    ...(input.buildId?{buildId:input.buildId}:{}),
    questions:input.questions.map(sanitizeQuestion)
   }
  });
  if(error) return {ok:false,error:{code:error.code||'PERSISTENCE_ERROR',message:error.message}};
  if(!data || typeof data!=='object'|| !('id' in data) || !('revision' in data))
   return {ok:false,error:{code:'INVALID_RECEIPT',message:'Servidor não confirmou o salvamento.'}};
  const receipt=data as DraftReceipt;
  return {ok:true,receipt};
 } catch (err) {
  return {ok:false,error:{code:'NETWORK_ERROR',message:err instanceof Error?err.message:'Erro de conexão.'}};
 }
}
