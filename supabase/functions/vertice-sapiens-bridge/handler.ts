import {bridgeOrigins,bridgeRemoteAllowed} from '../_shared/bridge-origins.ts';
type RecordValue = Record<string, any>;
type Dependencies = {
 getUser: (token: string) => Promise<{id: string} | null>;
 isMaster: (id: string) => Promise<boolean>;
 rpc: (args: RecordValue) => Promise<RecordValue>;
 fetch: typeof fetch;
 baseUrl: string;
 bridgeKey: string;
 supabaseUrl?: string;
};
const fail=(message:string,status=400)=>Object.assign(new Error(message),{status});
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
export function validateRemote(r:RecordValue,p:RecordValue,feedback=false){
 if(!r||r.contractVersion!=='v1'||r.institutionId!==p.institutionId||r.courseId!==p.scope.courseId||r.interventionId!==p.interventionId)throw fail('invalid_remote_contract',502);
 if(!feedback){if(r.accepted!==true||r.registeredStudents!==p.scope.studentTokens.length||!Number.isFinite(Date.parse(r.baselineMeasuredAt)))throw fail('invalid_acknowledgement',502);return;}
 if(r.measurementId!==p.measurementId||r.module!==p.scope.module)throw fail('invalid_measurement',502);
 const c=r.current,b=r.baseline,d=r.delta,q=r.quality;
 if(!c||!b||!d||!q||!Number.isFinite(Date.parse(c.measuredAt))||!Number.isFinite(Date.parse(b.measuredAt))||typeof q.sufficient!=='boolean')throw fail('invalid_metrics',502);
 for(const v of [c.sampleSize,c.attemptsSinceBaseline,b.sampleSize,d.sampleOverlap,q.eligibleStudents,q.counterResets])if(!Number.isSafeInteger(v)||v<0)throw fail('invalid_counts',502);
 for(const v of [c.avgPKnow,b.avgPKnow])if(v!==null&&(!finite(v)||v<0||v>1))throw fail('invalid_probability',502);
 for(const v of [c.avgEloRating,b.avgEloRating,d.pKnowChange,d.eloChange])if(v!==null&&!finite(v))throw fail('invalid_delta',502);
 if(d.sampleOverlap>b.sampleSize||d.sampleOverlap>c.sampleSize||c.sampleSize>q.eligibleStudents||(q.sufficient&&(d.sampleOverlap<5||c.attemptsSinceBaseline===0||q.counterResets!==0||d.pKnowChange===null)))throw fail('invalid_overlap',502);
}
export function createSapiensHandler(deps:Dependencies){const origins=bridgeOrigins(deps.supabaseUrl);return async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 const send=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store',...(origins.has(origin)?{'access-control-allow-origin':origin}:{}),'access-control-allow-headers':'authorization, content-type, apikey, x-client-info','access-control-allow-methods':'POST, OPTIONS','vary':'Origin'}});
 if(origin&&!origins.has(origin))return send({error:'origin_denied'},403);
 if(req.method==='OPTIONS')return send({ok:true});
 if(req.method!=='POST')return send({error:'method_not_allowed'},405);
 try{
  const token=(req.headers.get('authorization')||'').match(/^Bearer (.+)$/)?.[1];if(!token)throw fail('authentication_required',401);
  // getUser verifies the signature/revocation with Supabase before inspecting claims.
  const user=await deps.getUser(token);if(!user)throw fail('invalid_session',401);
  let claims:RecordValue;try{claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{throw fail('invalid_session',401);}
  if(claims.sub!==user.id||claims.aal!=='aal2')throw fail('mfa_required',403);
  if(!await deps.isMaster(user.id))throw fail('master_required',403);
  const body=await req.json().catch(()=>null);
  if(!body||!uuid(body.institutionId)||!uuid(body.interventionId)||!['approve','reject','retry','feedback'].includes(body.action)||Object.keys(body).some(k=>!['institutionId','interventionId','action'].includes(k)))throw fail('invalid_request');
  const args={p_institution:body.institutionId.toLowerCase(),p_id:body.interventionId.toLowerCase(),p_actor:user.id};
  const call=(action:string,payload:unknown={})=>deps.rpc({...args,p_action:action,p_payload:payload});
  const remote=async(path:string,payload:RecordValue)=>{
   const url=new URL(path,deps.baseUrl);
   if(!bridgeRemoteAllowed(url,deps.supabaseUrl)||deps.bridgeKey.length<32)throw fail('bridge_not_configured',503);
   const response=await deps.fetch(url,{method:'POST',redirect:'error',headers:{'content-type':'application/json','x-vertice-bridge-key':deps.bridgeKey,'x-requested-with':'fato-e-ordem'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw fail('remote_http_'+response.status,502);
   const result=await response.json().catch(()=>null);if(!result?.result)throw fail('invalid_remote_response',502);return result.result;
  };
  if(body.action==='reject')return send(await call('reject'));
  if(body.action==='feedback'){
   const payload=await call('feedback_request');
   const result=await remote('/api/internal/vertice/feedback',payload);validateRemote(result,payload,true);
   const sufficient=result.quality.sufficient;
   const baselineVisible=result.baseline.sampleSize>=5;
   const currentVisible=result.current.sampleSize>=5;
   // Store only whitelisted aggregates, never arbitrary remote fields or tokens.
   // Preserve cohort counts, but do not persist estimates for tiny groups or
   // comparative deltas that the source explicitly marks as insufficient.
   const clean={contractVersion:'v1',institutionId:result.institutionId,courseId:result.courseId,module:result.module,interventionId:result.interventionId,measurementId:result.measurementId,
    baseline:{measuredAt:result.baseline.measuredAt,avgPKnow:baselineVisible?result.baseline.avgPKnow:null,avgEloRating:baselineVisible?result.baseline.avgEloRating:null,sampleSize:result.baseline.sampleSize},
    current:{measuredAt:result.current.measuredAt,avgPKnow:currentVisible?result.current.avgPKnow:null,avgEloRating:currentVisible?result.current.avgEloRating:null,sampleSize:result.current.sampleSize,attemptsSinceBaseline:result.current.attemptsSinceBaseline},
    delta:{pKnowChange:sufficient?result.delta.pKnowChange:null,eloChange:sufficient?result.delta.eloChange:null,sampleOverlap:result.delta.sampleOverlap},
    quality:{eligibleStudents:result.quality.eligibleStudents,counterResets:result.quality.counterResets,sufficient:result.quality.sufficient}};
   return send(await call('feedback_save',clean));
  }
  if(body.action==='approve')await call('approve');
  const job=await call('claim');if(job.status==='sent')return send({status:'sent'});
  try{
   const receipt=await remote('/api/internal/vertice/intervention',job.payload);validateRemote(receipt,job.payload);
   await call('sent',{leaseId:job.leaseId,receipt:{contractVersion:'v1',institutionId:receipt.institutionId,courseId:receipt.courseId,interventionId:receipt.interventionId,accepted:true,registeredStudents:receipt.registeredStudents,baselineMeasuredAt:receipt.baselineMeasuredAt}});
   return send({status:'sent'});
  }catch(e){
   const message=String((e as Error).message);const code=/^remote_http_\d{3}$/.test(message)?message:'communication_or_ack_failed';
   await call('failed',{leaseId:job.leaseId,code});
   return send({status:'approved',deliveryStatus:'failed',error:code},502);
  }
 }catch(e){const err=e as Error&{status?:number};return send({error:err.status?err.message:'integration_unavailable'},err.status||503);}
};}
