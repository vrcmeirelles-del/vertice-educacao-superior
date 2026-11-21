/** Avalia 360° — análise de itens e calibração do banco (cálculo no servidor). */
import {supabase} from '@/lib/supabase';
import type {AnalysisResult} from './item-analysis-rules';

export interface BankCalibration {applications:number;n:number;p:number|null;discrimination:number|null}
export async function loadItemAnalysis(institutionId:string,courseId:string,applicationId:string):Promise<AnalysisResult>{
 const {data,error}=await supabase.rpc('vertice_avalia_item_analysis',{p_institution:institutionId,p_course:courseId,p_application:applicationId});
 if(error)throw new Error(error.message||'Análise indisponível.');
 return data as AnalysisResult;
}
export async function loadBankCalibration(institutionId:string,courseId:string,discipline:string):Promise<Record<string,BankCalibration>>{
 const {data,error}=await supabase.rpc('vertice_avalia_bank_calibration',{p_institution:institutionId,p_course:courseId,p_discipline:discipline});
 if(error)throw new Error(error.message||'Calibração indisponível.');
 return (data||{}) as Record<string,BankCalibration>;
}

export interface BankExposure {lastAppliedOn:string;applications:number}
/** Última aplicação de cada item do banco na disciplina (opcionalmente só na turma informada). */
export async function loadBankExposure(institutionId:string,courseId:string,discipline:string,classLabel:string):Promise<Record<string,BankExposure>>{
 const {data,error}=await supabase.rpc('vertice_avalia_bank_exposure',{p_institution:institutionId,p_course:courseId,p_discipline:discipline,p_class:classLabel});
 if(error)throw new Error(error.message||'Exposição indisponível.');
 return (data||{}) as Record<string,BankExposure>;
}
