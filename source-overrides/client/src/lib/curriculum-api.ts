/**
 * Construção Curricular — leitura, gravação e publicação pela RPC vertice_curriculum_build.
 * As tabelas ficam no schema vertice_app (sem acesso direto pelo navegador); a função valida
 * MFA, papel na IES e vínculo de curso, espelha IES/curso e versiona a matriz.
 */
import {supabase} from '@/lib/supabase';

export type DisciplineCategory='profissional'|'instrumental'|'basica';
export interface CurriculumDiscipline {id?:string;discipline_name:string;category:DisciplineCategory;sort_order:number}
export interface CurriculumCompetency {id?:string;code:string;title:string;description:string;sort_order:number;
 origin_period?:number|null;period_status?:'proposed'|'validated'|null;disciplines:CurriculumDiscipline[]}
export interface CurriculumBuildHeader {id:string;version:number;status:'draft'|'published'|'archived';graduate_profile:string;
 graduate_profile_source:string;dcn_reference:string;dcn_document_url:string;updated_at:string}
export interface CurriculumState {build:CurriculumBuildHeader|null;competencies:CurriculumCompetency[];publishedVersion:number|null;canWrite:boolean}
export interface CurriculumSaveInput {buildId?:string;graduate_profile:string;graduate_profile_source:string;dcn_reference:string;dcn_document_url:string;competencies:CurriculumCompetency[]}

async function call(institutionId:string,courseId:string,action:'get'|'save'|'publish',payload:Record<string,unknown>):Promise<CurriculumState>{
 const {data,error}=await supabase.rpc('vertice_curriculum_build',{p_institution:institutionId,p_course:courseId,p_action:action,p_payload:payload});
 if(error)throw new Error(error.message||'Operação recusada.');
 const d=data as CurriculumState;
 return {...d,competencies:d.competencies??[]};
}
export const loadCurriculum=(i:string,c:string)=>call(i,c,'get',{});
export function saveCurriculum(i:string,c:string,input:CurriculumSaveInput){
 return call(i,c,'save',{
  ...(input.buildId?{buildId:input.buildId}:{}),
  graduate_profile:input.graduate_profile,graduate_profile_source:input.graduate_profile_source,
  dcn_reference:input.dcn_reference,dcn_document_url:input.dcn_document_url,
  competencies:input.competencies.map(comp=>({
   ...(comp.id?{id:comp.id}:{}),code:comp.code.trim(),title:(comp.title||comp.code).trim(),description:comp.description||'',
   origin_period:comp.origin_period??null,period_status:comp.origin_period?(comp.period_status??'proposed'):null,
   disciplines:comp.disciplines.filter(d=>d.discipline_name.trim()).map(d=>({discipline_name:d.discipline_name.trim(),category:d.category})),
  })),
 });
}
export const publishCurriculum=(i:string,c:string,buildId:string)=>call(i,c,'publish',{buildId});
