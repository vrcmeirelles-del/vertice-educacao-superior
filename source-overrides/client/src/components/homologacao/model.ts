import reference from './reference.json';
export {reference};
export const STATUSES=['Em desenvolvimento','Em revisão','Bloqueado','Validado','Homologado','Publicado'] as const;
export const ENVIRONMENTS=['Local','Demonstração','Produção'] as const;
export type ReferenceModule=(typeof reference.modules)[number];
export type Payload={title?:string;note?:string;responsible?:string;environment?:string;dataNature?:string;profile?:string;date?:string;url?:string;expected?:string;version?:string;branch?:string;sha?:string;status?:string;next?:string;pending?:string;decisions?:string;key?:string;result?:string;evidenceId?:string;confirmHuman?:boolean;outcome?:string};
export type Entry={id:string;seq:number;module_key:string;institution_id:string;course_id:string|null;kind:'evidence'|'observation'|'module'|'checklist';payload:Payload;created_by:string;created_at:string};
export type Institution={id:string;name:string;acronym?:string|null};
export type Course={id:string;name:string;institution_id:string};
export function sameScope(r:Entry,module:string,institution:string,course:string){return r.module_key===module&&r.institution_id===institution&&(r.course_id??'')===course;}
export function latest(entries:Entry[],module:string,institution:string,course:string,kind:Entry['kind'],key=''){return entries.filter(r=>sameScope(r,module,institution,course)&&r.kind===kind&&(r.payload.key??'')===key).sort((a,b)=>b.seq-a.seq)[0];}
export function mergeEntries(...groups:Entry[][]){return [...new Map(groups.flat().map(r=>[r.id,r])).values()].sort((a,b)=>b.seq-a.seq);}
export function effectiveModule(m:ReferenceModule,entries:Entry[],institution:string,course:string){const entry=latest(entries,m.id,institution,course,'module');return {...m,status:entry?.payload.status||m.status,owner:entry?.payload.responsible||'A designar',version:entry?.payload.version||m.version,branch:entry?.payload.branch||m.branch,sha:entry?.payload.sha||m.sha,next:entry?.payload.next||m.next,pending:entry?.payload.pending?.split('\n').filter(Boolean)||m.pending,decisions:entry?.payload.decisions?.split('\n').filter(Boolean)||m.decisions,entry};}
export function safeHttps(value:string|undefined){try{const u=new URL(value||'');return u.protocol==='https:'?u.href:undefined;}catch{return undefined;}}
export function formatDate(value:string){if(!value)return 'Sem data';const d=new Date(value.length===10?value+'T12:00:00-03:00':value);return Number.isNaN(d.valueOf())?'Data inválida':new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',...(value.includes('T')?{timeStyle:'short'}:{})}).format(d);}
export function normalize(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');}
