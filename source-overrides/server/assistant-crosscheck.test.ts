import {describe,it,expect,vi} from 'vitest';
vi.stubGlobal('Deno',{env:{get:()=>undefined},serve:vi.fn()});
const {createHandler}=await import('../supabase/functions/vertice-base-assistant/index');
const institution='10000000-0000-4000-8000-000000000001';
function fixture(crossError=false){
 const calls:{url:string;body:unknown}[]=[];
 const fetcher=async(input:any,options:any={})=>{
  const url=String(input),body=options.body?JSON.parse(options.body):null;
  calls.push({url,body});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'user-1',is_anonymous:false});
  if(url.endsWith('/vertice_ebitda_access'))return Response.json(true);
  if(url.endsWith('/vertice_ai_crosschecks'))return crossError
    ?Response.json({message:'unavailable'},{status:503})
    :Response.json({matriculas:{legacy_snapshots:1987,eorbit_quantitativo:null},governanca:{metas:901},aquisicoes:{cnpj:'TEST-INSTITUTION-ID',mandatos_visiveis_autorizados:1,aviso:'Escopo restrito'}});
  if(url.endsWith('/vertice_base_ai_reserve'))return Response.json({institution_id:institution,courses:3,observed_at:'2026-11-06'});
  return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Dados de origens diferentes. Solicite conciliação.'}]}]});
 };
 const handler=createHandler(k=>({SUPABASE_URL:'https://backend.invalid',SUPABASE_ANON_KEY:'anonymous-test',OPENAI_API_KEY:'fake-test-key'} as Record<string,string>)[k],fetcher as typeof fetch);
 const run=(origin='https://vertice-portal.onrender.com')=>handler(new Request('https://function.invalid',{method:'POST',headers:{Origin:origin,Authorization:'Bearer test-token','Content-Type':'application/json'},body:JSON.stringify({action:'chat',institution_id:institution,request_id:crypto.randomUUID(),message:'Cruze os dados acadêmicos.',confirmed:true})}));
 return {calls,run};
}
describe('agente de cruzamento de dados',()=>{
 it('usa cruzamentos antes da reserva e nunca envia CNPJ ao modelo',async()=>{
  const f=fixture();const r=await f.run();expect(r.status).toBe(200);
  const names=f.calls.map(x=>x.url);
  expect(names.findIndex(x=>x.includes('vertice_ai_crosschecks'))).toBeLessThan(names.findIndex(x=>x.includes('vertice_base_ai_reserve')));
  const provider=f.calls.find(x=>x.url.includes('api.openai.com'))!;
  const payload=JSON.stringify(provider.body);
  expect(payload).toContain('1987');expect(payload).toContain('901');
  expect(payload).not.toContain('TEST-INSTITUTION-ID');
 });
 it('permite o domínio real e recusa origem desconhecida',async()=>{
  expect((await fixture().run('https://vertice-educacao-superior-site.onrender.com')).status).toBe(200);
  expect((await fixture().run('https://other.invalid')).status).toBe(403);
 });
 it('não consome quota nem chama a IA se o cruzamento falhar',async()=>{
  const f=fixture(true);expect((await f.run()).status).toBe(503);
  expect(f.calls.some(x=>x.url.includes('vertice_base_ai_reserve'))).toBe(false);
  expect(f.calls.some(x=>x.url.includes('api.openai.com'))).toBe(false);
 });
});
