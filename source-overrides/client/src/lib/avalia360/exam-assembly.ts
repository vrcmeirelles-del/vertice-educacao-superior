/**
 * Avalia 360° — Bloco 2: montagem automática de prova pelo banco calibrado (sem IA).
 *
 * Elegibilidade (nesta ordem, cada exclusão é contada):
 *  1. tipo de questão permitido;
 *  2. exposição: não aplicada à mesma turma nos últimos N meses;
 *  3. qualidade: discriminação observada fraca (< 0,20 com n ≥ 30) ou negativa (n ≥ 10) fica fora.
 * Dificuldade de cada item: OBSERVADA (calibração com n ≥ 10); senão a DECLARADA, sinalizada.
 *
 * Seleção gulosa determinística:
 *  a. cobertura: competências da especificação, da mais escassa para a mais abundante
 *     (desempate pela chave), até a quantidade pedida; um item conta para todas as suas competências;
 *  b. complemento: até o total de questões;
 *  em cada escolha vence o item que deixa a dificuldade média mais próxima do alvo;
 *  empate → maior discriminação (desconhecida vale 0,20) → menor bankId.
 * Ordem final do caderno: da mais fácil para a mais difícil (desempate por bankId).
 * Mesma entrada ⇒ mesma prova.
 */
import {competencyKeyOf,mergeIntoCatalog} from './competency-key';
import {observedLevel} from './item-analysis-rules';
import {reuseBankQuestion,type BankQuestion} from './question-bank';
import type {QuestionDraft} from './question-draft';
import type {DeclaredCompetency} from './declared-analysis';

export const ASSEMBLY_RULES = {
 version: '2026.11-1',
 minCalibrationN: 10,
 weakDiscrimination: 0.2,
 weakMinN: 30,
 unknownDiscrimination: 0.2,
} as const;

export interface Calibration {applications:number;n:number;p:number|null;discrimination:number|null}
export interface Exposure {lastAppliedOn:string;applications:number}
export interface AssemblyItem {
 bankId:string;record:BankQuestion;kind:'objetiva'|'discursiva';competencyKeys:string[];
 level:number;levelSource:'observada'|'declarada';discrimination:number|null;n:number;lastAppliedOn:string|null;
}
export interface AssemblySpec {
 total:number;
 requirements:Array<{key:string;count:number}>;
 targetLevel:number;
 kinds:Array<'objetiva'|'discursiva'>;
 /** 0 = sem controle de exposição. */
 exposureMonths:number;
 /** Data de referência (AAAA-MM-DD) para a janela de exposição. */
 referenceDate:string;
}
export interface AssemblyResult {
 selected:AssemblyItem[];
 coverage:Array<{key:string;requested:number;obtained:number}>;
 meanLevel:number|null;
 observedCount:number;declaredCount:number;
 excluded:{kind:number;exposure:number;weak:number};
 eligible:number;
 shortfalls:string[];
}

export function toAssemblyItems(records:BankQuestion[],calibration:Record<string,Calibration>,exposure:Record<string,Exposure>):AssemblyItem[]{
 return records.map(r=>{
  const ids=new Set(r.question.competencyIds);
  const keys=[...new Set((r.competencies??[]).filter(c=>ids.has(c.id)).map(competencyKeyOf))].sort();
  const cal=calibration[r.bankId];
  const calibrated=Boolean(cal&&cal.p!==null&&cal.n>=ASSEMBLY_RULES.minCalibrationN);
  return {bankId:r.bankId,record:r,kind:r.question.kind,competencyKeys:keys,
   level:calibrated?observedLevel(cal!.p) as number:r.question.estimatedDifficulty,
   levelSource:calibrated?'observada':'declarada',
   discrimination:cal?.discrimination??null,n:cal?.n??0,lastAppliedOn:exposure[r.bankId]?.lastAppliedOn??null};
 });
}

const minusMonths=(iso:string,months:number)=>{
 const d=new Date(iso+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()-months);return d.toISOString().slice(0,10);
};

export function assembleExam(items:AssemblyItem[],spec:AssemblySpec):AssemblyResult{
 const shortfalls:string[]=[];
 const excluded={kind:0,exposure:0,weak:0};
 if(!Number.isInteger(spec.total)||spec.total<1||spec.total>200)throw Error('Informe entre 1 e 200 questões.');
 if(!(spec.targetLevel>=1&&spec.targetLevel<=5))throw Error('Dificuldade-alvo deve ficar entre 1 e 5.');
 const cutoff=spec.exposureMonths>0?minusMonths(spec.referenceDate,spec.exposureMonths):null;
 const eligible=[...items].sort((a,b)=>a.bankId.localeCompare(b.bankId)).filter(it=>{
  if(!spec.kinds.includes(it.kind)){excluded.kind++;return false;}
  if(cutoff&&it.lastAppliedOn&&it.lastAppliedOn>=cutoff){excluded.exposure++;return false;}
  if(it.discrimination!==null&&((it.n>=ASSEMBLY_RULES.weakMinN&&it.discrimination<ASSEMBLY_RULES.weakDiscrimination)
     ||(it.n>=ASSEMBLY_RULES.minCalibrationN&&it.discrimination<0))){excluded.weak++;return false;}
  return true;
 });
 const chosen:AssemblyItem[]=[];let sum=0;
 const pick=(cands:AssemblyItem[])=>{
  const k=chosen.length;
  const ranked=cands.map(c=>({c,cost:Math.abs((sum+c.level)/(k+1)-spec.targetLevel),d:c.discrimination??ASSEMBLY_RULES.unknownDiscrimination}))
   .sort((x,y)=>x.cost-y.cost||y.d-x.d||x.c.bankId.localeCompare(y.c.bankId));
  const best=ranked[0].c;chosen.push(best);sum+=best.level;
 };
 const requested=spec.requirements.filter(r=>r.count>0);
 const totalRequested=requested.reduce((s,r)=>s+r.count,0);
 if(totalRequested>spec.total)shortfalls.push('A soma pedida por competência ('+totalRequested+') é maior que o total de questões ('+spec.total+'); itens que cobrem mais de uma competência podem compensar.');
 const scarcity=(key:string)=>eligible.filter(i=>i.competencyKeys.includes(key)).length;
 for(const req of [...requested].sort((a,b)=>scarcity(a.key)-scarcity(b.key)||a.key.localeCompare(b.key))){
  let covered=chosen.filter(c=>c.competencyKeys.includes(req.key)).length;
  while(covered<req.count&&chosen.length<spec.total){
   const cands=eligible.filter(i=>!chosen.includes(i)&&i.competencyKeys.includes(req.key));
   if(!cands.length)break;
   pick(cands);covered++;
  }
 }
 while(chosen.length<spec.total){
  const cands=eligible.filter(i=>!chosen.includes(i));
  if(!cands.length)break;
  pick(cands);
 }
 const coverage=requested.map(r=>({key:r.key,requested:r.count,obtained:chosen.filter(c=>c.competencyKeys.includes(r.key)).length}));
 for(const c of coverage)if(c.obtained<c.requested)
  shortfalls.push('Competência '+c.key.replace(/^cmp:/,'')+': '+c.obtained+' de '+c.requested+' questão(ões); faltam itens elegíveis no banco.');
 if(chosen.length<spec.total)shortfalls.push('Montadas '+chosen.length+' de '+spec.total+' questões: o banco não tem itens elegíveis suficientes.');
 const selected=[...chosen].sort((a,b)=>a.level-b.level||a.bankId.localeCompare(b.bankId));
 return {selected,coverage,meanLevel:selected.length?sum/selected.length:null,
  observedCount:selected.filter(s=>s.levelSource==='observada').length,declaredCount:selected.filter(s=>s.levelSource==='declarada').length,
  excluded,eligible:eligible.length,shortfalls};
}

/** Converte a prova montada em questões de um novo rascunho, com competências religadas ao catálogo. */
export function toDraftQuestions(selected:AssemblyItem[],discipline:string,catalog:DeclaredCompetency[],
 newId:()=>string=()=>crypto.randomUUID()):{questions:QuestionDraft[];catalog:DeclaredCompetency[]}{
 let current=catalog;
 const questions=selected.map(s=>{
  const copy=reuseBankQuestion(s.record,newId(),discipline);
  const merged=mergeIntoCatalog(current,s.record.competencies??[],copy.competencyIds,newId);
  current=merged.catalog;
  return {...copy,competencyIds:merged.ids};
 });
 return {questions,catalog:current};
}
