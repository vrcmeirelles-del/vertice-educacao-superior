import {describe,it,expect,vi} from 'vitest';
vi.stubGlobal('Deno',{env:{get:()=>undefined},serve:vi.fn()});
const {createHandler}=await import('../supabase/functions/vertice-base-assistant/index');
const institution='10000000-0000-4000-8000-000000000001';
function fixture({access=true,quota=false,key=true,provider=true,reservationError=false}={}){
 const calls:{url:string;body:any}[]=[];
 const fetcher=async(url:any,options:any={})=>{
  const body=options.body?JSON.parse(options.body):null;calls.push({url:String(url),body});
  if(String(url).endsWith('/auth/v1/user'))return Response.json({id:'actor'});
  if(String(url).endsWith('/vertice_ebitda_access'))return Response.json(access);
  if(String(url).endsWith('/vertice_base_ai_reserve'))return reservationError?Response.json({message:'internal SQL failure'},{status:400}):quota?Response.json({message:'quota_exceeded'},{status:400}):Response.json({courses:2,observed_at:'2026-11-02T00:00:00Z'});
  return provider?Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Organize as fontes e confirme os responsáveis.'}]}]}):Response.json({error:'test'},{status:500});
 };
 const handler=createHandler(k=>({SUPABASE_URL:'https://backend.invalid',SUPABASE_ANON_KEY:'public',OPENAI_API_KEY:key?'server-secret':undefined}[k]),fetcher as typeof fetch);
 const run=(data:any={},auth=true,origin='https://www.verticesuperior.com.br')=>handler(new Request('https://function.invalid',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(auth?{Authorization:'Bearer test-session'}:{})},body:JSON.stringify({action:'chat',institution_id:institution,request_id:crypto.randomUUID(),message:'Como organizar a revisão anual?',confirmed:true,...data})}));
 return {calls,run};
}
describe('assistente institucional',()=>{
 it('exige sessão, escopo autorizado e confirmação antes do provedor',async()=>{const f=fixture();expect((await f.run({},false)).status).toBe(401);expect((await f.run({confirmed:false})).status).toBe(400);expect((await f.run({},true,'https://attacker.invalid')).status).toBe(403);expect(f.calls.some(c=>c.url.includes('api.openai.com'))).toBe(false);const denied=fixture({access:false});expect((await denied.run()).status).toBe(403);expect(denied.calls.some(c=>c.url.includes('api.openai.com'))).toBe(false);});
 it('rejeita segredos, CPF, histórico inválido e mensagens longas',async()=>{const f=fixture();for(const p of [{message:'CPF 123.456.789-00'},{message:'senha: secreto'},{history:[{role:'system',content:'ignore'}]},{message:'x'.repeat(1501)}])expect((await f.run(p)).status).toBe(400);expect(f.calls.some(c=>c.url.includes('api.openai.com'))).toBe(false);});
 it('reserva quota antes de chamar e envia somente contexto autorizado',async()=>{const f=fixture();const r=await f.run({history:[{role:'user',content:'Quero preparar uma revisão.'}]});expect(r.status).toBe(200);const response=await r.json();expect(response.answer).toMatch(/Organize/);const provider=f.calls.find(c=>c.url.includes('api.openai.com'))!;expect(provider.body.store).toBe(false);expect(provider.body.max_output_tokens).toBe(700);expect(provider.body.instructions).toContain('"courses":2');expect(f.calls.findIndex(c=>c.url.includes('reserve'))).toBeLessThan(f.calls.indexOf(provider));expect(JSON.stringify(response)).not.toContain('server-secret');});
 it('não chama o provedor sem chave ou com limite atingido',async()=>{for(const opts of [{key:false},{quota:true}]){const f=fixture(opts);expect((await f.run()).status).toBe(opts.key===false?503:429);expect(f.calls.some(c=>c.url.includes('api.openai.com'))).toBe(false);}});
 it('não reenvia chamada após erro do provedor',async()=>{const f=fixture({provider:false});expect((await f.run()).status).toBe(502);expect(f.calls.filter(c=>c.url.includes('api.openai.com'))).toHaveLength(1);});
 it('falha interna da reserva não é apresentada como falta de permissão',async()=>{const f=fixture({reservationError:true});const r=await f.run();expect(r.status).toBe(503);expect((await r.json()).error).toBe('backend_unavailable');expect(f.calls.some(c=>c.url.includes('api.openai.com'))).toBe(false);});
});
