/** Avalia 360° — matrizes de exame, série de notas e publicação do sinal de risco (servidor). */
import {supabase} from '@/lib/supabase';
import type {ExamArea,ExamMatrix} from './readiness';
import type {ScorePoint} from './academic-risk';
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.rpc(name,args);
 if(error)throw Object.assign(new Error(error.message||'Operação recusada.'),{code:error.code});
 return data as T;
}
export const listExamMatrices=(i:string,c:string)=>rpc<ExamMatrix[]>('vertice_avalia_exam_matrix',{p_institution:i,p_course:c,p_action:'list',p_payload:{}});
export const saveExamMatrix=(i:string,c:string,m:{id?:string;exam:string;label:string;edition:string;sourceRef:string;areas:ExamArea[]})=>
 rpc<{id:string;status:string}>('vertice_avalia_exam_matrix',{p_institution:i,p_course:c,p_action:'save',p_payload:m});
export const validateExamMatrix=(i:string,c:string,id:string)=>rpc<{status:string}>('vertice_avalia_exam_matrix',{p_institution:i,p_course:c,p_action:'validate',p_payload:{id}});
export async function loadScoreSeries(i:string,c:string){
 const d=await rpc<Array<{studentId:string;label:string;series:ScorePoint[]}>>('vertice_avalia_score_series',{p_institution:i,p_course:c});
 return d.map(x=>({...x,series:x.series.map(p=>({...p,total:Number(p.total),max:Number(p.max)}))}));
}
export const publishRiskSignals=(i:string,c:string,rulesVersion:string,signals:Array<{studentId:string;level:'alto'|'atencao';reasons:string[]}>)=>
 rpc<{published:number}>('vertice_avalia_risk_publish',{p_institution:i,p_course:c,p_payload:{rulesVersion,signals}});
