// Converte o resultado dos algoritmos (os mesmos módulos das telas, em source-overrides/client/src/lib)
// em alertas persistíveis. Só publica quando a trava do algoritmo permite.
import {evasionAlert,type CohortRow} from '../../../source-overrides/client/src/lib/evasion-alert.ts';
import {bottleneckMap,type OfferingRow} from '../../../source-overrides/client/src/lib/bottleneck.ts';
import {repositoryPace,type PaceRequest,type PaceFile} from '../../../source-overrides/client/src/lib/repository-pace.ts';
import {thresholdsFrom,titulationIndicator,type FacultyRow} from '../../../source-overrides/client/src/lib/faculty-titulation.ts';

export const RULES_VERSION='algoritmos-v1';
export type Alert={entity_key:string;severity:'alta'|'media'|'informativa';title:string;detail:string;evidence:Record<string,unknown>};
export type AlgorithmResult={algorithm:'evasao'|'gargalo'|'ritmo_repositorio'|'titulacao';published:boolean;alerts:Alert[];validation:Record<string,unknown>;summary:Record<string,unknown>};
const pct=(v:number)=>`${(v*100).toFixed(1).replace('.',',')}%`;
const br=(d:string)=>d.slice(0,10).split('-').reverse().join('/');

export function evasionAlerts(rows:CohortRow[]):AlgorithmResult{
 const r=evasionAlert(rows);
 const alerts=r.courses.filter(c=>c.level!=='normal').map(c=>({entity_key:c.codigo,severity:c.level==='alerta'?'alta' as const:'media' as const,
  title:`${c.level==='alerta'?'Evasão muito acima dos pares':'Evasão persistentemente acima dos pares'}: ${c.curso}`,
  detail:c.recent.map(x=>`${x.cohort}: ${pct(x.rate)} × ${pct(x.peerRate)}`).join('; '),
  evidence:{modalidade:c.modalidade,meanZ:c.meanZ,coortes:c.recent.map(x=>({coorte:x.cohort,taxa:x.rate,pares:x.peerRate,n:x.n,z:x.z}))}}));
 return {algorithm:'evasao',published:r.validation.ready,alerts:r.validation.ready?alerts:[],validation:r.validation,summary:{cursos:r.courses.length,alertas:alerts.length}};
}

export function bottleneckAlerts(rows:OfferingRow[],courseName:(code:string)=>string=c=>`Curso ${c}`):AlgorithmResult{
 const r=bottleneckMap(rows);
 const alerts=r.disciplines.filter(d=>d.level==='persistente'||d.level==='recente').map(d=>({entity_key:`${d.course}|${d.discipline}`.slice(0,300),
  severity:d.level==='persistente'?'alta' as const:'media' as const,
  title:`${d.level==='persistente'?'Disciplina-gargalo':'Reprovação recente acima dos pares'}: ${d.discipline} (${courseName(d.course)})`,
  detail:`${d.failures} reprovações contra ${d.expected} esperadas (excesso ${d.excess}); ${d.strong} de ${d.offerings.length} ofertas com desvio forte; ${pct(d.absenceShare)} por falta.`,
  evidence:{curso:d.course,excesso:d.excess,pooledZ:d.pooledZ,padraoDocente:d.teacherPattern,porFalta:d.absenceShare}}));
 return {algorithm:'gargalo',published:r.validation.ready,alerts:r.validation.ready?alerts:[],validation:r.validation,summary:{disciplinas:r.disciplines.length,alertas:alerts.length}};
}

export function paceAlerts(requests:PaceRequest[],files:PaceFile[],courseName:(id:string|null)=>string=c=>c??'Sem curso',today=new Date()):AlgorithmResult{
 const r=repositoryPace(requests,files,today);
 const sev=(s:string)=>s==='critico'||s==='vencido'?'alta' as const:'media' as const;
 const label:Record<string,string>={critico:'Ritmo crítico',vencido:'Prazo vencido',em_risco:'Ritmo em risco'};
 const off=(s:string)=>s==='critico'||s==='vencido'||s==='em_risco';
 const alerts=[
  ...r.deadlines.filter(d=>off(d.status)).map(d=>({entity_key:`prazo:${d.due}`,severity:sev(d.status),title:`${label[d.status]}: prazo de ${br(d.due)}`,
   detail:`Faltam ${d.pending} de ${d.total}; ${Number.isFinite(d.requiredPerWeek)?`necessário ${d.requiredPerWeek.toFixed(1)}/semana`:'prazo vencido'}, observado ${d.observedPerWeek.toFixed(1)}/semana.`,
   evidence:{faltam:d.pending,total:d.total,dias:d.daysLeft,necessario:d.requiredPerWeek,observado:d.observedPerWeek,projecao:d.projectedDate}})),
  ...r.courses.filter(c=>off(c.status)).map(c=>({entity_key:`prazo:${c.due}|curso:${c.courseId??'-'}`,severity:sev(c.status),title:`${label[c.status]}: ${courseName(c.courseId)} · prazo ${br(c.due)}`,
   detail:`Faltam ${c.pending} de ${c.total}.`,evidence:{faltam:c.pending,total:c.total,dias:c.daysLeft,necessario:c.requiredPerWeek,observado:c.observedPerWeek}})),
 ].map(a=>({...a,evidence:JSON.parse(JSON.stringify(a.evidence,(_,v)=>v===Infinity?null:v))}));
 // Projeção determinística: não há trava estatística, publica sempre que houver prazo.
 return {algorithm:'ritmo_repositorio',published:true,alerts,validation:{tipo:'projecao_linear'},summary:{prazos:r.deadlines.length,observadoSemana:r.observedPerWeek,semPrazo:r.undated}};
}

export function titulationAlerts(rows:FacultyRow[],criteria:Record<string,string>|undefined):AlgorithmResult{
 const thresholds=criteria?thresholdsFrom(criteria):null;
 if(!rows.length||!thresholds)return {algorithm:'titulacao',published:false,alerts:[],validation:{faixasLidas:!!thresholds,docentes:rows.length},summary:{}};
 const r=titulationIndicator(rows,thresholds);
 const alerts:Alert[]=[];
 if(!r.reliable)alerts.push({entity_key:'cadastro',severity:'media',title:'Cadastro de titulação docente não confiável',
  detail:r.suspicious?`Todos os ${r.total} docentes com a mesma titulação, regime e carga horária, sem curso vinculado (valor padrão de importação).`:`${r.mix.nao_informado} docente(s) sem titulação informada.`,evidence:{mix:r.mix}});
 else if((r.concept??5)<=2)alerts.push({entity_key:'conceito',severity:'alta',title:`Titulação docente: conceito estimado ${r.concept} no indicador 4.1`,
  detail:`${pct(r.share)} de mestres e doutores; para o conceito ${r.next?.level}: ${r.hiresToNext} contratação(ões) ou ${r.upgradesToNext} titulação(ões).`,evidence:{mix:r.mix,share:r.share}});
 return {algorithm:'titulacao',published:true,alerts,validation:{faixasLidas:true,confiavel:r.reliable},summary:{docentes:r.total,share:r.share,conceito:r.concept}};
}
