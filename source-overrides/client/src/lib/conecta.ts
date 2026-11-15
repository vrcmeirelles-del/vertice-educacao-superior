import {supabase} from './supabase';
export type RecordRow={id:string;[key:string]:any};
export type Detail={longitudinal?:{education_id?:string;history:RecordRow[]};profile:RecordRow;preferences:RecordRow[];evidence:RecordRow[];applications:RecordRow[];opportunities:RecordRow[];internships:RecordRow[];activities:RecordRow[]};
export async function conectaRequest<T=any>(institution:string,action:string,payload:Record<string,unknown>={}):Promise<T>{
 const {data,error}=await supabase.rpc('vertice_conecta',{p_institution:institution,p_action:action,p_payload:payload});
 if(error)throw new Error(error.message||'Consulta indisponível.');return data as T;
}
export const percent=(n:number,d:number)=>d>0?(100*n/d).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'Sem base';
export const indicatorLabels:Record<string,string>={cobertura:'Cobertura das matrículas no Conecta',insercao_respondentes:'Inserção profissional entre respondentes',area_respondentes:'Atuação na área entre respondentes ocupados'};
export function indicatorValue(code:string,m:any){return !m?'Indisponível':code==='cobertura'?percent(m.registry_linked,m.registry_population):code==='insercao_respondentes'?percent(m.employed,m.respondents):percent(m.in_field,m.field_respondents);}
