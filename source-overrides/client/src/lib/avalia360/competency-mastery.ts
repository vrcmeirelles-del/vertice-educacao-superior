/**
 * Avalia 360° — Bloco 1: diagnóstico por competência (algoritmo, sem IA).
 *
 * 1. Domínio por aluno e competência: média ponderada de (nota obtida / nota possível)
 *    das questões vinculadas, com decaimento exponencial pela idade da aplicação
 *    (peso = 0,5^(idade / meia-vida)). Exige um mínimo de questões para classificar.
 * 2. Mapa da turma: competência é "retomar" quando ao menos 60% dos alunos avaliados
 *    ficam abaixo de 50% (com pelo menos 5 alunos avaliados).
 * 3. Causa-raiz: percorre o grafo de pré-requisitos (origem é pré-requisito do destino).
 *    Causa provável = pré-requisito não dominado cujos próprios pré-requisitos estão
 *    dominados (o ponto mais profundo da cadeia). Pré-requisito sem evidência é apontado
 *    como "a verificar", nunca como causa.
 * Mesmos dados e mesma data de referência => mesmo resultado.
 */
export const MASTERY_RULES = {
 version: '2026.11-1',
 halfLifeDays: 180,
 minItems: 2,
 mastered: 0.7,
 developing: 0.4,
 classGapThreshold: 0.5,
 classGapShare: 0.6,
 minStudentsForClassRule: 5,
 maxDepth: 8,
} as const;

export type MasteryLevel = 'domina' | 'em_desenvolvimento' | 'nao_demonstrado' | 'evidencia_insuficiente';
export interface EvidenceCompetency {key:string;code:string|null;title:string|null;period:number|null}
export interface EvidenceRelation {source:string;target:string;kind:'prerequisito'|'aprofundamento'|'interdisciplinar'}
export interface EvidenceRow {studentId:string|null;label:string;applicationId:string;competency:string;score:number;max:number;items:number}
export interface EvidenceApplication {id:string;appliedOn:string;classLabel:string;discipline:string;title:string;status:string}
export interface CompetencyEvidence {
 scope:'application'|'discipline'|'student';applications:EvidenceApplication[];
 competencies:EvidenceCompetency[];relations:EvidenceRelation[];rows:EvidenceRow[];
}
export interface Mastery {
 studentKey:string;studentId:string|null;label:string;competency:string;
 value:number|null;items:number;applications:number;lastAppliedOn:string;level:MasteryLevel;
}
export const studentKeyOf=(r:{studentId:string|null;label:string})=>r.studentId??'label:'+r.label.trim().toLowerCase();
const DAY=86_400_000;

export function levelOf(value:number|null,items:number):MasteryLevel{
 if(value===null||items<MASTERY_RULES.minItems)return 'evidencia_insuficiente';
 if(value>=MASTERY_RULES.mastered)return 'domina';
 if(value>=MASTERY_RULES.developing)return 'em_desenvolvimento';
 return 'nao_demonstrado';
}

export function computeMastery(e:CompetencyEvidence,referenceDate:Date=new Date()):Mastery[]{
 const applied=new Map(e.applications.map(a=>[a.id,a.appliedOn]));
 const acc=new Map<string,{studentId:string|null;label:string;competency:string;ws:number;wm:number;items:number;apps:Set<string>;last:string}>();
 for(const r of e.rows){
  const on=applied.get(r.applicationId);
  if(!on||!(r.max>0))continue;
  const age=Math.max(0,(referenceDate.getTime()-new Date(on+'T12:00:00Z').getTime())/DAY);
  const w=Math.pow(0.5,age/MASTERY_RULES.halfLifeDays);
  const k=studentKeyOf(r)+'\u0000'+r.competency;
  const cur=acc.get(k)||{studentId:r.studentId,label:r.label,competency:r.competency,ws:0,wm:0,items:0,apps:new Set<string>(),last:on};
  cur.ws+=w*r.score;cur.wm+=w*r.max;cur.items+=r.items;cur.apps.add(r.applicationId);
  if(on>cur.last)cur.last=on;
  acc.set(k,cur);
 }
 return [...acc.values()].map(a=>{
  const value=a.wm>0?a.ws/a.wm:null;
  return {studentKey:studentKeyOf(a),studentId:a.studentId,label:a.label,competency:a.competency,
   value,items:a.items,applications:a.apps.size,lastAppliedOn:a.last,level:levelOf(value,a.items)};
 }).sort((x,y)=>x.label.localeCompare(y.label,'pt-BR')||x.competency.localeCompare(y.competency));
}

export type ClassStatus='retomar'|'em_desenvolvimento'|'consolidada'|'amostra_pequena';
export interface ClassCompetency {competency:string;evaluated:number;mean:number|null;belowShare:number|null;status:ClassStatus}
export function classMap(masteries:Mastery[],competencies:EvidenceCompetency[]):ClassCompetency[]{
 return competencies.map(c=>{
  const evaluated=masteries.filter(m=>m.competency===c.key&&m.level!=='evidencia_insuficiente'&&m.value!==null);
  const n=evaluated.length;
  const mean=n?evaluated.reduce((s,m)=>s+(m.value as number),0)/n:null;
  const belowShare=n?evaluated.filter(m=>(m.value as number)<MASTERY_RULES.classGapThreshold).length/n:null;
  const status:ClassStatus=n<MASTERY_RULES.minStudentsForClassRule?'amostra_pequena'
   :belowShare!==null&&belowShare>=MASTERY_RULES.classGapShare?'retomar'
   :mean!==null&&mean>=MASTERY_RULES.mastered?'consolidada':'em_desenvolvimento';
  return {competency:c.key,evaluated:n,mean,belowShare,status};
 });
}

export interface RootCause {competency:string;roots:string[];unverified:string[]}
const failing=(l:MasteryLevel|undefined)=>l==='nao_demonstrado'||l==='em_desenvolvimento';
/** Causa-raiz de um aluno: para cada competência não dominada, os pré-requisitos mais profundos também não dominados. */
export function rootCauses(levels:Map<string,MasteryLevel>,relations:EvidenceRelation[]):RootCause[]{
 const prereqs=new Map<string,string[]>();
 for(const r of relations)if(r.kind==='prerequisito'){
  const list=prereqs.get(r.target)||[];if(!list.includes(r.source))list.push(r.source);prereqs.set(r.target,list.sort());
 }
 const out:RootCause[]=[];
 for(const [competency,level] of [...levels.entries()].sort(([a],[b])=>a.localeCompare(b))){
  if(!failing(level))continue;
  const roots=new Set<string>(),unverified=new Set<string>(),visited=new Set<string>([competency]);
  const walk=(node:string,depth:number)=>{
   if(depth>MASTERY_RULES.maxDepth)return;
   for(const p of prereqs.get(node)||[]){
    if(visited.has(p))continue;visited.add(p);
    const l=levels.get(p);
    if(failing(l)){
     const deeper=(prereqs.get(p)||[]).some(q=>!visited.has(q)&&failing(levels.get(q)));
     if(deeper)walk(p,depth+1);else{roots.add(p);walk(p,depth+1);}
    }else if(l===undefined||l==='evidencia_insuficiente')unverified.add(p);
   }
  };
  walk(competency,0);
  if(roots.size||unverified.size)out.push({competency,roots:[...roots].sort(),unverified:[...unverified].sort()});
 }
 return out;
}

export interface StudentDiagnosis {studentKey:string;studentId:string|null;label:string;masteries:Mastery[];causes:RootCause[]}
export function diagnoseStudents(masteries:Mastery[],relations:EvidenceRelation[]):StudentDiagnosis[]{
 const by=new Map<string,Mastery[]>();
 for(const m of masteries){const l=by.get(m.studentKey)||[];l.push(m);by.set(m.studentKey,l);}
 return [...by.values()].map(list=>({studentKey:list[0].studentKey,studentId:list[0].studentId,label:list[0].label,masteries:list,
  causes:rootCauses(new Map(list.map(m=>[m.competency,m.level])),relations)}))
  .sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
}
/** Agregado da turma: quantos alunos têm a dificuldade em X com origem provável em Y. */
export function classRootCauses(diagnoses:StudentDiagnosis[]):Array<{competency:string;root:string;students:number}>{
 const count=new Map<string,number>();
 for(const d of diagnoses)for(const c of d.causes)for(const r of c.roots){
  const k=c.competency+'\u0000'+r;count.set(k,(count.get(k)||0)+1);
 }
 return [...count.entries()].map(([k,students])=>{const [competency,root]=k.split('\u0000');return {competency,root,students};})
  .sort((a,b)=>b.students-a.students||a.competency.localeCompare(b.competency)||a.root.localeCompare(b.root));
}
export const levelLabel:Record<MasteryLevel,string>={
 domina:'Domina',em_desenvolvimento:'Em desenvolvimento',nao_demonstrado:'Não demonstrado',evidencia_insuficiente:'Evidência insuficiente',
};
export const classStatusLabel:Record<ClassStatus,string>={
 retomar:'Retomar antes de avançar',em_desenvolvimento:'Em desenvolvimento',consolidada:'Consolidada',amostra_pequena:'Poucos alunos avaliados',
};
