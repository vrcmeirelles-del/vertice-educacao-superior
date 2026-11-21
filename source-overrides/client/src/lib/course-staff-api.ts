/**
 * Coordenação e NDE por curso — função atribuída pela gestão sobre o vínculo institucional
 * (RPC vertice_course_staff). O papel na instituição (equipe/leitor) não muda.
 */
import {supabase} from '@/lib/supabase';

export type CourseFunction='coordenador'|'nde';
export interface CourseStaffRow {course_id:string;course_name:string;user_id:string;email:string;function:CourseFunction;active:boolean;granted_at:string;revoked_at:string|null}
export interface MyCourseFunction {course_id:string;function:CourseFunction}

export const COURSE_FUNCTION_LABEL:Record<CourseFunction,string>={coordenador:'Coordenação de curso',nde:'NDE'};

async function call<T>(institutionId:string,action:string,payload:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.rpc('vertice_course_staff',{p_institution:institutionId,p_action:action,p_payload:payload});
 if(error)throw new Error(error.message||'Operação recusada.');
 return (data??[]) as T;
}
export const listCourseStaff=(i:string)=>call<CourseStaffRow[]>(i,'list',{});
export const myCourseFunctions=(i:string)=>call<MyCourseFunction[]>(i,'mine',{});
export const grantCourseFunction=(i:string,email:string,courseId:string,fn:CourseFunction)=>
 call<CourseStaffRow[]>(i,'grant',{email:email.trim(),course_id:courseId,function:fn});
export const revokeCourseFunction=(i:string,userId:string,courseId:string,fn:CourseFunction)=>
 call<CourseStaffRow[]>(i,'revoke',{user_id:userId,course_id:courseId,function:fn});

/** Abas acadêmicas liberadas por função no curso, além das do papel institucional. */
export function tabsForCourseFunctions(fns:MyCourseFunction[]):Array<'avalia360'|'construcao-curricular'>{
 return fns.length?['avalia360','construcao-curricular']:[];
}
