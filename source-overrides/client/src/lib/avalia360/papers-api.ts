/**
 * Avalia 360° — cadernos emitidos com QR registrado (RPC vertice_avalia_papers).
 * O token do QR só é devolvido na emissão; o banco guarda o hash. Ao salvar pelo caderno,
 * aluno e versão vêm do servidor, e a correção é a mesma das folhas da aplicação.
 */
import {supabase} from '@/lib/supabase';
import type {ItemScore} from './application-api';

export interface IssuedPaper {
 paperId:string;applicationId:string;shortCode:string;variant:string;studentId:string|null;label:string;enrollment:string|null;
 status:'issued'|'voided';issuedAt:string;sheetId:string|null;
 sheet:{total:number;max:number;updatedAt:string;items:ItemScore[]|null}|null;
 applicationStatus?:'open'|'closed';
}
export interface IssuedPaperWithToken extends IssuedPaper {token:string;qr:string}

async function call<T>(i:string,c:string,action:string,payload:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.rpc('vertice_avalia_papers',{p_institution:i,p_course:c,p_action:action,p_payload:payload});
 if(error)throw Object.assign(new Error(error.message||'Operação recusada.'),{code:error.code||'PAPERS_FAILED'});
 return data as T;
}
export const issuePapers=(i:string,c:string,applicationId:string,papers:Array<{studentId?:string;label?:string;variant:string}>)=>
 call<IssuedPaperWithToken[]>(i,c,'issue',{applicationId,papers});
export const listPapers=(i:string,c:string,applicationId:string)=>call<IssuedPaper[]>(i,c,'list',{applicationId});
export const scanPaper=(i:string,c:string,code:string,applicationId?:string)=>
 call<IssuedPaper>(i,c,'scan',{code,...(applicationId?{applicationId}:{})});
export const savePaperSheet=(i:string,c:string,paperId:string,objective:Record<string,string>,discursive:Record<string,number>)=>
 call<IssuedPaper>(i,c,'save',{paperId,objective,discursive});
export const voidPaper=(i:string,c:string,paperId:string)=>call<IssuedPaper>(i,c,'void',{paperId});

/** Normaliza o que veio do leitor (QR completo, token ou código curto digitado). */
export function normalizeScannedCode(raw:string):string{
 const v=raw.trim().replace(/\s+/g,'').toUpperCase();
 return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(v)?v.replace('-',''):v;
}
/** Distribuição alternada das versões, na ordem da lista (A, B, C, …). */
export function assignVariants<T>(items:T[],variantCodes:string[]):Array<T&{variant:string}>{
 if(!variantCodes.length)throw Error('Aplicação sem versões.');
 return items.map((it,i)=>({...it,variant:variantCodes[i%variantCodes.length]}));
}
