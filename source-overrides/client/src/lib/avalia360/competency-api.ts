/** Avalia 360° — evidência por competência (servidor). O diagnóstico é calculado em competency-mastery.ts. */
import {supabase} from '@/lib/supabase';
import type {CompetencyEvidence} from './competency-mastery';
export type EvidenceScope={applicationId:string}|{discipline:string}|{studentId:string};
export async function loadCompetencyEvidence(institutionId:string,courseId:string,scope:EvidenceScope):Promise<CompetencyEvidence>{
 const {data,error}=await supabase.rpc('vertice_avalia_competency_evidence',{p_institution:institutionId,p_course:courseId,p_payload:scope});
 if(error)throw new Error(error.message||'Diagnóstico indisponível.');
 const d=data as CompetencyEvidence;
 return {...d,rows:d.rows.map(r=>({...r,score:Number(r.score),max:Number(r.max),items:Number(r.items)}))};
}
