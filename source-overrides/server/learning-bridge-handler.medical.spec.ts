import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const institution='00000000-0000-4000-8000-000000000001';
const user='00000000-0000-4000-8000-000000000002';
const jwt='header.'+Buffer.from(JSON.stringify({sub:user,aal:'aal2'})).toString('base64url')+'.signature';
const code=ts.transpile(readFileSync('supabase/functions/vertice-learning-bridge/index.ts','utf8').replace(/^import .*\n/,''),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None});
function harness({school=false,module='enamed',ingestError=false,remoteError=false,malformed=false,emptyMore=false}={}){
 let handler:any;
 const calls:{name:string;args:any}[]=[];
 const after='2026-11-12T12:00:00.123456Z';
 const page:any={events:[{module,eventId:module+':fixture',occurredAt:after}],hasMore:false,nextCursor:{after,afterId:module+':fixture'}};
 if(malformed)page.nextCursor.after='invalid';
 if(emptyMore){page.events=[];page.hasMore=true;}
 const rpc=async(name:string,args:any)=>{calls.push({name,args});return {data:name==='vertice_bridge_read_cursor'?{after:'2000-01-01T00:00:00Z',afterId:''}:name==='vertice_bridge_ingest_events'?{inserted:1,ignored:0}:{published_groups:0},error:ingestError&&name==='vertice_bridge_ingest_events'?{}:null};};
 const client={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},rpc,from:(name:string)=>{
  const chain:any={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:name==='vertice_admins'?{user_id:user}:{tier:school?'escolas':'superior'},error:null})};return chain;
 }};
 const fetcher=vi.fn(async(url:URL)=>{
  if(url.pathname.endsWith('/candidates'))return Response.json({result:{complete:true,records:[]}});
  return remoteError?new Response('synthetic outage',{status:503}):Response.json({result:page});
 });
 vm.runInNewContext(code,{Deno:{env:{get:(key:string)=>({SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic',VERTICE_BRIDGE_API_KEY:'a'.repeat(40),VERTICE_BRIDGE_IDENTITY_KEY:'b'.repeat(40)})[key]},serve:(fn:any)=>handler=fn},createClient:()=>client,fetch:fetcher,TextEncoder,Response,Request,URL,URLSearchParams,AbortSignal,atob,console:{error:vi.fn()},crypto:globalThis.crypto});
 return {calls,fetcher,after,run:(extra:any={})=>handler(new Request('https://fixture.test',{method:'POST',headers:{authorization:'Bearer '+jwt,'content-type':'application/json'},body:JSON.stringify({operation:school?'sync_enem':'sync',institutionId:institution,...extra})}))};
}
describe('medical and school bridge synchronization',()=>{
 it.each(['enamed','residencia'])('persists %s before committing exact microsecond cursor',async module=>{
  const h=harness({module});const response=await h.run();expect(response.status,await response.text()).toBe(200);
  const names=h.calls.map(c=>c.name);expect(names.indexOf('vertice_bridge_ingest_events')).toBeLessThan(names.indexOf('vertice_bridge_commit_cursor'));
  expect(h.calls.find(c=>c.name==='vertice_bridge_commit_cursor')?.args.p_after).toBe(h.after);
 });
 it('uses school-events with identical timestamp precision',async()=>{
  const h=harness({school:true,module:'enem'});const response=await h.run();expect(response.status,await response.text()).toBe(200);
  expect(h.fetcher.mock.calls.some(([url])=>url.pathname.endsWith('/school-events'))).toBe(true);
  expect(h.calls.find(c=>c.name==='vertice_bridge_commit_cursor')?.args.p_after).toBe(h.after);
 });
 it.each([{school:false,module:'enem'},{school:true,module:'enamed'}])('rejects cross-segment source pages %j',async options=>{
  const h=harness(options);expect((await h.run()).status).toBe(502);expect(h.calls.some(c=>c.name==='vertice_bridge_ingest_events'||c.name==='vertice_bridge_commit_cursor')).toBe(false);
 });
 it.each([{ingestError:true},{remoteError:true},{malformed:true},{emptyMore:true}])('does not advance cursor on failed or malformed page %j',async options=>{
  const h=harness(options);expect((await h.run()).status).toBe('ingestError' in options?422:502);
  expect(h.calls.some(c=>c.name==='vertice_bridge_commit_cursor')).toBe(false);
 });
 it('requires explicit review before historical replay',async()=>{
  const h=harness();expect((await h.run({replay:true})).status).toBe(400);expect(h.fetcher).not.toHaveBeenCalled();expect(h.calls).toHaveLength(0);
 });
 it('replays only the authenticated institution with review',async()=>{
  const h=harness();expect((await h.run({replay:true,reviewed:true})).status).toBe(200);
  expect(h.calls[0]).toEqual({name:'vertice_bridge_reset_cursor',args:{p_institution:institution}});
 });
 it('does not reset history on ordinary sync',async()=>{
  const h=harness();await h.run();expect(h.calls.some(c=>c.name==='vertice_bridge_reset_cursor')).toBe(false);
 });
 it('rejects the wrong synchronization operation for each segment',async()=>{
  expect((await harness().run({operation:'sync_enem'})).status).toBe(403);
  expect((await harness({school:true,module:'enem'}).run({operation:'sync'})).status).toBe(403);
 });
});
