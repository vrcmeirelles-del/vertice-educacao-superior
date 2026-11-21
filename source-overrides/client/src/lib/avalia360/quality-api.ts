/** Avalia 360° — justiça entre versões e dupla correção (servidor). Estatística em fairness.ts e agreement.ts. */
import {supabase} from '@/lib/supabase';
import type {ResponseMatrix} from './fairness';

export async function loadResponseMatrix(i:string,c:string,applicationId:string):Promise<ResponseMatrix>{
 const {data,error}=await supabase.rpc('vertice_avalia_response_matrix',{p_institution:i,p_course:c,p_application:applicationId});
 if(error)throw new Error(error.message||'Matriz indisponível.');
 const m=data as ResponseMatrix;
 return {...m,sheets:m.sheets.map(s=>({...s,total:Number(s.total),items:Object.fromEntries(Object.entries(s.items||{}).map(([k,v])=>[k,{...v,score:Number(v.score),max:Number(v.max)}]))}))};
}
export interface SampleQuestion {id:string;points:number;statement:string;rubric:string|null;rubricCriteria:Array<{id:string;label:string;points:number}>}
export interface SampleSheet {sheetId:string;code:string;variant:string;mine:boolean;secondScores:Record<string,{score:number;criteria:Record<string,number>|null;byMe:boolean}>|null}
export interface DoubleSample {population:number;size:number;questions:SampleQuestion[];sheets:SampleSheet[]}
async function call<T>(i:string,c:string,action:string,payload:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.rpc('vertice_avalia_double_scoring',{p_institution:i,p_course:c,p_action:action,p_payload:payload});
 if(error)throw new Error(error.message||'Operação recusada.');
 return data as T;
}
export const loadDoubleSample=(i:string,c:string,applicationId:string,share:number,min:number)=>call<DoubleSample>(i,c,'sample',{applicationId,share,min});
export const saveSecondScores=(i:string,c:string,applicationId:string,scores:Array<{sheetId:string;questionId:string;score:number;criteria?:Record<string,number>}>)=>
 call<{saved:number}>(i,c,'save',{applicationId,scores});
export async function loadAgreement(i:string,c:string,applicationId:string){
 const d=await call<{questions:Array<{questionId:string;points:number;statement:string;pairs:Array<[number,number]>}>}>(i,c,'agreement',{applicationId});
 return d.questions.map(q=>({...q,points:Number(q.points),pairs:q.pairs.map(([a,b])=>[Number(a),Number(b)] as [number,number])}));
}
