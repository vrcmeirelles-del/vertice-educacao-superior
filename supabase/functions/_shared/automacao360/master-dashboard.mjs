import {RULES} from './catalog.mjs';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
const validDate=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
// Identity and authorized institutions MUST come from the server session, never request payload.
export async function loadMasterDashboard({actor, institutionId, asOf, readProjection}) {
 if(actor?.master!==true||actor.mfa!==true||!actor.permissions?.includes('automation.read')||!Array.isArray(actor.institutionIds)||!uuid(institutionId)||!actor.institutionIds.includes(institutionId))throw Error('access_denied');
 if(!validDate(asOf)||typeof readProjection!=='function')throw Error('invalid_request');
 const base={institutionId,asOf,readOnly:true,rules:RULES.map(r=>({id:r.id,module:r.module,priority:r.priority,cadence:r.cadence,version:r.version,state:'unknown'}))};
 let p;try{p=await readProjection(institutionId);}catch{return {...base,status:'unavailable',metrics:null};}
 if(p?.institutionId!==institutionId||!validDate(p.observedAt)||Date.parse(p.observedAt)>Date.parse(asOf)||!Array.isArray(p.rules))return {...base,status:'invalid_source',metrics:null};
 if(Date.parse(asOf)-Date.parse(p.observedAt)>86400000)return {...base,status:'stale',metrics:null};
 const seen=new Map();for(const row of p.rules){if(!RULES.some(r=>r.id===row.id&&r.version===row.version)||seen.has(row.id)||!['inactive','shadow','active','blocked'].includes(row.state))return {...base,status:'invalid_source',metrics:null};seen.set(row.id,row.state);}
 const rules=base.rules.map(r=>({...r,state:seen.get(r.id)??'unknown'}));
 const metrics=Object.fromEntries(['inactive','shadow','active','blocked','unknown'].map(s=>[s,rules.filter(r=>r.state===s).length]));
 return {...base,observedAt:p.observedAt,status:metrics.unknown?'partial':'observed',rules,metrics};
}
export function filterRules(model,{search='',state='',priority=''}={}){
 const q=String(search).toLocaleLowerCase('pt-BR').trim();return model.rules.filter(r=>(!state||r.state===state)&&(!priority||r.priority===priority)&&(!q||`${r.id} ${r.module}`.toLocaleLowerCase('pt-BR').includes(q)));
}
