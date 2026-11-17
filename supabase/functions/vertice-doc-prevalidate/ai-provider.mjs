// Fixed provider endpoints; no credentials, document text or response bodies in errors.
// Fallback is one attempt per configured provider, never a second human approval.
export class EvidenceAIError extends Error {
 constructor(attempts){super(attempts.length?attempts.map(a=>`${a.provider} ${a.status??a.error}`).join('; '):'Nenhuma chave de IA configurada');this.attempts=attempts;}
}
function parseResult(raw){
 const match=raw.match(/\{[\s\S]*\}/);
 const result=JSON.parse(match?.[0]??'null');
 if(!result||typeof result.summary!=='string'||typeof result.nature!=='string'||!Array.isArray(result.indicator_links))throw Error('invalid_result');
 for(const link of result.indicator_links){
  if(!link||typeof link!=='object'||['instrument_code','instrument_version','object_code','justification','compatibility'].some(k=>typeof link[k]!=='string')||!Array.isArray(link.evidence_excerpts)||link.evidence_excerpts.some(e=>!e||typeof e.text!=='string'||(e.page!=null&&!Number.isInteger(e.page))))throw Error('invalid_result');
 }
 for(const key of ['institution_detected','course_detected','period_detected','scope_detected'])if(result[key]!=null&&typeof result[key]!=='string')throw Error('invalid_result');
 return result;
}
export async function analyzeEvidence({systemPrompt,userPrompt,anthropicKey,openaiKey,anthropicModel='claude-sonnet-4-6',fetcher=fetch}){
 const attempts=[];
 if(!/^claude-[a-zA-Z0-9-]+$/.test(anthropicModel))throw Error('invalid_anthropic_model');
 const providers=[
  ...(anthropicKey?[{provider:'anthropic',model:anthropicModel,url:'https://api.anthropic.com/v1/messages',headers:{'x-api-key':anthropicKey,'anthropic-version':'2023-06-01'},body:{model:anthropicModel,max_tokens:4096,temperature:0,system:systemPrompt,messages:[{role:'user',content:userPrompt}]}}]:[]),
  ...(openaiKey?[{provider:'openai',model:'gpt-4.1-mini',url:'https://api.openai.com/v1/chat/completions',headers:{authorization:'Bearer '+openaiKey},body:{model:'gpt-4.1-mini',max_tokens:4096,temperature:0,response_format:{type:'json_object'},messages:[{role:'system',content:systemPrompt},{role:'user',content:userPrompt}]}}]:[]),
 ];
 for(const p of providers){
  const attempt={provider:p.provider,model:p.model};
  try{
   const res=await fetcher(p.url,{method:'POST',headers:{'content-type':'application/json',...p.headers},body:JSON.stringify(p.body),signal:AbortSignal.timeout(45000)});
   attempt.status=res.status;
   attempt.request_id=res.headers.get('request-id')??res.headers.get('x-request-id');
   if(!res.ok){await res.body?.cancel();attempts.push(attempt);continue;}
   const body=await res.json();
   const content=p.provider==='anthropic'?(body.content??[]).filter(c=>c.type==='text').map(c=>c.text).join('\n'):body.choices?.[0]?.message?.content;
   const result=parseResult(typeof content==='string'?content:'');
   attempts.push(attempt);return {result,model:body.model??p.model,provider:p.provider,attempts};
  }catch(error){
   // Never propagate raw network/provider messages, which may include submitted data.
   attempt.error=error?.name==='TimeoutError'||error?.name==='AbortError'?'timeout':attempt.status===200?'invalid_response':'transport_error';
   attempts.push(attempt);
  }
 }
 throw new EvidenceAIError(attempts);
}
