/**
 * Banco de Questões institucional (Supabase). A RPC exige AAL2 e vínculo de curso,
 * define autoria e data no servidor e não aceita questões com imagem.
 */
import {supabase} from '@/lib/supabase';
import {filterBankQuestions,prepareBankQuestion,type BankQuestion} from './question-bank';

export async function listInstitutionalBank(institutionId:string,courseId:string,discipline:string,query=''):Promise<BankQuestion[]>{
 const {data,error}=await supabase.rpc('vertice_avalia_bank',{
  p_institution:institutionId,p_course:courseId,p_discipline:discipline,p_action:'list',p_payload:{}
 });
 if(error)throw Error(error.message||'Banco de Questões indisponível ou sem autorização.');
 if(!Array.isArray(data))throw Error('Resposta inválida do Banco de Questões.');
 return filterBankQuestions(data as BankQuestion[],{institutionId,courseId,discipline,query});
}
export async function saveInstitutionalBank(input:Parameters<typeof prepareBankQuestion>[0]):Promise<BankQuestion>{
 const item=prepareBankQuestion(input);
 const {data,error}=await supabase.rpc('vertice_avalia_bank',{
  p_institution:input.institutionId,p_course:input.courseId,p_discipline:input.discipline,p_action:'save',
  p_payload:{record:{bankId:item.bankId,indexLabels:item.indexLabels??[],competencies:item.competencies??[],question:item.question}}
 });
 if(error)throw Error(error.message||'Não foi possível gravar no Banco de Questões.');
 if(!data||typeof data!=='object'||(data as BankQuestion).bankId!==item.bankId)throw Error('Servidor não confirmou o registro.');
 return data as BankQuestion;
}
