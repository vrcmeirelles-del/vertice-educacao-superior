/** Avalia 360° — mapa de erros e planos de recuperação (servidor). Cálculos em error-map.ts e recovery.ts. */
import {supabase} from '@/lib/supabase';
import type {ErrorEvidence} from './error-map';
import type {LogEntry,PlannedItem} from './recovery';

export async function loadErrorEvidence(i:string,c:string,scope:{applicationId:string}|{discipline:string}):Promise<ErrorEvidence>{
 const {data,error}=await supabase.rpc('vertice_avalia_error_evidence',{p_institution:i,p_course:c,p_payload:scope});
 if(error)throw new Error(error.message||'Mapa de erros indisponível.');
 return data as ErrorEvidence;
}
export interface StoredPlan {id:string;studentId:string;label:string;discipline:string;startOn:string;competencies:string[];
 items:Array<{bankId:string;competency:string;statement:string|null}>;log:Array<LogEntry&{at?:string}>;status:'active'|'closed';rulesVersion:string;createdAt:string}
async function call<T>(i:string,c:string,action:string,payload:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.rpc('vertice_avalia_recovery',{p_institution:i,p_course:c,p_action:action,p_payload:payload});
 if(error)throw new Error(error.message||'Operação recusada.');
 return data as T;
}
export const createRecoveryPlans=(i:string,c:string,discipline:string,plans:Array<{studentId:string;startOn:string;rulesVersion:string;competencies:string[];items:PlannedItem[]}>)=>
 call<{created:number}>(i,c,'create',{discipline,plans:plans.map(p=>({...p,items:p.items.map(x=>({bankId:x.bankId,competency:x.competency}))}))});
export const listRecoveryPlans=(i:string,c:string,discipline:string)=>call<StoredPlan[]>(i,c,'list',{discipline});
export const recordReview=(i:string,c:string,id:string,entry:LogEntry)=>call<{entries:number}>(i,c,'record',{id,entry});
export const closeRecoveryPlan=(i:string,c:string,id:string)=>call<{status:string}>(i,c,'close',{id});
