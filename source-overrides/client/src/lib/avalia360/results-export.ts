/**
 * Avalia 360° — planilha de resultados da aplicação (.xlsx), a partir do que o SERVIDOR corrigiu.
 * Nada é recalculado como nota: acerto, erro e pontos vêm de vertice_avalia_application 'get'.
 * As questões aparecem na numeração do caderno original (não da versão impressa), para comparar alunos
 * de versões diferentes; a letra marcada é a da versão do aluno.
 */
import type {ApplicationDetail,ItemScore} from './application-api';
import {buildXlsx,type XlsxCell} from './xlsx';

const OUT:Record<ItemScore['outcome'],string>={correct:'Certo',wrong:'Errado',blank:'Em branco',multiple:'Dupla marcação',scored:'Corrigida',pending:'Pendente'};
const round2=(n:number)=>Math.round(n*100)/100;
const pct=(a:number,b:number):XlsxCell=>b>0?{percent:Math.round(a/b*10000)/10000}:null;

export function resultsWorkbook(d:ApplicationDetail,generatedAt=new Date()):Uint8Array{
 const qs=d.questions.map((q,i)=>({...q,n:i+1}));
 const scored=d.sheets.filter(s=>s.items);
 const itemOf=(s:ApplicationDetail['sheets'][number],qid:string)=>s.items?.find(i=>i.q===qid);
 const sorted=[...scored].sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));

 const resumo:XlsxCell[][]=[['Aluno','Matrícula','Versão','Nota','Máximo','Percentual','Acertos (objetivas)','Erros','Em branco','Dupla marcação','Discursivas pendentes']];
 for(const s of sorted){
  const items=s.items||[];const c=(o:ItemScore['outcome'])=>items.filter(i=>i.outcome===o).length;
  resumo.push([s.label,s.enrollment??'',s.variant,round2(Number(s.total)),round2(Number(s.max)),pct(Number(s.total),Number(s.max)),
   c('correct'),c('wrong'),c('blank'),c('multiple'),c('pending')]);
 }

 const porQuestao:XlsxCell[][]=[['Aluno','Versão',...qs.map(q=>'Q'+q.n+(q.kind==='discursiva'?' (disc.)':''))]];
 for(const s of sorted){
  porQuestao.push([s.label,s.variant,...qs.map(q=>{
   const it=itemOf(s,q.id);if(!it)return '';
   if(q.kind==='discursiva')return it.score===null?'Pendente':String(round2(Number(it.score))).replace('.',',')+' de '+String(it.max).replace('.',',');
   return OUT[it.outcome]+(it.mark?' ('+it.mark+', nº '+it.n+' na versão '+s.variant+')':'');
  })]);
 }

 const acerto:XlsxCell[][]=[['Questão (caderno)','Tipo','Enunciado','Valor','Respondentes','Acertos','% de acerto','Erros','Em branco','Dupla marcação','Média de pontos','% da nota']];
 for(const q of qs){
  const its=sorted.map(s=>itemOf(s,q.id)).filter((x):x is ItemScore=>Boolean(x));
  const k=(o:ItemScore['outcome'])=>its.filter(i=>i.outcome===o).length;
  const graded=q.kind==='discursiva'?its.filter(i=>i.score!==null):its;
  const meanPts=graded.length?graded.reduce((a,i)=>a+Number(i.score??0),0)/graded.length:null;
  acerto.push(['Q'+q.n,q.kind==='objetiva'?'Objetiva':'Discursiva',q.statement,round2(q.points),graded.length,
   q.kind==='objetiva'?k('correct'):null,q.kind==='objetiva'?pct(k('correct'),its.length):null,
   q.kind==='objetiva'?k('wrong'):null,q.kind==='objetiva'?k('blank'):null,q.kind==='objetiva'?k('multiple'):null,
   meanPts===null?null:round2(meanPts),meanPts===null?null:pct(meanPts,q.points)]);
 }

 const media=scored.length?scored.reduce((a,s)=>a+Number(s.total),0)/scored.length:null;
 const info:XlsxCell[][]=[['Campo','Valor'],['Avaliação',d.title],['Disciplina',d.discipline],['Turma',d.classLabel],
  ['Data de aplicação',new Date(d.appliedOn+'T12:00:00').toLocaleDateString('pt-BR')],['Versões',d.variantCount],
  ['Situação',d.status==='closed'?'Encerrada':'Aberta (resultados podem mudar)'],['Folhas corrigidas',scored.length],
  ['Média da turma',media===null?null:round2(media)],['Pontuação máxima',scored[0]?round2(Number(scored[0].max)):null],
  ['Gerada em',generatedAt.toLocaleString('pt-BR')],
  ['Origem','Correção feita no servidor pelo gabarito validado. As questões seguem a numeração do caderno original; a letra marcada é a da versão do aluno.']];

 return buildXlsx([
  {name:'Resumo por aluno',rows:resumo,widths:[34,14,8,8,8,11,12,8,10,10,12],headerRow:true,freeze:true},
  {name:'Questões por aluno',rows:porQuestao,widths:[34,8,...qs.map(()=>20)],headerRow:true,freeze:true},
  {name:'Acerto por questão',rows:acerto,widths:[10,11,60,7,12,9,11,8,10,10,12,10],headerRow:true,freeze:true},
  {name:'Informações',rows:info,widths:[22,90],headerRow:true},
 ]);
}
export const resultsFilename=(d:Pick<ApplicationDetail,'title'|'classLabel'|'appliedOn'>)=>
 'Resultados-'+[d.title,d.classLabel,d.appliedOn].join('-').normalize('NFD').replace(/\p{M}/gu,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.xlsx';
