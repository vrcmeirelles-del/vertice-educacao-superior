// Pré-nota por modelo treinado (21/11/2026), sem IA externa. Aprende com as notas finais que os
// docentes do próprio curso já homologaram (submissions.final_score). Regressão linear com
// penalização (ridge) sobre sinais extraídos da resposta e da rubrica; tudo roda na função.
//
// Trava de qualidade: o modelo só substitui a pré-nota por regra quando
//  1) há pelo menos MIN_TRAINING respostas homologadas no curso; e
//  2) na validação cruzada (FOLDS partições, respostas nunca vistas no ajuste) o erro médio
//     absoluto do modelo fica pelo menos MIN_GAIN ponto abaixo do erro da regra; e
//  3) as previsões nessas respostas não vistas acompanham a nota docente (correlação ≥ MIN_CORR).
//     Sem esta trava, um modelo que só repete a média do curso poderia "errar menos" que a regra.
// Sem isso, vale a regra. A nota final continua sendo do professor em qualquer caso.
import {ruleGrade,type Obj} from './core.ts';

export const MIN_TRAINING=30;
export const FOLDS=5;
export const MIN_GAIN=0.25;
export const MIN_CORR=0.5;
export const MODEL_VERSION='ridge-discursiva-v1';
const LAMBDA=1;

export type TrainingRow={question:Obj;answer:string;score:number};
export type TrainedModel={version:string;weights:number[];n:number;ruleMae:number;cvMae:number;cvCorr:number};
export type TrainingReport={ready:boolean;n:number;reason:string;ruleMae?:number;cvMae?:number;cvCorr?:number;model?:TrainedModel};

const fold=(s:string)=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const stems=(s:string)=>new Set((fold(s).match(/[a-z]{5,}/g)||[]).map(w=>w.slice(0,6)));

/** Sinais da resposta, todos em [0,1], mais o termo constante. */
export function features(q:Obj,answer:string):number[]{
 const rule=ruleGrade(q,answer);
 const max=(q.rubric||[]).reduce((n:number,r:Obj)=>n+(Number(r.points)||0),0)||10;
 const expected=stems(q.expectedAnswer||'');const got=stems(answer);
 let shared=0;for(const t of expected)if(got.has(t))shared++;
 const words=(String(answer||'').match(/\S+/g)||[]).length;
 const criteriaHit=rule.criteria.length?rule.criteria.filter((c:Obj)=>c.score>0).length/rule.criteria.length:0;
 return [1,rule.total/max,expected.size?shared/expected.size:0,Math.min(1,Math.log1p(words)/Math.log1p(400)),criteriaHit];
}

/** Resolve (XᵀX + λI)w = Xᵀy por eliminação de Gauss; o termo constante não é penalizado. */
function fit(X:number[][],y:number[]):number[]{
 const d=X[0].length;const A=Array.from({length:d},(_,i)=>Array.from({length:d+1},(_,j)=>j<d?(i===j&&i>0?LAMBDA:0):0));
 X.forEach((x,k)=>{for(let i=0;i<d;i++){A[i][d]+=x[i]*y[k];for(let j=0;j<d;j++)A[i][j]+=x[i]*x[j];}});
 for(let c=0;c<d;c++){
  let p=c;for(let r=c+1;r<d;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;
  [A[c],A[p]]=[A[p],A[c]];if(Math.abs(A[c][c])<1e-12)continue;
  for(let r=0;r<d;r++)if(r!==c){const f=A[r][c]/A[c][c];for(let j=c;j<=d;j++)A[r][j]-=f*A[c][j];}
 }
 return A.map((row,i)=>Math.abs(row[i])<1e-12?0:row[d]/row[i]);
}
const clip=(v:number)=>Math.round(Math.max(0,Math.min(10,v))*2)/2;
const apply=(w:number[],x:number[])=>clip(w.reduce((s,wi,i)=>s+wi*x[i],0));
const mae=(a:number[],b:number[])=>Math.round(a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0)/a.length*100)/100;
function corr(a:number[],b:number[]){
 const n=a.length,ma=a.reduce((s,v)=>s+v,0)/n,mb=b.reduce((s,v)=>s+v,0)/n;
 let ab=0,aa=0,bb=0;for(let i=0;i<n;i++){ab+=(a[i]-ma)*(b[i]-mb);aa+=(a[i]-ma)**2;bb+=(b[i]-mb)**2;}
 return aa&&bb?Math.round(ab/Math.sqrt(aa*bb)*100)/100:0;
}

export function train(rows:TrainingRow[]):TrainingReport{
 const data=rows.filter(r=>r&&r.question&&typeof r.answer==='string'&&Number.isFinite(Number(r.score))&&Number(r.score)>=0&&Number(r.score)<=10);
 const n=data.length;
 if(n<MIN_TRAINING)return {ready:false,n,reason:`Histórico insuficiente: ${n} de ${MIN_TRAINING} respostas homologadas pelo docente neste curso.`};
 const X=data.map(r=>features(r.question,r.answer));const y=data.map(r=>Number(r.score));
 const rule=data.map(r=>ruleGrade(r.question,r.answer).total);
 // Partição determinística: o mesmo histórico produz sempre a mesma decisão (auditável).
 const pred=new Array(n).fill(0);
 for(let f=0;f<FOLDS;f++){
  const tr=[...Array(n).keys()].filter(i=>i%FOLDS!==f);
  const w=fit(tr.map(i=>X[i]),tr.map(i=>y[i]));
  for(let i=f;i<n;i+=FOLDS)pred[i]=apply(w,X[i]);
 }
 const ruleMae=mae(rule,y),cvMae=mae(pred,y),cvCorr=corr(pred,y);
 if(cvMae>ruleMae-MIN_GAIN)return {ready:false,n,ruleMae,cvMae,cvCorr,reason:`Modelo não superou a regra na validação cruzada (erro médio ${cvMae} contra ${ruleMae}; exige ganho de ${MIN_GAIN}).`};
 if(cvCorr<MIN_CORR)return {ready:false,n,ruleMae,cvMae,cvCorr,reason:`Modelo não acompanha a nota docente em respostas não vistas (correlação ${cvCorr}; exige ${MIN_CORR}).`};
 return {ready:true,n,ruleMae,cvMae,cvCorr,reason:'Modelo aprovado na validação cruzada.',model:{version:MODEL_VERSION,weights:fit(X,y),n,ruleMae,cvMae,cvCorr}};
}

export function predict(model:TrainedModel,q:Obj,answer:string){return apply(model.weights,features(q,answer));}
