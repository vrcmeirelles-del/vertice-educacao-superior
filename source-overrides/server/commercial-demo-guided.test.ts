import {describe,expect,it,vi} from 'vitest';
// IA suspensa (padrão): chave presente, AI_SUSPENDED ausente.
vi.stubGlobal('Deno',{env:{get:(key:string)=>key==='OPENAI_API_KEY'?'test-server-secret':key==='SUPABASE_SERVICE_ROLE_KEY'?'test-service-key':key==='SUPABASE_URL'?'https://backend.test':undefined},serve:vi.fn()});
const {handler,guidedReply}=await import('../supabase/functions/vertice-demo/index');
const origin='https://verticesuperior.com.br',token='a'.repeat(64);
const request=(body:any)=>new Request('https://demo.test',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
describe('demonstração comercial com a IA suspensa: conversa guiada por roteiro',()=>{
 it('status informa roteiro e a conversa não chama provedor externo',async()=>{
  const calls:string[]=[];vi.stubGlobal('fetch',vi.fn(async(url:string)=>{calls.push(url);return Response.json({id:'t',profile:{},events:[],conversation:[]});}));
  expect(await (await handler(request({action:'status'}))).json()).toMatchObject({ai_configured:false,guided:true,provider:'roteiro'});
  const r=await handler(request({action:'chat',token,message:'Quanto custa?',track:'regulacao',module:'metas'}));
  expect(r.status).toBe(200);const body=await r.json();
  expect(body.provider).toBe('roteiro');expect(body.answer).toMatch(/depende do escopo/);
  expect(calls.some(u=>u.includes('openai'))).toBe(false);
 });
 it('respostas do roteiro: uma pergunta, sem promessa de resultado, coerentes com o módulo',()=>{
  for(const [msg,track,mod] of [['Como funciona?','regulacao','evidencias'],['Vocês garantem a aprovação no MEC?','regulacao','metas'],['Integra com nosso ERP?','captacao','atendimento'],['E os dados, ficam seguros?','aquisicoes','diligencia'],['Quero uma proposta','aquisicoes','ebitda'],['Qual o prazo?','captacao','permanencia']]){
   const a=guidedReply(msg,track,mod);
   expect(a.split('?').length-1).toBeLessThanOrEqual(1);
   expect(a).not.toMatch(/\b(?:garantir|garante|garantimos|garantido|assegura|assegurar|asseguramos|certifica)\b/i);
  }
  expect(guidedReply('Como funciona?','aquisicoes','diligencia')).toMatch(/305 requisitos/);
 });
});
describe('limite diário da demonstração usa IP não forjável',()=>{
 it('prefere cf-connecting-ip; nunca o primeiro valor de x-forwarded-for',async()=>{
  const {clientIp}=await import('../supabase/functions/vertice-demo/index');
  const r=(h:Record<string,string>)=>new Request('https://x.test',{headers:h});
  expect(clientIp(r({'cf-connecting-ip':'1.1.1.1','x-forwarded-for':'9.9.9.9, 2.2.2.2'}))).toBe('1.1.1.1');
  expect(clientIp(r({'x-forwarded-for':'9.9.9.9, 2.2.2.2'}))).toBe('2.2.2.2');
  expect(clientIp(r({}))).toBe('unknown');
 });
});
