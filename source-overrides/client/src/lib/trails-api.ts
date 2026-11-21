/**
 * Trilhas de Formação ENADE — leitura e gravação pela RPC vertice_formation_trails.
 * As tabelas ficam em vertice_app (sem acesso pelo navegador). A discrepância e o ranking
 * do instantâneo são calculados no servidor.
 */
import {supabase} from '@/lib/supabase';

export interface TrailRow {id:string;code:string;name:string;description:string|null;curriculum_competency_id:string|null;keywords:string[]}
export interface TrailQuestionRow {id:string;trail_id:string;enade_year:number|null;question_number:number|null;question_text:string|null;
 national_correct_pct:number|null;ies_correct_pct:number|null;discrepancy:number|null;source:string}
export interface TrailDiagnosticRow {institution_id?:string;course_id?:string;trail_id:string;code:string;name:string;question_count:number;
 avg_national_pct:number|null;avg_ies_pct:number|null;total_discrepancy:number|null;avg_discrepancy:number|null;status:string}
export interface TrailState {trails:TrailRow[];questions:TrailQuestionRow[];diagnostic:TrailDiagnosticRow[];imported:number;canWrite:boolean}
export interface InstitutionTrailState {diagnostic:TrailDiagnosticRow[];trails:number;questions:number}

async function rpc<T>(institutionId:string,courseId:string|null,action:string,payload:Record<string,unknown>={}):Promise<T>{
 const {data,error}=await supabase.rpc('vertice_formation_trails',{p_institution:institutionId,p_course:courseId,p_action:action,p_payload:payload});
 if(error)throw new Error(error.message||'Operação recusada.');
 return data as T;
}
export const loadTrails=(i:string,c:string)=>rpc<TrailState>(i,c,'get');
export const saveTrail=(i:string,c:string,t:{id?:string;code:string;name:string;description?:string|null;keywords:string[]})=>
 rpc<TrailState>(i,c,'save_trail',{...(t.id?{id:t.id}:{}),code:t.code.trim(),name:t.name.trim(),description:t.description??'',keywords:t.keywords});
export const deleteTrail=(i:string,c:string,id:string)=>rpc<TrailState>(i,c,'delete_trail',{id});
export const importTrailsFromCurriculum=(i:string,c:string)=>rpc<TrailState>(i,c,'import_curriculum');
export const addTrailQuestion=(i:string,c:string,q:{trail_id:string;enade_year?:string;question_number?:string;question_text?:string;national_correct_pct?:string;ies_correct_pct?:string})=>{
 const v=(s?:string)=>s&&s.trim()?s.trim():undefined;
 return rpc<TrailState>(i,c,'add_question',Object.fromEntries(Object.entries({trail_id:q.trail_id,enade_year:v(q.enade_year),question_number:v(q.question_number),
  question_text:v(q.question_text),national_correct_pct:v(q.national_correct_pct),ies_correct_pct:v(q.ies_correct_pct)}).filter(([,x])=>x!==undefined)));
};
export const deleteTrailQuestion=(i:string,c:string,id:string)=>rpc<TrailState>(i,c,'delete_question',{id});
export const saveTrailSnapshot=(i:string,c:string,summary:string)=>rpc<TrailState>(i,c,'save_snapshot',{summary:summary.slice(0,2000)});
export const loadInstitutionTrails=(i:string)=>rpc<InstitutionTrailState>(i,null,'institution_diagnostic');
