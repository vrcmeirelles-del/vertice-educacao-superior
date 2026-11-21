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
 assessmentMeta?: {title:string;teacherName?:string;instructions?:string;semester:string;purpose:'diagnostica'|'formativa'|'somativa';declaredPedagogy?:PedagogicalDraft;curationHistory?:CurationDecision[];curriculumSource?:{buildId:string;version:number;ready:boolean}};
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
  ...(q.spreadsheetMetadata?{spreadsheetMetadata:q.spreadsheetMetadata}:{}),
  ...(q.sourceBankId?{sourceBankId:q.sourceBankId}:{}),
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
 snapshot:{questions:Array<Record<string,unknown>>;curriculumStatus?:string;meta?:{title?:string;teacherName?:string;instructions?:string;semester?:string;purpose?:string;declaredPedagogy?:PedagogicalDraft;curationHistory?:CurationDecision[];curriculumSource?:{buildId:string;version:number;ready:boolean}}};
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

export interface DraftSummary {
 id:string;revision:number;status:StoredAssessmentDraft['status'];title:string;semester:string;questionCount:number;updatedAt:string;
}
/** Lista os cadernos da disciplina: os do próprio docente; a coordenação vê todos do curso. */
export async function listAssessmentDrafts(args:{institutionId:string;courseId:string;disciplineId:string}):
 Promise<{ok:true;drafts:DraftSummary[]}|{ok:false;error:DraftApiFailure}>{
 if(!args.institutionId||!args.courseId||!args.disciplineId.trim())
  return {ok:false,error:{code:'INVALID_INPUT',message:'Selecione curso e disciplina.'}};
 try{
  const {data,error}=await supabase.rpc('vertice_avalia_draft',{
   p_institution:args.institutionId,p_course:args.courseId,p_discipline:args.disciplineId,p_action:'list',p_payload:{}
  });
  if(error)return {ok:false,error:{code:error.code||'READ_FAILED',message:error.message}};
  if(!Array.isArray(data))return {ok:false,error:{code:'INVALID_RECEIPT',message:'Lista não confirmada pelo servidor.'}};
  return {ok:true,drafts:data as DraftSummary[]};
 }catch(e){
  return {ok:false,error:{code:'NETWORK_ERROR',message:e instanceof Error?e.message:'Falha de rede.'}};
 }
}

const strings=(v:unknown)=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'):[];
export const snapshotHasImages=(snapshot:StoredAssessmentDraft['snapshot'])=>
 snapshot.questions.some(q=>Array.isArray(q.images)&&q.images.length>0);
type Placement=QuestionDraft['images'][number]['placement'];
type Rights=QuestionDraft['images'][number]['rightsStatus'];
/**
 * Reconstrói as questões editáveis de um snapshot salvo. As imagens são
 * religadas aos arquivos recuperados do armazenamento privado (`restored`,
 * por imageId), preservando o comprovante para não reenviar o arquivo.
 * Se faltar alguma imagem, retorna null e o caderno fica em modo de consulta.
 */
export function editableQuestionsFromSnapshot(snapshot:StoredAssessmentDraft['snapshot'],
 restored?:Map<string,{file:File;receipt:UploadedImageReceipt;questionId:string}>,
 newLocalId:()=>string=()=>crypto.randomUUID()):
 {questions:QuestionDraft[];receipts:Array<{localId:string;file:File;receipt:UploadedImageReceipt;questionId:string}>}|null{
 const out:QuestionDraft[]=[];
 const receipts:Array<{localId:string;file:File;receipt:UploadedImageReceipt;questionId:string}>=[];
 for(const raw of snapshot.questions){
  const images:QuestionDraft['images']=[];
  if(Array.isArray(raw.images)){
   const sorted=[...(raw.images as Array<Record<string,unknown>>)].sort((a,b)=>Number(a.order??0)-Number(b.order??0));
   for(const im of sorted){
    const found=typeof im.imageId==='string'?restored?.get(im.imageId):undefined;
    if(!found||found.questionId!==raw.id)return null;
    const localId=newLocalId();
    const placement=(['enunciado','alternativa','apoio'].includes(String(im.placement))?im.placement:'enunciado') as Placement;
    images.push({localId,file:found.file,altText:typeof im.altText==='string'?im.altText:'',
     caption:typeof im.caption==='string'?im.caption:'',placement,
     ...(placement==='alternativa'&&typeof im.alternativeId==='string'?{alternativeId:im.alternativeId}:{}),
     rightsStatus:(['autoral','licenciado','uso_autorizado'].includes(String(im.rightsStatus))?im.rightsStatus:'nao_informado') as Rights});
    receipts.push({localId,file:found.file,receipt:found.receipt,questionId:raw.id as string});
   }
  }
  if(typeof raw.id!=='string'||typeof raw.statement!=='string'||(raw.kind!=='objetiva'&&raw.kind!=='discursiva'))return null;
  const options=Array.isArray(raw.options)?(raw.options as Array<{id?:unknown;text?:unknown}>)
   .filter(o=>typeof o.id==='string'&&typeof o.text==='string').map(o=>({id:o.id as string,text:o.text as string})):[];
  out.push({
   id:raw.id,disciplineId:typeof raw.disciplineId==='string'?raw.disciplineId:'',kind:raw.kind,statement:raw.statement,
   options,correctOptionId:typeof raw.correctOptionId==='string'?raw.correctOptionId:'',
   answerJustification:typeof raw.answerJustification==='string'?raw.answerJustification:'',
   rubric:typeof raw.rubric==='string'?raw.rubric:'',
   answerLines:typeof raw.answerLines==='number'?raw.answerLines:8,
   expectedAnswer:typeof raw.expectedAnswer==='string'?raw.expectedAnswer:'',
   topicIds:strings(raw.topicIds),competencyIds:strings(raw.competencyIds),
   purpose:strings(raw.purpose) as QuestionDraft['purpose'],
   estimatedDifficulty:(typeof raw.estimatedDifficulty==='number'?raw.estimatedDifficulty:3) as QuestionDraft['estimatedDifficulty'],
   points:typeof raw.points==='number'?raw.points:1,examTags:strings(raw.examTags),images,
   ...(typeof raw.sourceBankId==='string'&&raw.sourceBankId?{sourceBankId:raw.sourceBankId}:{}),
   ...(raw.spreadsheetMetadata&&typeof raw.spreadsheetMetadata==='object'?{spreadsheetMetadata:raw.spreadsheetMetadata as QuestionDraft['spreadsheetMetadata']}:{})
  });
 }
 return {questions:out,receipts};
}
