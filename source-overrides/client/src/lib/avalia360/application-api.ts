/** Avalia 360° — aplicações e folhas de resposta. Correção e notas são calculadas no servidor. */
import {supabase} from '@/lib/supabase';
import type {VariantMap} from './answer-entry';

export interface ApplicationSummary {id:string;draftId:string;revision:number;title:string;discipline:string;classLabel:string;appliedOn:string;variantCount:number;status:'open'|'closed';sheets:number;
 /** Autor, quem criou a aplicação ou coordenação. Ausente em respostas antigas = true. */
 canManage?:boolean}
export interface ItemScore {q:string;n:number;kind:'objetiva'|'discursiva';mark:string|null;outcome:'correct'|'wrong'|'blank'|'multiple'|'scored'|'pending';score:number|null;max:number}
export interface SheetResult {id:string;studentId:string|null;label:string;enrollment:string|null;variant:string;total:number;max:number;updatedAt:string;items:ItemScore[]|null}
export interface ApplicationDetail {
 id:string;draftId:string;revision:number;title:string;discipline:string;classLabel:string;appliedOn:string;
 variantCount:number;variantMap:VariantMap;status:'open'|'closed';canManage?:boolean;
 questions:Array<{id:string;kind:'objetiva'|'discursiva';points:number;statement:string}>;sheets:SheetResult[];
}
export interface SheetInput {studentId?:string;label?:string;variant:string;objective:Record<string,string>;discursive:Record<string,number>}

async function call<T>(i:string,c:string,action:string,payload:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.rpc('vertice_avalia_application',{p_institution:i,p_course:c,p_action:action,p_payload:payload});
 if(error)throw Object.assign(new Error(error.message||'Operação recusada.'),{code:error.code||'APPLICATION_FAILED'});
 return data as T;
}
export const listApplications=(i:string,c:string,draftId?:string)=>call<ApplicationSummary[]>(i,c,'list',draftId?{draftId}:{});
export const getApplication=(i:string,c:string,id:string)=>call<ApplicationDetail>(i,c,'get',{id});
export const createApplication=(i:string,c:string,args:{draftId:string;revision:number;classLabel:string;appliedOn:string;variantCount:number;variantMap:VariantMap})=>
 call<{id:string;status:string}>(i,c,'create',{draftId:args.draftId,expectedRevision:args.revision,classLabel:args.classLabel,
  appliedOn:args.appliedOn,variantCount:args.variantCount,variantMap:args.variantMap});
/** Envia em lotes de até 400 folhas (limite do servidor). */
export async function saveSheets(i:string,c:string,id:string,sheets:SheetInput[]):Promise<number>{
 let saved=0;
 for(let k=0;k<sheets.length;k+=400){
  const out=await call<{saved:number}>(i,c,'save_sheets',{id,sheets:sheets.slice(k,k+400)});
  saved+=out.saved;
 }
 return saved;
}
export const deleteSheet=(i:string,c:string,id:string,sheetId:string)=>call<{deleted:number}>(i,c,'delete_sheet',{id,sheetId});
export const closeApplication=(i:string,c:string,id:string)=>call<{status:string}>(i,c,'close',{id});
