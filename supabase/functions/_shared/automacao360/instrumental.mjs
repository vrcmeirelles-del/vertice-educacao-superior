// Família "instrumental": instrumentos de avaliação (Reconhecimento 2017 por curso; Recredenciamento 2017,
// checklist e ciclo do Novo Instrumento por IES ou curso). A fonte é o leitor de banco
// vertice_automation_source_instrumental, que já agrega por escopo; aqui só se valida e se avalia.
// Regra sem catálogo de instrumento no banco chega como entrada incompleta e vira pendência de
// qualidade, nunca zero (diretriz 7). Sem IA e sem escrita em sistema algum.
import {createHash} from 'node:crypto';
import {evaluate} from './engine.mjs';
export const INSTRUMENTAL_VERSION='2026.11-instrument.1';
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9:._-]{1,150}$/.test(x);
const same=(a,b)=>a.institutionId===b.institutionId&&a.courseId===b.courseId;
const count=x=>Number.isSafeInteger(x)&&x>=0;
const clock=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(x)&&Number.isFinite(Date.parse(x));
// módulo da entrada → [regra, métrica, estado exigido]
export const SPECS=Object.freeze({
 evidence:['instrument.evidence','indicatorsWithoutEvidence','open'],
 stalled:['instrument.stalled','stalledFiles','open'],
 uncovered:['instrument.uncovered','uncoveredIndicators','open'],
 unbacked:['instrument.unbacked','unbackedConcepts','validated'],
 unassigned:['instrument.unassigned','unassignedItems','open'],
 milestone:['instrument.milestone','overdueMilestones','open'],
});
const allowed=new Set(Object.values(SPECS).map(([r])=>r));

export function instrumentalRun({scope,config,source,asOf}){
 if(!scope||!id(scope.institutionId)||!(scope.courseId===null||id(scope.courseId))||!config||!same(scope,config)||!clock(asOf))throw Error('invalid_scope_or_clock');
 if(config.enabled!==true||config.approved!==true)return {status:'disabled',alerts:[],issues:[],skipped:[]};
 if(!Array.isArray(config.ruleIds)||config.ruleIds.some(x=>!allowed.has(x))||!Number.isFinite(config.maxAgeHours)||config.maxAgeHours<=0||config.maxAgeHours>720)throw Error('invalid_instrumental_config');
 if(!source||!same(scope,source)||source.complete!==true||!id(source.id)||!clock(source.observedAt)||Date.parse(source.observedAt)>Date.parse(asOf)||!Array.isArray(source.entries)||source.entries.length>50)throw Error('invalid_source');
 if(Date.parse(asOf)-Date.parse(source.observedAt)>config.maxAgeHours*3600000)return {status:'stale_source',alerts:[],issues:[],skipped:[]};
 const records=[],issues=[],seen=new Set();
 for(const e of source.entries){
  if(!e||!same(scope,e)||!id(e.id)||!id(e.revision)||!Object.hasOwn(SPECS,e.module))throw Error('invalid_entry');
  if(seen.has(e.module))throw Error('duplicate_entry');seen.add(e.module);
  const [ruleId,metric,state]=SPECS[e.module];
  if(!config.ruleIds.includes(ruleId))continue;
  const issue=(reason)=>issues.push({entityId:e.id,ruleId,reason});
  if(e.applicable===false)continue; // regra sem objeto neste escopo (ex.: ciclo por curso)
  if(e.complete!==true){issue(id(e.reason)?e.reason:'source_incomplete');continue;}
  if(!clock(e.observedAt)||Date.parse(e.observedAt)>Date.parse(source.observedAt)||!id(e.definitionVersion)){issue('invalid_or_stale_evidence');continue;}
  if(ruleId==='instrument.evidence'||ruleId==='instrument.uncovered'||ruleId==='instrument.unbacked'){
   if(!id(e.catalogCode)||!id(e.catalogVersion)){issue('catalog_required');continue;}
  }
  const value=e.metrics?.[metric];
  if(!count(value)){issue('invalid_count');continue;}
  if(e.status!==state){issue('state_not_eligible');continue;}
  const revision=createHash('sha256').update(JSON.stringify([INSTRUMENTAL_VERSION,e.revision,e.definitionVersion,e.catalogCode??null,e.catalogVersion??null])).digest('hex');
  records.push({...scope,entityId:e.id,revision,ruleId,state,metrics:{[metric]:value}});
 }
 return {...evaluate({scope,config,snapshot:{...scope,sourceId:source.id,observedAt:source.observedAt,records},asOf}),issues};
}
