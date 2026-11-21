/**
 * Avalia 360° — Bloco 5: índice de prontidão para exame (ENADE, OAB), sem IA.
 * Fonte: domínio por competência do bloco 1 (histórico do curso, aplicações encerradas) ×
 * matriz do exame validada pelo colegiado (áreas, pesos e competências).
 *  - nota da área = média do domínio nas competências da área com evidência;
 *  - índice = média das áreas ponderada pelos pesos, só entre áreas com evidência;
 *  - cobertura = soma dos pesos das áreas com evidência ÷ soma de todos os pesos;
 *  - cobertura < 50% ⇒ "evidência insuficiente" (o índice não é publicado como leitura);
 *  - ≥ 70% pronto · 50–69% em desenvolvimento · < 50% em risco.
 * O índice indica preparação nas competências avaliadas pela instituição; não é previsão de nota.
 */
import type {Mastery} from './competency-mastery';
export const READINESS_RULES={version:'2026.11-1',minCoverage:0.5,ready:0.7,developing:0.5} as const;

export interface ExamArea {key:string;label:string;weight:number;competencies:string[]}
export interface ExamMatrix {id:string;exam:'enade'|'oab'|'outro';label:string;edition:string;sourceRef:string;areas:ExamArea[];status:'draft'|'validated'|'archived';mine?:boolean}
export type ReadinessLevel='pronto'|'em_desenvolvimento'|'risco'|'evidencia_insuficiente';
export interface AreaReading {key:string;label:string;weight:number;score:number|null;evidenced:number;total:number}
export interface StudentReadiness {studentId:string|null;label:string;index:number|null;coverage:number;level:ReadinessLevel;areas:AreaReading[];weakest:string[]}

/** Modelo da composição da nota do ENADE (formação geral 25%, componente específico 75%). Confira no edital da edição. */
export const ENADE_TEMPLATE:ExamArea[]=[
 {key:'formacao-geral',label:'Formação Geral',weight:25,competencies:[]},
 {key:'componente-especifico',label:'Componente Específico',weight:75,competencies:[]},
];

export function studentReadiness(masteries:Mastery[],matrix:ExamMatrix):StudentReadiness{
 const byKey=new Map(masteries.map(m=>[m.competency,m]));
 const areas=matrix.areas.map(a=>{
  const vals=a.competencies.map(k=>byKey.get(k)).filter((m):m is Mastery=>Boolean(m&&m.level!=='evidencia_insuficiente'&&m.value!==null)).map(m=>m.value as number);
  return {key:a.key,label:a.label,weight:a.weight,score:vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:null,evidenced:vals.length,total:a.competencies.length};
 });
 const totalW=areas.reduce((s,a)=>s+a.weight,0);
 const withEv=areas.filter(a=>a.score!==null);
 const evW=withEv.reduce((s,a)=>s+a.weight,0);
 const index=evW>0?withEv.reduce((s,a)=>s+a.weight*(a.score as number),0)/evW:null;
 const coverage=totalW>0?evW/totalW:0;
 const level:ReadinessLevel=index===null||coverage<READINESS_RULES.minCoverage?'evidencia_insuficiente'
  :index>=READINESS_RULES.ready?'pronto':index>=READINESS_RULES.developing?'em_desenvolvimento':'risco';
 const weakest=withEv.filter(a=>(a.score as number)<READINESS_RULES.ready).sort((x,y)=>(x.score as number)-(y.score as number)||x.key.localeCompare(y.key)).map(a=>a.key);
 const first=masteries[0];
 return {studentId:first?.studentId??null,label:first?.label??'',index,coverage,level,areas,weakest};
}
export function classReadiness(list:StudentReadiness[],matrix:ExamMatrix){
 const counts={pronto:0,em_desenvolvimento:0,risco:0,evidencia_insuficiente:0} as Record<ReadinessLevel,number>;
 for(const s of list)counts[s.level]++;
 const valid=list.filter(s=>s.level!=='evidencia_insuficiente'&&s.index!==null);
 const areaMeans=matrix.areas.map(a=>{const v=list.map(s=>s.areas.find(x=>x.key===a.key)?.score).filter((x):x is number=>x!==null&&x!==undefined);
  return {key:a.key,label:a.label,weight:a.weight,mean:v.length?v.reduce((s,x)=>s+x,0)/v.length:null,students:v.length};});
 return {counts,meanIndex:valid.length?valid.reduce((s,x)=>s+(x.index as number),0)/valid.length:null,areaMeans};
}
export const readinessLabel:Record<ReadinessLevel,string>={pronto:'Pronto',em_desenvolvimento:'Em desenvolvimento',risco:'Em risco',evidencia_insuficiente:'Evidência insuficiente'};
