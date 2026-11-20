/**
 * Motor determinístico de variantes para provas do Avalia 360°.
 * NÃO altera a questão mestre; mantém mapeamentos para geração de gabarito por versão.
 * Não usa modelos externos. Sem registro de QR no backend nesta demonstração.
 */
import type {QuestionDraft} from './question-draft';
export type ShuffleMode='questoes'|'alternativas'|'ambos';
export interface VariantOption {sourceOptionId:string;label:string;text:string;}
export interface VariantItem {
 sourceId:string;displayNumber:number;question:QuestionDraft;
 options:VariantOption[];correctLabel:string|null;
}
export interface ExamVariant {code:string;index:number;items:VariantItem[];}
const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function shuffleIndices(length:number,seed:number):number[]{
 const arr=Array.from({length},(_,i)=>i);
 let state=(seed||1)>>>0;
 for(let i=length-1;i>0;i--){
  state^=state<<13;state^=state>>>17;state^=state<<5;state>>>=0;
  const j=state%(i+1);[arr[i],arr[j]]=[arr[j],arr[i]];
 }
 return arr;
}
const hash=(value:string)=>{let h=2166136261;for(const c of value){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0};
const rotate=<T,>(arr:T[],by:number):T[]=>arr.length?arr.slice(by%arr.length).concat(arr.slice(0,by%arr.length)):[];
/** Uma assinatura diferente por versão: sem versões repetidas sob o mesmo modo. */
export function maxDistinctVariants(questions:QuestionDraft[],mode:ShuffleMode):number{
 let count=1;
 const multiply=(n:number)=>{for(let i=2;i<=n;i++){count*=i;if(count>=12)return;}};
 if(mode!=='alternativas')multiply(questions.length);
 if(mode!=='questoes')for(const q of questions.filter(q=>q.kind==='objetiva'))multiply(q.options.length);
 return Math.min(count,12);
}
export function createExamVariants(questions:QuestionDraft[],count:number,mode:ShuffleMode='ambos'):ExamVariant[]{
 if(!Number.isInteger(count)||count<1||count>12)throw Error('Quantidade de versões deve estar entre 1 e 12.');
 if(!['questoes','alternativas','ambos'].includes(mode))throw Error('Modo de randomização inválido.');
 const available=maxDistinctVariants(questions,mode);
 if(count>available)throw Error('Esta avaliação permite no máximo '+available+' versão(ões) diferentes com o modo de randomização selecionado.');
 const seen=new Set<string>();
 const shuffleQuestions=count>1&&mode!=='alternativas',shuffleOptions=count>1&&mode!=='questoes';
 return Array.from({length:count},(_,v)=>{
  for(let attempt=0;attempt<2000;attempt++){
   const order=shuffleQuestions?
    shuffleIndices(questions.length,hash(questions.map(x=>x.id).join('|')+'|questoes|'+v+'|'+attempt)):
    questions.map((_,i)=>i);
   const items=order.map((qi,i)=>{
    const q=questions[qi];
    if(q.kind!=='objetiva')return {sourceId:q.id,displayNumber:i+1,question:q,options:[],correctLabel:null};
    const indices=shuffleOptions?
     shuffleIndices(q.options.length,hash(q.id+'|alternativas|'+v+'|'+attempt)):
     q.options.map((_,j)=>j);
    const options=indices.map((idx,j)=>({sourceOptionId:q.options[idx].id,label:letters[j],text:q.options[idx].text}));
    const correctLabel=options.find(o=>o.sourceOptionId===q.correctOptionId)?.label??null;
    return {sourceId:q.id,displayNumber:i+1,question:q,options,correctLabel};
   });
   const signature=JSON.stringify(items.map(i=>[i.sourceId,...i.options.map(o=>o.sourceOptionId)]));
   if(!seen.has(signature)){
    seen.add(signature);
    return {code:letters[v],index:v,items};
   }
  }
  throw Error('Não foi possível criar versões distintas com os parâmetros escolhidos.');
 });
}
export function teacherAnswerRows(variants:ExamVariant[]){
 return variants.flatMap(v=>v.items.filter(i=>i.question.kind==='objetiva').map(i=>({
  version:v.code,question:i.displayNumber,correct:i.correctLabel??'',
  sourceId:i.sourceId,justification:i.question.answerJustification??''
 })));
}
export function versioningNotice(questions:QuestionDraft[],count:number,mode:ShuffleMode):string|null{
 if(count<2)return null;
 if(mode==='questoes'&&questions.length<2)return 'Há apenas uma questão. Para criar versões diferentes, ative também a randomização das alternativas.';
 if(mode==='alternativas'&&!questions.some(q=>q.kind==='objetiva'&&q.options.length>1))
  return 'Sem questões objetivas, não há alternativas para randomizar.';
 if(mode==='ambos'&&questions.length<2&&!questions.some(q=>q.kind==='objetiva'&&q.options.length>1))
  return 'A avaliação possui apenas uma discursiva. Não é possível produzir variantes substantivamente diferentes por permutação.';
 const max=maxDistinctVariants(questions,mode);
 if(count>max)return 'Com estas questões e o modo escolhido, há somente '+max+' versão(ões) distintas. Reduza a quantidade ou adicione questões/alternativas.';
 return null;
}
