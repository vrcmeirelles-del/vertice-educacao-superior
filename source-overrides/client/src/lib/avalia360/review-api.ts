/**
 * Avalia 360° — validação pelo colegiado. A RPC impõe AAL2, papéis, segregação
 * (autor não valida) e repete os bloqueios estruturais do checklist.
 */
import {supabase} from '@/lib/supabase';
import type {DraftReceipt} from './draft-api';
import type {ChecklistResult,ReturnReason} from './item-checklist';

export interface QueueItem {id:string;revision:number;title:string;discipline:string;semester:string;questionCount:number;mine:boolean;submittedAt:string|null}
export interface ReviewEvent {action:'submitted'|'validated'|'returned';revision:number;justification:string|null;reasons:ReturnReason[];byAuthor:boolean;createdAt:string}
export interface ReviewIndicators {
 drafts:number;inDraft:number;awaiting:number;validated:number;validatedQuestions:number;
 decisions:number;returns:number;avgReviewHours:number|null;returnReasons:Partial<Record<ReturnReason,number>>;
}
export class ReviewError extends Error{constructor(message:string,public code:string){super(message);}}
async function call<T>(institutionId:string,courseId:string,action:string,payload:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.rpc('vertice_avalia_review',{p_institution:institutionId,p_course:courseId,p_action:action,p_payload:payload});
 if(error)throw new ReviewError(error.message||'Operação recusada.',error.code||'REVIEW_FAILED');
 return data as T;
}
export const listReviewQueue=(i:string,c:string)=>call<QueueItem[]>(i,c,'queue',{});
export const loadReviewIndicators=(i:string,c:string)=>call<ReviewIndicators>(i,c,'indicators',{});
export const loadReviewHistory=(i:string,c:string,id:string)=>call<ReviewEvent[]>(i,c,'history',{id});
/** Resumo do checklist anexado ao envio: só códigos e contagens, sem conteúdo da prova. */
export function checklistSummary(r:ChecklistResult){
 return {rulesVersion:'2026.11-1',blocking:r.blocking,warnings:r.warnings,answerKey:r.answerKey,
  codes:r.issues.map(i=>({code:i.code,severity:i.severity,...(i.questionIndex!==undefined?{question:i.questionIndex+1}:{})}))};
}
export const submitForReview=(i:string,c:string,receipt:DraftReceipt,checklist:ChecklistResult)=>
 call<DraftReceipt>(i,c,'submit',{id:receipt.id,expectedRevision:receipt.revision,checklist:checklistSummary(checklist)});
export const decideReview=(i:string,c:string,args:{id:string;revision:number;decision:'validate'|'return';justification:string;reasons:ReturnReason[]})=>
 call<DraftReceipt>(i,c,args.decision,{id:args.id,expectedRevision:args.revision,justification:args.justification,reasons:args.reasons});
