/**
 * Avalia 360° — cliente de integração de rascunhos (dependente da futura RPC).
 * O backend define usuário, instituição, disciplina e permissões pela sessão.
 * Dados contendo arquivos File NÃO são serializados em JSON.
 */
import {supabase} from '@/lib/supabase';
import type {QuestionDraft} from './question-draft';
import type {UploadedImageReceipt} from './private-image-upload';
import type {PedagogicalDraft} from './declared-analysis';
import type {CurationDecision} from './curation-decision';

export interface DraftReceipt {
 id:string;revision:number;status:'draft'|'submitted'|'validated'|'archived';
}
export interface DraftApiFailure {code:string;message:string}
export type DraftApiResult={ok:true;receipt:DraftReceipt}|{ok:false;error:DraftApiFailure};
export interface DraftSaveInput {
 institutionId:string;courseId:string;disciplineId:string;
 draftId?:string;expectedRevision?:number;buildId?:string;
 questions:QuestionDraft[];
 uploadedImages?: Record<string, Array<{localId:string;receipt:UploadedImageReceipt}>>;
 assessmentMeta?: {title:string;instructions?:string;semester:string;purpose:'diagnostica'|'formativa'|'somativa';declaredPedagogy?:PedagogicalDraft;curationHistory?:CurationDecision[];curriculumSource?:{buildId:string;version:number;ready:boolean}};
}
function sanitizeQuestion(q:QuestionDraft, uploaded:DraftSaveInput['uploadedImages']) {
 // Os metadados de mídia dependem de upload privado validado e
 // não podem ser fabricados a partir de File ou IDs locais.
 const matched=uploaded?.[q.id]||[];
 if(q.images.length!==matched.length || matched.some(item=>!q.images.some(i=>i.localId===item.localId)))
   throw new Error('IMAGE_UPLOAD_REQUIRED');
 const imageMetadata=q.images.map((image,order)=>{
   const receipt=matched.find(item=>item.localId===image.localId)?.receipt;
   if(!receipt?.imageId || !receipt.path || !receipt.sha256) throw new Error('IMAGE_UPLOAD_REQUIRED');
   return {imageId:receipt.imageId,path:receipt.path,sha256:receipt.sha256,
     mime:receipt.mime,sizeBytes:receipt.sizeBytes,altText:image.altText,
     caption:image.caption,placement:image.placement,
     ...(image.alternativeId?{alternativeId:image.alternativeId}:{}),
     rightsStatus:image.rightsStatus,order};
 });
 return {
  id:q.id,disciplineId:q.disciplineId,kind:q.kind,statement:q.statement,
  options:q.options,correctOptionId:q.correctOptionId,rubric:q.rubric,
  answerJustification:q.kind==='objetiva'?(q.answerJustification||''):undefined,
  answerLines:q.kind==='discursiva'?(q.answerLines??8):undefined,
  expectedAnswer:q.kind==='discursiva'?(q.expectedAnswer||''):undefined,
  topicIds:q.topicIds,competencyIds:q.competencyIds,
  purpose:q.purpose,estimatedDifficulty:q.estimatedDifficulty,
  points:q.points,examTags:q.examTags,
  pendingImageCount:q.images.length,images:imageMetadata
 };
}
export async function saveAssessmentDraft(input:DraftSaveInput):Promise<DraftApiResult> {
 if (!input.institutionId || !input.courseId || !input.disciplineId || !input.questions.length)
  return {ok:false,error:{code:'INVALID_INPUT',message:'Identificação de curso, disciplina e questões obrigatória.'}};
 if (input.questions.some(q=>q.images.length !== (input.uploadedImages?.[q.id]?.length||0)))
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
    ...(input.assessmentMeta?{meta:input.assessmentMeta}:{}),
    questions:input.questions.map(q=>sanitizeQuestion(q,input.uploadedImages))
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

export interface StoredAssessmentDraft {
 id:string;revision:number;status:'draft'|'submitted'|'validated'|'archived';
 snapshot:{questions:Array<Record<string,unknown>>;curriculumStatus?:string;meta?:{title?:string;instructions?:string;semester?:string;purpose?:string;declaredPedagogy?:PedagogicalDraft}};
}
export type DraftReadResult={ok:true;draft:StoredAssessmentDraft}|{ok:false;error:DraftApiFailure};
/** Lê apenas o rascunho pertencente ao usuário autorizado; a RPC protege IES/curso/disciplinas. */
export async function loadAssessmentDraft(args:{
 institutionId:string;courseId:string;disciplineId:string;draftId:string
}):Promise<DraftReadResult>{
 if(!args.institutionId||!args.courseId||!args.disciplineId||!args.draftId)
  return {ok:false,error:{code:'INVALID_INPUT',message:'Dados da consulta incompletos.'}};
 try{
  const {data,error}=await supabase.rpc('vertice_avalia_draft',{
   p_institution:args.institutionId,p_course:args.courseId,
   p_discipline:args.disciplineId,p_action:'get',p_payload:{id:args.draftId}
  });
  if(error)return {ok:false,error:{code:error.code||'READ_FAILED',message:error.message}};
  if(!data||typeof data!=='object'||!('snapshot' in data)||!('id' in data)||
     !('revision' in data))
   return {ok:false,error:{code:'INVALID_RECEIPT',message:'Rascunho não confirmado pelo servidor.'}};
  const draft=data as StoredAssessmentDraft;
  if(!draft.snapshot||!Array.isArray(draft.snapshot.questions))
   return {ok:false,error:{code:'INVALID_SNAPSHOT',message:'Snapshot incompleto.'}};
  return {ok:true,draft};
 }catch(e){
  return {ok:false,error:{code:'NETWORK_ERROR',message:e instanceof Error?e.message:'Falha de rede.'}};
 }
}
