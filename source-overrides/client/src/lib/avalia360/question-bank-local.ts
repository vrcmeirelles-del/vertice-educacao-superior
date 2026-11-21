import {filterBankQuestions,prepareBankQuestion,type BankQuestion} from './question-bank';
/** Apenas demonstração. Para uso institucional será necessária RPC com Auth/MFA/RLS. */
const key=(institutionId:string,courseId:string)=>'avalia360-demo-question-bank:v1:'+institutionId+':'+courseId;
function getAll(institutionId:string,courseId:string):BankQuestion[]{
 if(typeof localStorage==='undefined')throw Error('O armazenamento local não está disponível.');
 try{
  const raw=localStorage.getItem(key(institutionId,courseId));
  if(!raw)return [];
  const data=JSON.parse(raw);
  if(!Array.isArray(data))throw Error('Formato de banco local inválido.');
  return data.filter((x):x is BankQuestion=>
   Boolean(x&&typeof x.bankId==='string'&&x.institutionId===institutionId
    &&x.courseId===courseId&&x.question&&typeof x.question.statement==='string'
    &&Array.isArray(x.question.images)&&x.question.images.length===0));
 }catch(e){
  if(e instanceof SyntaxError)throw Error('Banco local ilegível. Nenhuma questão foi sobrescrita.');
  throw e;
 }
}
export function listLocalBank(institutionId:string,courseId:string,discipline:string,query=''){
 return filterBankQuestions(getAll(institutionId,courseId),{institutionId,courseId,discipline,query});
}
export function saveLocalBank(input:Parameters<typeof prepareBankQuestion>[0]):BankQuestion{
 const item=prepareBankQuestion(input);
 const rows=getAll(input.institutionId,input.courseId);
 if(rows.some(q=>q.bankId===item.bankId))throw Error('Identificador já utilizado no Banco de Questões.');
 try{localStorage.setItem(key(input.institutionId,input.courseId),JSON.stringify([...rows,item]));}
 catch{throw Error('Não foi possível gravar o Banco de Questões neste navegador.');}
 return item;
}
