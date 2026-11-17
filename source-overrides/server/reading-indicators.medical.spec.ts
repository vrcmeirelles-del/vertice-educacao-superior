import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const institution='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000003';
const user='00000000-0000-4000-8000-000000000002';
// Evaluate the actual shared guards with the handler in the isolated VM.
const guards=readFileSync('supabase/functions/_shared/bridge-origins.ts','utf8').replace(/^export /gm,'');
const source=readFileSync('supabase/functions/vertice-learning-bridge/index.ts','utf8').replace(/^import .*\n/gm,'');
const code=ts.transpile(guards+'\n'+source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None});
function harness(options:{tier?:string;role?:string;master?:boolean;aal?:string;invalidSession?:boolean;membershipError?:boolean;key?:string;base?:string;remoteStatus?:number;result?:unknown;raw?:unknown}={}){
 let handler:any;
 const queries:{table:string;filters:unknown[]}[]=[];
 const rpc=vi.fn(()=>{throw new Error('No persistence expected for reading indicators');});
 const client={auth:{getUser:async()=>({data:{user:options.invalidSession?null:{id:user}},error:null})},rpc,from:(table:string)=>{
  const entry={table,filters:[] as unknown[]};queries.push(entry);
  const chain:any={select:()=>chain,eq:(...args:unknown[])=>{entry.filters.push(args);return chain;},maybeSingle:async()=>({
   data:table==='vertice_admins'?(options.master?{user_id:user}:null):table==='vertice_memberships'?
    (entry.filters.some(v=>JSON.stringify(v)===JSON.stringify(['institution_id',institution]))?{role:options.role??'reitor'}:null):{tier:options.tier??'superior'},
   error:table==='vertice_memberships'&&options.membershipError?{}:null
  })};return chain;
 }};
 const payload=()=>options.result??{periodDays:90,indicators:[{module:options.tier==='escolas'?'enem':'oab2',action:'declared_read',total:3}]};
 const fetcher=vi.fn(async()=>options.remoteStatus?new Response('SECRET SOURCE TEXT',{status:options.remoteStatus}):Response.json(options.raw??{result:payload()}));
 const logger={error:vi.fn()};
 vm.runInNewContext(code,{Deno:{env:{get:(key:string)=>({SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic',VERTICE_BRIDGE_API_KEY:options.key??'a'.repeat(40),FATO_ORDEM_BRIDGE_URL:options.base})[key]},serve:(fn:any)=>handler=fn},createClient:()=>client,fetch:fetcher,TextEncoder,Response,Request,URL,URLSearchParams,AbortSignal,atob,Date,console:logger});
 const jwt='header.'+Buffer.from(JSON.stringify({sub:user,aal:options.aal??'aal2'})).toString('base64url')+'.signature';
 return {queries,rpc,fetcher,logger,run:({inst=institution,auth='Bearer '+jwt,method='POST',origin='',extra={}}={})=>handler(new Request('https://fixture.test',{method,headers:{...(auth?{authorization:auth}:{}),...(origin?{origin}:{}),'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify({operation:'reading_indicators',institutionId:inst,...extra})}:{})}))};
}
describe('read-only institutional reading receiver',()=>{
 it.each(['superior','escolas'])('derives %s from saved institution and sends only the server key',async tier=>{
  const h=harness({tier});const r=await h.run();expect(r.status).toBe(200);const data=await r.json();
  const [url,options]=h.fetcher.mock.calls[0] as any;
  expect(url.pathname).toBe('/api/internal/vertice/'+(tier==='escolas'?'school-reading-indicators':'reading-indicators'));
  expect(url.searchParams.toString()).toBe(new URLSearchParams({institutionId:institution}).toString());
  expect(options.headers['x-vertice-bridge-key']).toBe('a'.repeat(40));expect(options.headers.authorization).toBeUndefined();
  expect(options.redirect).toBe('error');expect(options.cache).toBe('no-store');
  expect(data).toMatchObject({institutionId:institution,scope:'institution',educationTier:tier,periodDays:90});
  expect(Number.isFinite(Date.parse(data.retrievedAt))).toBe(true);expect(r.headers.get('cache-control')).toBe('no-store');
  expect(h.queries.find(q=>q.table==='vertice_memberships')?.filters).toContainEqual(['institution_id',institution]);
  expect(h.queries.find(q=>q.table==='vertice_institutions')?.filters).toContainEqual(['id',institution]);
  expect(h.rpc).not.toHaveBeenCalled();expect(h.queries.every(q=>['vertice_admins','vertice_memberships','vertice_institutions'].includes(q.table))).toBe(true);
 });
 it.each(['reitor','gestor','diretor_geral','diretor_pedagogico','procurador'])('preserves authorized institutional role %s',async role=>expect((await harness({role}).run()).status).toBe(200));
 it('allows verified Master to choose another institution explicitly',async()=>expect((await harness({master:true}).run({inst:other})).status).toBe(200));
 it.each(['coordenador','nde','cpa','equipe','leitor'])('does not expand institutional data to %s',async role=>{const h=harness({role});expect((await h.run()).status).toBe(403);expect(h.fetcher).not.toHaveBeenCalled();});
 it('denies missing/invalid authentication and aal1 before remote access',async()=>{
  for(const [h,args,status] of [[harness(),{auth:''},401],[harness({invalidSession:true}),{},401],[harness({aal:'aal1'}),{},403]] as const){expect((await h.run(args)).status).toBe(status);expect(h.fetcher).not.toHaveBeenCalled();}
 });
 it('denies another tenant and membership lookup failures',async()=>{
  const h=harness();expect((await h.run({inst:other})).status).toBe(403);expect(h.fetcher).not.toHaveBeenCalled();
  const failure=harness({membershipError:true});expect((await failure.run()).status).toBe(403);expect(failure.fetcher).not.toHaveBeenCalled();
 });
 it('denies unrecognized segment, untrusted origins, wrong methods and course filters',async()=>{
  expect((await harness({tier:'unknown'}).run()).status).toBe(403);
  const h=harness();expect((await h.run({origin:'https://untrusted.test'})).status).toBe(403);
  expect((await h.run({method:'GET'})).status).toBe(405);
  for(const extra of [{courseId:other},{semester:'2026/2'},{educationTier:'escolas'},{module:'enem'}])expect((await h.run({extra})).status).toBe(400);
  expect(h.fetcher).not.toHaveBeenCalled();
 });
 it('does not call an untrusted remote base or transmit with a missing key',async()=>{
  for(const options of [{key:''},{base:'https://untrusted.test'}]){const h=harness(options);expect((await h.run()).status).toBe(503);expect(h.fetcher).not.toHaveBeenCalled();}
 });
 it.each([401,403,503])('disabled/unauthorized/unavailable source HTTP %s is not zero data or leaked text',async remoteStatus=>{
  const h=harness({remoteStatus});const r=await h.run();expect(r.status).toBe(502);expect(await r.text()).not.toContain('SECRET');expect(h.logger.error).not.toHaveBeenCalled();
 });
 it('empty authorized data remains a successful empty snapshot and every call reads fresh totals',async()=>{
  const result={periodDays:90,indicators:[] as any[]};const h=harness({result});expect((await (await h.run()).json()).indicators).toEqual([]);
  result.indicators.push({module:'enade',action:'opened',total:7});expect((await (await h.run()).json()).indicators[0].total).toBe(7);
  result.indicators=[];expect((await (await h.run()).json()).indicators).toEqual([]);expect(h.fetcher).toHaveBeenCalledTimes(3);
 });
 it('passes all seven superior modules, whitelists fields and drops untrusted notice',async()=>{
  const indicators=['oab','oab2','carreiras','cfc','enade','enamed','residencia'].map(module=>({module,action:'opened',total:1,studentId:'SECRET'}));
  const r=await harness({result:{periodDays:90,indicators,notice:'SECRET'}}).run();expect(r.status).toBe(200);expect(await r.text()).not.toContain('SECRET');
 });
 it.each([
  {periodDays:89,indicators:[]},{periodDays:90,indicators:null},
  ...[null,{module:'enem',action:'opened',total:1},{module:'admin',action:'opened',total:1},
   {module:'oab',action:'mastered',total:1},...[-1,0.5,'1',Number.MAX_SAFE_INTEGER+1].map(total=>({module:'oab',action:'opened',total}))].map(row=>({periodDays:90,indicators:[row]})),
  {periodDays:90,indicators:Array(25).fill({module:'oab',action:'opened',total:1})},
  {periodDays:90,indicators:Array(2).fill({module:'oab',action:'opened',total:1})}
 ])('rejects malformed aggregates without creating a snapshot: %j',async result=>expect((await harness({result}).run()).status).toBe(502));
 it('rejects superior data from school endpoint and malformed envelope without logging body',async()=>{
  expect((await harness({tier:'escolas',result:{periodDays:90,indicators:[{module:'enamed',action:'opened',total:1}]}}).run()).status).toBe(502);
  const h=harness({raw:{secret:'SECRET'}});expect((await h.run()).status).toBe(502);expect(h.logger.error).not.toHaveBeenCalled();
 });
});
