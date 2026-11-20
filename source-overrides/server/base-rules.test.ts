import {describe,it,expect,vi} from 'vitest';
vi.stubGlobal('Deno',{env:{get:()=>undefined},serve:vi.fn()});
import {ruleAnswer,crosscheckFindings,helpMatches} from '../client/src/lib/base-rules';
const {createHandler}=await import('../supabase/functions/vertice-base-assistant/index');
const cross={observed_at:'2026-11-20T12:00:00Z',matriculas:{semester:'2026/02',eorbit_quantitativo:1200,legacy_snapshots:1150,difference:50},
 governanca:{metas:8,metas_sem_conta_vinculada:3,medicoes:0,acoes_5w2h:5},documentos:{enviados:4,validados:10,solicitacoes_ativas_sem_executor:2},aquisicoes:{mandatos_visiveis_autorizados:0}};
describe('assistente da Base por regras (sem IA)',()=>{
 it('cruzamentos viram achados em ordem de prioridade',()=>{
  const f=crosscheckFindings(cross);
  expect(f[0]).toMatch(/divergem em 50/);
  expect(f.join('\n')).toMatch(/3 de 8 meta\(s\) sem responsável/);
  expect(f.join('\n')).toMatch(/nenhuma medição/);
  expect(f.join('\n')).toMatch(/2 solicitação\(ões\) de documento ativa\(s\) sem executor/);
 });
 it('pergunta de cruzamento usa os dados; pergunta de uso usa a ajuda local; nada inventado',()=>{
  expect(ruleAnswer('Quais inconsistências existem entre as fontes de matrículas?',cross)).toMatch(/^Cruzamentos da organização/);
  expect(ruleAnswer('Priorize os problemas encontrados',null)).toMatch(/exigem perfil de gestor/);
  expect(helpMatches('Como cadastro um plano de ação 5W2H?')[0].term).toBe('Plano de ação 5W2H');
  expect(ruleAnswer('xyz abc',cross)).toMatch(/Não encontrei orientação específica/);
 });
 it('status informa regras enquanto a IA está suspensa, mesmo com chave configurada',async()=>{
  const calls:string[]=[];
  const request=(async(url:string)=>{calls.push(url);if(url.endsWith('/auth/v1/user'))return Response.json({id:'u1'});if(url.includes('vertice_ebitda_access'))return Response.json(true);return Response.json({});}) as typeof fetch;
  const handler=createHandler(k=>({SUPABASE_URL:'https://backend.invalid',SUPABASE_ANON_KEY:'anon',OPENAI_API_KEY:'server-secret'} as Record<string,string>)[k],request);
  const body=(action:string)=>new Request('https://x.invalid',{method:'POST',headers:{authorization:'Bearer t'},body:JSON.stringify({action,institution_id:'00000000-0000-4000-8000-000000000001',request_id:'00000000-0000-4000-8000-000000000002',message:'oi',confirmed:true})});
  expect(await (await handler(body('status'))).json()).toMatchObject({configured:false,provider:'regras'});
  expect((await handler(body('chat'))).status).toBe(503);
  expect(calls.some(u=>u.includes('openai'))).toBe(false);
 });
});
