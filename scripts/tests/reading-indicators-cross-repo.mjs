// Local-only contract exercise with the REAL F&O provider and a synthetic PostgreSQL.
// Usage (no network or production credentials):
// FATO_ORDEM_SOURCE=/path/to/fato-e-ordem VERTICE_TEST_RUNTIME=/path/to/composed-build/package.json node scripts/tests/reading-indicators-cross-repo.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {randomUUID,webcrypto} from 'node:crypto';
assert(process.env.FATO_ORDEM_SOURCE,'Set FATO_ORDEM_SOURCE to the inspected F&O checkout');
const source=path.resolve(process.env.FATO_ORDEM_SOURCE);
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(path.resolve(process.env.VERTICE_TEST_RUNTIME||'package.json'));
const ts=require('typescript');
const sourceRequire=createRequire(path.join(source,'package.json'));
const {PGlite}=sourceRequire('@electric-sql/pglite');
const {VerticeLearningBridge,handleVerticeBridgeApi}=await import(pathToFileURL(path.join(source,'src/vertice-learning-bridge.mjs')));
const db=new PGlite();
const ies='00000000-0000-4000-8000-000000000001',school='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003';
const actor='00000000-0000-4000-8000-000000000004',key='synthetic-bridge-secret-only-for-local-tests-2026';
let assertions=0;
function check(actual,expected){assert.deepEqual(actual,expected);assertions++;}
try{
 await db.exec(`CREATE TABLE fo_vertice_tenants(institution_id uuid PRIMARY KEY,enabled boolean,education_tier text);
  CREATE TABLE fo_vertice_student_links(student_id text,institution_id uuid,verified_course_id text,verified_at timestamptz,revoked_at timestamptz);`);
 await db.exec(readFileSync(path.join(source,'db/migrations/941_study_readings.sql'),'utf8'));
 for(const [id,tier] of [[ies,'superior'],[school,'escolas'],[other,'superior']])await db.query('INSERT INTO fo_vertice_tenants VALUES($1,true,$2)',[id,tier]);
 const link=async(student,inst,{course='course',verified=true,revoked=false}={})=>db.query(`INSERT INTO fo_vertice_student_links VALUES($1,$2,$3,CASE WHEN $4 THEN now()-interval '10 days' ELSE null END,CASE WHEN $5 THEN now() ELSE null END)`,[student,inst,course,verified,revoked]);
 const event=async(student,module,action='declared_read',age='1 day')=>db.query(`INSERT INTO fo_study_reading_events(id,student_id,module,item_id,topic,stage,purpose,reference_key,action,created_at) VALUES($1,$2,$3,'synthetic-item','Tema sintético','objetiva','aprofundamento','synthetic-reference',$4,now()-$5::interval)`,[randomUUID(),student,module,action,age]);
 await link('student-a',ies);await link('student-school',school);await link('student-other',other);
 await link('long-verified',ies);
 await db.query("UPDATE fo_vertice_student_links SET verified_at=now()-interval '100 days' WHERE student_id='long-verified'");
 await link('pending',ies,{verified:false});await link('revoked',ies,{revoked:true});await link('no-course',ies,{course:null});
 for(const module of ['oab','oab2','carreiras','cfc','enade','enamed','residencia'])await event('student-a',module);
 await event('student-a','oab','displayed');await event('student-a','oab','opened');await event('student-school','enem');
 // These records must never reach IES A's superior snapshot.
 await event('student-a','enem');await event('student-school','enamed');await event('student-other','oab');
 for(const student of ['pending','revoked','no-course'])await event(student,'oab');
 await event('student-a','oab','declared_read','11 days');await event('long-verified','oab','declared_read','91 days');
 const bridge=new VerticeLearningBridge({pool:db,piiSecret:key,identityKey:key,apiKey:key});
 async function provider(url,options){
  let output;
  try{
   await handleVerticeBridgeApi({request:{method:'GET',headers:options.headers},response:{},url,
    service:bridge,sendJson:(_res,status,body)=>{output=Response.json(body,{status});}});
  }catch(error){output=Response.json({error:error.message},{status:error.status||500});}
  return output;
 }
 let handler;
 const admin={auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},from:table=>{
  let id;const q={select:()=>q,eq:(name,value)=>{if(name==='id')id=value;return q;},maybeSingle:async()=>({data:table==='vertice_admins'?{user_id:actor}:table==='vertice_institutions'?{tier:id===school?'escolas':'superior'}:null,error:null})};return q;
 },rpc:()=>assert.fail('Reading consumption must not mutate metrics or other tables')};
 const code=ts.transpile(readFileSync(path.join(repository,'supabase/functions/vertice-learning-bridge/index.ts'),'utf8').replace(/^import .*\n/,''),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None});
 vm.runInNewContext(code,{Deno:{env:{get:name=>({SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic',VERTICE_BRIDGE_API_KEY:key})[name]},serve:fn=>handler=fn},createClient:()=>admin,fetch:provider,TextEncoder,Response,Request,URL,URLSearchParams,AbortSignal,atob,Date,console,crypto:webcrypto});
 const jwt='header.'+Buffer.from(JSON.stringify({sub:actor,aal:'aal2'})).toString('base64url')+'.signature';
 const consume=async inst=>{
  const response=await handler(new Request('https://fixture.test',{method:'POST',headers:{authorization:'Bearer '+jwt,'content-type':'application/json'},body:JSON.stringify({operation:'reading_indicators',institutionId:inst})}));
  return {status:response.status,data:await response.json()};
 };
 const first=await consume(ies);check(first.status,200);check(first.data.indicators.length,9);
 check(first.data.indicators.find(row=>row.module==='oab'&&row.action==='declared_read').total,1);
 check(first.data.indicators.some(row=>row.module==='enem'),false);
 check(first.data.indicators.every(row=>Object.keys(row).sort().join(',')==='action,module,total'),true);
 check((await consume(school)).data.indicators,[{module:'enem',action:'declared_read',total:1}]);
 check((await consume(other)).data.indicators,[{module:'oab',action:'declared_read',total:1}]);
 await event('student-a','oab');check((await consume(ies)).data.indicators.find(row=>row.module==='oab'&&row.action==='declared_read').total,2);
 await db.query("UPDATE fo_vertice_student_links SET revoked_at=now() WHERE student_id='student-a'");
 check((await consume(ies)).data.indicators,[]);
 await db.query('UPDATE fo_vertice_tenants SET enabled=false WHERE institution_id=$1',[school]);check((await consume(school)).status,502);
 const direct=async(pathname,inst,secret=key)=>provider(new URL('https://www.fatoeordem.com.br/api/internal/vertice/'+pathname+'?institutionId='+inst),{headers:{'x-vertice-bridge-key':secret}});
 check((await direct('reading-indicators',ies,'wrong')).status,403);
 check((await direct('school-reading-indicators',ies)).status,403);
 check((await direct('reading-indicators',other)).status,200);
 console.log(JSON.stringify({result:'PASS',assertions,syntheticOnly:true,networkRequests:0,source:'real F&O bridge + real reading SQL + Vértice Edge handler',coverage:['90-day window','verified course','pending link','revoked link','pre-verification event','cross-institution','superior/school separation','all 8 modules','fresh update','revocation clears data','disabled tenant','internal key','segment mismatch','no metric writes']},null,2));
}finally{await db.close();}
