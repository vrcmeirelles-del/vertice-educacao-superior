import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const institution='00000000-0000-4000-8000-000000000001';
const user='00000000-0000-4000-8000-000000000002';
const course='00000000-0000-4000-8000-0000000000c1';
const tokA='a'.repeat(64),tokB='b'.repeat(64),tokX='c'.repeat(64);
const code=ts.transpile(readFileSync('supabase/functions/vertice-learning-bridge/index.ts','utf8').replace(/^import .*\n/,''),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None});
const student=(token:string,status:string,extra:Record<string,unknown>={})=>({studentToken:token,courseId:course,
 engagement:{status,lastActivityAt:'2026-11-10T10:00:00Z',answersLast7Days:3,answersPrevious7Days:12,activeDaysLast14:4,pausesAcceptedLast14Days:0},
 diagnostics:[],prescriptions:[],...extra});
const feed=(extra:Record<string,unknown>={})=>({contractVersion:'v1',institutionId:institution,educationTier:'superior',generatedAt:'2026-11-19T09:00:00Z',
 students:[student(tokA,'ativo'),student(tokB,'sem_atividade',{
  diagnostics:[{code:'E-CONT-01',label:'Lacuna de base',family:'Conteúdo',competency:{kcId:'DC-05',discipline:'Direito Civil',theme:'Contratos'},since:'2026-11-18T00:00:00Z',sampleSize:12}],
  prescriptions:[{rule:'P-009',label:null,diagnosticCode:'E-CONT-01',since:'2026-11-18T00:00:00Z',deadline:null}]}),student(tokX,'em_queda')],...extra});
function harness(options:{tier?:string;role?:string;result?:unknown;remoteStatus?:number}={}){
 let handler:any;
 const rpc=vi.fn(async(name:string,args:any)=>{
  expect(name).toBe('vertice_sapiens_signal_roster');expect(args.p_institution).toBe(institution);
  return {data:[{student_token:tokA+' ',course_id:course,course_name:'Direito',enrollment_ref:'2024001'},{student_token:tokB,course_id:course,course_name:'Direito',enrollment_ref:'2024002'}],error:null};
 });
 const client={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},rpc,from:(table:string)=>{
  const chain:any={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:table==='vertice_admins'?null:table==='vertice_memberships'?{role:options.role??'reitor'}:{tier:options.tier??'superior'},error:null})};return chain;
 }};
 const fetcher=vi.fn(async(url:URL)=>{expect(String(url)).toContain('/api/internal/vertice/sapiens-feed?institutionId='+institution);
  return options.remoteStatus?new Response('SECRET',{status:options.remoteStatus}):Response.json({result:options.result??feed()});});
 vm.runInNewContext(code,{Deno:{env:{get:(key:string)=>({SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic',VERTICE_BRIDGE_API_KEY:'a'.repeat(40)})[key]},serve:(fn:any)=>handler=fn},createClient:()=>client,fetch:fetcher,TextEncoder,Response,Request,URL,URLSearchParams,AbortSignal,atob,Date,console:{error:vi.fn()}});
 const jwt='header.'+Buffer.from(JSON.stringify({sub:user,aal:'aal2'})).toString('base64url')+'.signature';
 return {rpc,fetcher,run:(extra:Record<string,unknown>={})=>handler(new Request('https://fixture.test',{method:'POST',headers:{authorization:'Bearer '+jwt,'content-type':'application/json'},body:JSON.stringify({operation:'sapiens_signals',institutionId:institution,...extra})}))};
}
describe('sinais do Sapiens no Vértice',()=>{
 it('traduz token em matrícula, ordena por prioridade e nunca repassa o token',async()=>{
  const h=harness();const r=await h.run();expect(r.status).toBe(200);const data=await r.json();
  expect(data.students.map((s:any)=>[s.enrollmentRef,s.engagement.status])).toEqual([['2024002','sem_atividade'],['2024001','ativo']]);
  expect(data.unmatched).toBe(1);
  // totais agregados incluem o vínculo sem matrícula (em_queda)
  expect(data.summary).toEqual({ativo:1,em_queda:1,sem_atividade:1,nunca_iniciou:0,comDiagnostico:1,comPrescricao:1});
  expect(data.patterns).toEqual([{label:'Lacuna de base',discipline:'Direito Civil',theme:'Contratos',students:1}]);
  expect(data.students[0].prescriptions[0].label).toBe('P-009');
  expect(JSON.stringify(data)).not.toContain(tokA);expect(JSON.stringify(data)).not.toContain(tokB);
 });
 it('recusa filtros, envelope de outra instituição ou segmento e campos inválidos',async()=>{
  expect((await harness().run({courseId:course})).status).toBe(400);
  expect((await harness({result:feed({institutionId:'00000000-0000-4000-8000-000000000009'})}).run()).status).toBe(502);
  expect((await harness({result:feed({educationTier:'escolas'})}).run()).status).toBe(502);
  expect((await harness({result:feed({students:[student('xyz','ativo')]})}).run()).status).toBe(502);
  expect((await harness({result:feed({students:[student(tokA,'desconhecido')]})}).run()).status).toBe(502);
  expect((await harness({result:feed({students:[student(tokA,'ativo'),student(tokA,'ativo')]})}).run()).status).toBe(502);
 });
 it('falha da origem vira indisponibilidade, sem texto da origem',async()=>{
  const r=await harness({remoteStatus:500}).run();expect(r.status).toBe(502);expect(await r.text()).not.toContain('SECRET');
 });
 it('papel sem autorização institucional não consulta a origem',async()=>{
  const h=harness({role:'coordenador'});expect((await h.run()).status).toBe(403);expect(h.fetcher).not.toHaveBeenCalled();
 });
});
