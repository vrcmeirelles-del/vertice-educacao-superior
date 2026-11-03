import {isLate, type Row} from './area';
import {goalSignals} from './goal-signals';
import {repositorySummary,isInstrumentRequest,latestInstrumentDocuments} from './repository';

export type PortalData={courses:Row[];goals:Row[];measurements:Row[];diagnosis:Row[];actions:Row[];requests:Row[];files:Row[]};
export const activeAction=(a:Row)=>!['concluida','cancelada'].includes(String(a.status));
export function integratedSummary(data:PortalData,course?:string){
 const scope=(rows:Row[])=>course===undefined?rows:rows.filter(r=>String(r.course_id??'')===course);
 const goals=scope(data.goals),findings=scope(data.diagnosis).filter(d=>d.status!=='resolvido'),actions=scope(data.actions).filter(activeAction);
 const alerts=goalSignals(goals,data.measurements).filter(s=>['red','amber'].includes(s.signal));
 const documents=repositorySummary(scope(data.requests),data.files);
 const late=actions.filter(a=>isLate(a.due_date,a.status)).length;
 const uncovered=alerts.filter(s=>!actions.some(a=>a.goal_id===s.goal.id)).length+findings.filter(f=>!actions.some(a=>a.finding_id===f.id)).length;
 const signal=late||alerts.some(s=>s.signal==='red')||findings.some(f=>f.priority==='alta')?'red':alerts.length||findings.length||documents.total>documents.validated?'amber':goals.some(g=>g.status!=='cancelada')||documents.total||actions.length?'green':'gray';
 return {goals,alerts,findings,actions,documents,late,uncovered,signal};
}

export function documentActionSuggestions(data:PortalData,course=''){
 const latest=latestInstrumentDocuments(data.files),groups=new Map<string,Row[]>();
 for(const r of data.requests){
  if(r.active===false||r.not_applicable===true||!isInstrumentRequest(r)||(course&&r.course_id!==course)||latest.get(r.id)?.status==='validado')continue;
  const key=String(r.course_id??'')+'|'+String(r.goal_id??'');groups.set(key,[...(groups.get(key)||[]),r]);
 }
 return [...groups].map(([key,rows])=>{
  const first=rows[0],goal=data.goals.find(g=>g.id===first.goal_id),courseName=data.courses.find(c=>c.id===first.course_id)?.name??'Instituição';
  const summary=repositorySummary(rows,data.files);
  return {key:'documents-'+key,title:'Regularizar evidências · '+String(goal?.title??courseName),course_id:first.course_id,goal_id:goal?.id,why:`Origem: Repositório · ${courseName}. ${rows.length} exigência(s) sem validação: ${summary.pending} sem envio, ${summary.returned} devolvida(s), ${summary.sent-summary.validated-summary.returned} aguardando análise. ${summary.late} com prazo vencido.`,how:'Abrir o repositório do curso, conferir cada exigência aplicável, providenciar documentos faltantes, corrigir devoluções e solicitar validação. Não considerar o envio como aprovação.',evidence:'Sugestão de evidência: documentos validados e respectivos registros de revisão no repositório.'};
 }).filter(s=>!data.actions.some(a=>activeAction(a)&&((s.goal_id&&a.goal_id===s.goal_id)||(a.what===s.title&&String(a.course_id??'')===String(s.course_id??'')))));
}

type ActionSuggestion={key:string;title:string;why:string;how:string;evidence:string;goal_id?:unknown;course_id?:unknown;finding_id?:unknown};
export function mergeActionSuggestions(primary:ActionSuggestion[],documents:ActionSuggestion[]):ActionSuggestion[]{
 const matches=(a:ActionSuggestion,b:ActionSuggestion)=>Boolean(a.goal_id&&a.goal_id===b.goal_id&&String(a.course_id??'')===String(b.course_id??''));
 return [...primary.map(s=>{const doc=documents.find(d=>matches(s,d));return doc?{...s,why:s.why+' '+doc.why,how:s.how+' '+doc.how,evidence:s.evidence+' '+doc.evidence}:s;}),...documents.filter(d=>!primary.some(s=>matches(s,d)))];
}

// Only an explicitly scoped draft is reusable. Legacy unscoped drafts are ignored.
export const actionDraftKey=(institutionId:string)=>'vertice-action-prefill:'+institutionId;
export function storeActionDraft(institutionId:string,values:Record<string,unknown>){
 sessionStorage.setItem(actionDraftKey(institutionId),JSON.stringify({institutionId,values}));
}
export function parseActionDraft(raw:string|null,institutionId:string):Record<string,unknown>{
 try{const draft=JSON.parse(raw||'null');return draft?.institutionId===institutionId&&draft.values&&typeof draft.values==='object'&&!Array.isArray(draft.values)?draft.values:{};}catch{return {};}
}
export function validateActionLinks(values:Record<string,unknown>,data:Pick<PortalData,'courses'|'goals'|'diagnosis'>){
 const v={...values};
 const course=v.course_id?data.courses.find(c=>c.id===v.course_id):undefined;
 if(v.course_id&&!course)throw new Error('Selecione um curso desta instituição.');
 const linked:Row[]=[];
 for(const [key,rows,label] of [['goal_id',data.goals,'meta'],['finding_id',data.diagnosis,'achado']] as const){
  if(!v[key])continue;const row=rows.find(r=>r.id===v[key]);
  if(!row)throw new Error('A '+label+' não está disponível nesta instituição. Atualize o vínculo.');
  linked.push(row);
 }
 const ids=new Set(linked.map(r=>r.course_id).filter(Boolean));if(v.course_id)ids.add(v.course_id);
 if(ids.size>1)throw new Error('Curso, meta e achado devem se referir ao mesmo curso. Revise os vínculos.');
 if(!v.course_id&&ids.size)v.course_id=[...ids][0];
 if(v.course_id&&!data.courses.some(c=>c.id===v.course_id))throw new Error('O curso de origem não está disponível.');
 return v;
}
