import {RULES} from './catalog.mjs';
import {documentaryRun} from './documentary.mjs';
import {pedagogicalRun} from './pedagogical.mjs';
import {academicRun} from './academic.mjs';
import {strategicRun} from './strategic.mjs';
import {instrumentalRun} from './instrumental.mjs';
export const INTEGRATION_VERSION='2026.11-native.1';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const same=(a,b)=>a?.institutionId===b?.institutionId&&a?.courseId===b?.courseId;
const instant=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const families={documentary:['repo.overdue','repo.due'],pedagogical:['sapiens.low','curriculum.gap','avalia.recovery','enade.gap','enamed.gap','retention.alert'],academic:RULES.filter(r=>['Estágio 360°','TCC 360°','Extensão 360°','Atividades de Ensino','AC 360°'].includes(r.module)).map(r=>r.id),strategic:RULES.filter(r=>['Captação','Inteligência de Mercado','Due Diligence','Financeiro','Conecta 360°'].includes(r.module)).map(r=>r.id),instrumental:RULES.filter(r=>r.module==='Instrumentos de Avaliação').map(r=>r.id)};
const runners={documentary:documentaryRun,pedagogical:pedagogicalRun,academic:academicRun,strategic:strategicRun,instrumental:instrumentalRun};
export const UNMAPPED=Object.freeze(RULES.filter(r=>!Object.values(families).flat().includes(r.id)).map(r=>r.id));
function authorize(scope,actor,permission){if(!uuid(scope?.institutionId)||!(scope.courseId===null||uuid(scope.courseId))||!same(scope,actor)||!uuid(actor.id)||actor.mfa!==true||!actor.permissions?.includes(permission)||!Array.isArray(actor.permissions))throw Error('access_denied');}
// Server-only. actor/config/adapter registry must be obtained from trusted backend, never HTTP body.
// Adapters must independently enforce authenticated scope, completeness and provenance.
export async function shadowRun({scope,actor,config,adapters,asOf,timeZone}){
 authorize(scope,actor,'read');
 if(!same(scope,config)||!instant(asOf))throw Error('invalid_config_or_clock');
 if(config.enabled!==true||config.approved!==true)return {status:'disabled',alerts:[],sources:[],unmapped:[]};
 if(!Array.isArray(config.ruleIds)||new Set(config.ruleIds).size!==config.ruleIds.length||config.ruleIds.some(id=>!RULES.some(r=>r.id===id))||!Number.isFinite(config.maxAgeHours)||config.maxAgeHours<=0||config.maxAgeHours>720)throw Error('invalid_config');
 const alerts=[],sources=[],unmapped=config.ruleIds.filter(id=>UNMAPPED.includes(id));
 for(const [family,ids] of Object.entries(families)){
  const ruleIds=config.ruleIds.filter(id=>ids.includes(id));if(!ruleIds.length)continue;
  if((family==='pedagogical'||family==='academic')&&scope.courseId===null){sources.push({family,status:'course_required'});continue;}
  if(!Object.hasOwn(adapters??{},family)||typeof adapters[family]!=='function'){sources.push({family,status:'adapter_unavailable'});continue;}
  try{
   const source=await adapters[family]({scope:{...scope},asOf});
   if(!same(scope,source)||source.complete!==true)throw Error('invalid_source');
   const result=runners[family]({scope,config:{...config,ruleIds},source,asOf,timeZone});
   sources.push({family,status:result.status,issueCount:(result.issues??[]).length,skippedCount:(result.skipped??[]).length});
   if(result.status==='evaluated')alerts.push(...result.alerts);
  }catch{sources.push({family,status:'source_rejected'});}
 }
 return {status:unmapped.length||sources.some(s=>s.status!=='evaluated'||s.issueCount||s.skippedCount)?'partial':'evaluated',mode:'shadow',alerts,sources,unmapped,version:INTEGRATION_VERSION};
}
// Existing RPC is Master + MFA only, IES-level. No escalation to service_role.
// Returns operational metadata ONLY; never calls evaluate or writes to any system.
export async function readIntegrationHealth({scope,actor,rpc,asOf,maxAgeHours=2}){
 authorize(scope,actor,'read_integration_master');
 if(scope.courseId!==null||!instant(asOf)||!Number.isFinite(maxAgeHours)||maxAgeHours<=0||maxAgeHours>720)throw Error('invalid_scope_or_clock');
 const {data,error}=await rpc('vertice_integration_monitor_read',{p_institution:scope.institutionId});
 if(error||!data)throw Error('source_unavailable');
 const live=data.live;
 if(live?.rule_version!=='integration-monitor-v1'||live.source!=='existing_learning_and_sapiens_tables'||live.evidence_level!=='observed_metadata_only'||live.human_homologation!=='pending'||!instant(live.captured_at)||Date.parse(live.captured_at)>Date.parse(asOf)||typeof data.scheduler_enabled!=='boolean'||!Array.isArray(live.flags))throw Error('invalid_contract');
 const stale=Date.parse(asOf)-Date.parse(live.captured_at)>maxAgeHours*3600000;
 const allowed=new Set(['no_recent_events','no_verified_active_links','mapping_or_sample_pending','no_comparable_groups','sync_failed','sync_long_running','source_older_24h','goals_overdue','recent_sample_limited']);
 if(live.flags.some(f=>!allowed.has(f)))throw Error('unknown_source_flag');
 const counts={};for(const k of ['recent_events','verified_active_links','metric_groups','comparable_groups','pending_approvals','overdue_goals']){const v=live[k];if(typeof v!=='string'||!/^(?:0|[5-9]|[1-9]\d{1,3}|10000|1–4|10000\+)$/.test(v))throw Error('invalid_redacted_count');counts[k]=v;}
 return {...scope,status:stale?'stale_source':'observed',observedAt:live.captured_at,counts,flags:[...new Set(live.flags)],schedulerEnabled:data.scheduler_enabled,lastJobStatus:typeof data.last_job_status==='string'&&['succeeded','failed','running','starting','connecting','sending','queued'].includes(data.last_job_status)?data.last_job_status:null,academicEvidence:false,alerts:[]};
}
