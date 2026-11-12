/** Local integration only. Public PDF + production handler/backend/parser + in-memory PostgreSQL.
 * Auth and storage transport are local adapters; provider is explicitly SIMULATED.
 * No remote credentials, no network, no production writes, no paid inference.
 * Run: PREANALYSIS_PARSER_PACKAGE_JSON=/path/package.json PGLITE_MODULE=/path/index.js
 *      node --experimental-transform-types scripts/test-preanalysis-public-local.ts /path/public.pdf
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire,registerHooks} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createPreanalysisHandler} from '../supabase/functions/_shared/preanalysis-handler.ts';
import {makePreanalysisBackend} from '../supabase/functions/_shared/preanalysis-backend.ts';
import {hash} from '../supabase/functions/_shared/preanalysis-core.ts';
import {CANARY_MIGRATION_PATH,buildCanaryMigration,assertCanaryScope} from './build-preanalysis-migration.mjs';
const parser=createRequire(process.env.PREANALYSIS_PARSER_PACKAGE_JSON||resolve('scripts/tests/preanalysis-runtime/package.json'));
registerHooks({resolve(specifier,context,next){
 const packages={'npm:fflate@0.8.3':'fflate','npm:fast-xml-parser@5.12.0':'fast-xml-parser','npm:unpdf@2.1.0':'unpdf'};
 if(packages[specifier]){const entry=parser.resolve(packages[specifier]);return {url:pathToFileURL(specifier.includes('fast-xml-parser')?entry.replace(/lib\/fxp\.cjs$/,'src/fxp.js'):entry.replace(/lib\/node\.cjs$/,'esm/index.mjs')).href,shortCircuit:true};}return next(specifier,context);
}});
// Fail closed on accidental use of any real HTTP transport, including a provider.
globalThis.fetch=async()=>{throw new Error('NETWORK_FORBIDDEN_LOCAL_INTEGRATION');};
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
const root=new URL('../',import.meta.url);
const sql=(p:string)=>readFileSync(new URL(p,root),'utf8');
const migrationSQL=sql(CANARY_MIGRATION_PATH);
assert.equal(migrationSQL,buildCanaryMigration(sql('docs/sql/preanalysis-v2.sql')));assertCanaryScope(migrationSQL);
const migrationHash=createHash('sha256').update(migrationSQL).digest('hex');
const exec=(q:string)=>db.exec(q);
const I='22000000-0000-4000-8000-000000000001',U='12000000-0000-4000-8000-000000000001',C='32000000-0000-4000-8000-000000000001',D='42000000-0000-4000-8000-000000000002';
const S='62000000-0000-4000-8000-000000000001',EXP=Math.floor(Date.now()/1000)+3600;
const filePath=process.argv[2];assert(filePath,'Pass the locally materialized public IFPB PDF path');
const bytes=new Uint8Array(readFileSync(filePath));
const fileHash=createHash('sha256').update(bytes).digest('hex');
assert.equal(fileHash,'bbac97390a8f7a878fda6b50e92aa41e3f19d2cb3657fe05009050980aa77768');
const catalog=JSON.parse(sql('supabase/functions/_shared/preanalysis-catalog.json'));
const storagePath=`${I}/public-reference/inep-2017.pdf`;
const checks:string[]=[];let providerCalls=0,storageReads=0;const rpcCalls:string[]=[];
try {
 await exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 grant usage on schema auth to authenticated,service_role;grant execute on all functions in schema auth to authenticated,service_role;`);
 await exec(sql('supabase/migrations/202610260001_access_foundation.sql'));
 // Existing production schema usage is prerequisite fixture setup, not part of this migration.
 await exec('grant usage on schema vertice_private to service_role');
 const area=sql('supabase/migrations/202610300001_area_real.sql');
 const start=area.indexOf('create or replace function vertice_private.member_role(');
 await exec(area.slice(start,area.indexOf('$$;',start)+3));
 // Synthetic-only prerequisite mirrors the verified private helper, never remote auth state.
 await exec(`create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
 create function vertice_private.ai_live_session(person uuid,session uuid) returns boolean
 language plpgsql stable security definer set search_path='' as $$ declare valid boolean; begin
 if person is null or session is null or to_regclass('auth.sessions') is null then return false; end if;
 execute 'select exists(select 1 from auth.sessions s where id=$1 and user_id=$2 and ((to_jsonb(s)->>''not_after'') is null or (to_jsonb(s)->>''not_after'')::timestamptz>clock_timestamp()))' into valid using session,person;
 return coalesce(valid,false); end; $$;
 revoke all on function vertice_private.ai_live_session(uuid,uuid) from public,anon,authenticated,service_role;`);
 // Minimal synthetic source schema models the confirmed live columns; not a claim of live replay.
 await exec(`alter table public.vertice_institutions add tier text not null default 'superior';
 create schema storage;create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,updated_at timestamptz default now(),last_accessed_at timestamptz);
 create table public.vertice_documents(id uuid primary key,institution_id uuid,course_id uuid,storage_path text,file_name text,file_size bigint,mime_type text,sha256 text,status text,segment text,superseded_by uuid,version_number int,ai_status text);
 create table public.vertice_repository_requests(id uuid primary key,institution_id uuid,course_id uuid,active boolean default true,not_applicable boolean default false,repository_section text);
 create table public.vertice_repository_files(id uuid primary key,institution_id uuid,request_id uuid,storage_path text,file_name text,size_bytes bigint,mime_type text,status text);
 create table public.vertice_goals(id uuid primary key,institution_id uuid,course_id uuid,title text,owner_name text,notes text,direction text,baseline numeric,target numeric,due_date date,frequency text,status text);`);
 await exec(`alter table public.vertice_goals add unit text, add baseline_date date;
 create table public.vertice_goal_measurements(id uuid primary key,institution_id uuid,goal_id uuid,measured_on date,value numeric,source text,note text);
 create table public.vertice_actions(id uuid primary key,institution_id uuid,course_id uuid,goal_id uuid,finding_id uuid,start_date date,due_date date,status text,progress integer,who text,how_much text,evidence text);
 create table public.vertice_diagnosis_items(id uuid primary key,institution_id uuid,course_id uuid,assessed_on date,priority text,status text,score numeric,finding text);
 create table public.vertice_enrollment_snapshots(id uuid primary key,institution_id uuid,course_id uuid,semester text,enrolled integer,capacity integer,available integer,reported_total integer,source_report_at timestamptz,student_status text,class_label text,source_url text);`);
 await exec(migrationSQL);
 await db.query('insert into auth.users values($1,$2)',[U,'synthetic-manager@example.invalid']);
 await db.query('insert into auth.sessions values($1,$2,null)',[S,U]);
 await db.query('insert into public.vertice_institutions(id,name,tier) values($1,$2,$3)',[I,'Fictional local institution','superior']);
 await db.query('insert into public.vertice_memberships(user_id,institution_id,role) values($1,$2,$3)',[U,I,'gestor']);
 await db.query('insert into public.vertice_courses(id,institution_id,name) values($1,$2,$3)',[C,I,'Fictional local course']);
 await db.query('insert into public.vertice_documents values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,null,1,null)',[D,I,C,storagePath,'inep-2017.pdf',bytes.length,'application/pdf',fileHash,'pending','superior']);
 await db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)', ['vertice-documents',storagePath,JSON.stringify({size:bytes.length,mimetype:'application/pdf'})]);
 await db.query('insert into vertice_private.preanalysis_policy(institution_id,enabled,provider,model,daily_limit) values($1,true,$2,$3,10)',[I,'simulated-local-provider','deterministic-reference-only-v1']);
 const sourceRowsBefore=(await db.query('select (select jsonb_agg(to_jsonb(d)) from public.vertice_documents d) documents,(select jsonb_agg(to_jsonb(o)) from storage.objects o) objects')).rows[0];
 const rpcArgs={vertice_preanalysis_source:['p_institution','p_source_table','p_source_id'],vertice_preanalysis_policy:['p_institution'],vertice_preanalysis_reserve:['p_institution','p_source_table','p_source_id','p_source_version','p_request_hash','p_catalog_hash','p_provider','p_model'],vertice_preanalysis_finalize:['p_run_id','p_expected_actor','p_request_hash','p_result','p_error_code'],vertice_preanalysis_review:['p_run_id','p_object_key','p_decision','p_reason']};
 async function asRole(service=false){await exec(`reset role;set role ${service?'service_role':'authenticated'}`);await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(service?{role:'service_role'}:{sub:U,aal:'aal2',role:'authenticated',session_id:S,exp:EXP})]);}
 const localTransport:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.origin,'https://local-fixture.supabase.co');
  if(url.pathname==='/auth/v1/user')return Response.json({id:U,is_anonymous:false});
  if(url.pathname.startsWith('/storage/')){assert.equal(url.pathname,`/storage/v1/object/authenticated/vertice-documents/${storagePath}`);storageReads++;return new Response(bytes,{headers:{'content-length':String(bytes.length)}});}
  const service=(init?.headers as any)?.Authorization==='Bearer local-service-not-a-credential';
  await asRole(service);
  try{
   if(url.pathname.startsWith('/rest/v1/rpc/')){
    const name=url.pathname.split('/').at(-1)!;assert(name in rpcArgs);rpcCalls.push(name);
    const body=JSON.parse(String(init?.body));const args=rpcArgs[name].map(k=>body[k]);
    const out=await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) v`,args.map(v=>v&&typeof v==='object'?JSON.stringify(v):v));
    return Response.json(out.rows[0].v);
   }
   if(url.pathname==='/rest/v1/vertice_evidence_preanalysis_runs')return Response.json((await db.query('select id,state,result,error_code,source_version,created_at,provider,model from public.vertice_evidence_preanalysis_runs where institution_id=$1 and source_table=$2 and source_id=$3 order by created_at desc limit 10',[I,'vertice_documents',D])).rows);
   if(url.pathname==='/rest/v1/vertice_evidence_preanalysis_decisions')return Response.json((await db.query('select run_id,object_key,decision,reason,created_at,validation_status,audit_sequence from public.vertice_evidence_preanalysis_decisions where institution_id=$1 order by audit_sequence desc limit 500',[I])).rows);
   throw new Error('Unknown local route: '+url.pathname);
  }catch(e){if(e.code)return Response.json({code:e.code},{status:400});throw e;}
 };
 const backend=makePreanalysisBackend('Bearer local-actor-not-a-credential',k=>({SUPABASE_URL:'https://local-fixture.supabase.co',SUPABASE_ANON_KEY:'local-anon-not-a-credential',SUPABASE_SERVICE_ROLE_KEY:'local-service-not-a-credential'}[k]),localTransport);
 let noCorrelation=false;
 const handler=createPreanalysisHandler({backend:()=>backend,catalog,enabled:()=>true,sourceRefPermitted:()=>true,processingScope:()=>({expectedContentHash:fileHash}),apiKey:()=> 'simulated-no-secret',provider:async(policy,chunks)=>{
  assert.equal(policy.provider,'simulated-local-provider');providerCalls++;
  if(noCorrelation)return {summary:'Simulação sem correlação: referência normativa não comprova prática institucional.',correlation:'none',links:[],gaps:['Nenhuma evidência da instituição foi fornecida.'],limitations:['Resposta simulada, sem inferência real.']};
  const chunk=chunks[0];const at=chunk.text.indexOf('3.6');assert(at>=0);
  return {summary:'Simulação: referência normativa sobre bibliografia, sem prova institucional.',correlation:'potential',links:[{objectKey:'reconhecimento_curso:2017::3.6',compatibility:'baixa',justification:'Documento de referência normativa apenas. Não comprova acervo, acesso ou atendimento pela instituição fictícia.',quotes:[{chunkId:chunk.id,text:chunk.text.slice(at,at+300)}],limitations:['A correspondência é apenas temática; nenhuma evidência institucional foi apresentada.']}],gaps:['Solicitar evidência própria da instituição.'],limitations:['Resposta determinística simulada, não produzida por IA.','Instrumento regulatório não é evidência de execução institucional.']};
 }});
 const ref={institution_id:I,source_table:'vertice_documents',source_id:D};
 async function send(body:any){const response=await handler(new Request('https://local.invalid',{method:'POST',headers:{authorization:'Bearer local-actor-not-a-credential'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};}
 const preview=await send(ref);assert.equal(preview.status,200,JSON.stringify(preview.body));
 const p=preview.body;assert.equal(p.extraction_status,'ready_with_gaps');assert.equal(p.document_coverage,'partial_text');assert.equal(p.page_coverage.length,54);
 const gaps=p.page_coverage.filter(x=>x.status==='no_text_requires_review').map(x=>x.page);assert.deepEqual(gaps,[6,10,44,52,53]);assert.equal(p.page_coverage.filter(x=>x.status==='text').length,49);
 assert.equal(providerCalls,0);assert.equal(p.providerTransmission,false);assert.equal(p.content_hash,fileHash);checks.push('Real PDF preview accounts for all 54 pages: 49 text and 5 unresolved, no provider invocation');
 const chunk=p.chunks.find(c=>c.text.includes('3.6')&&c.text.toLowerCase().includes('bibliograf'));assert(chunk,'Actual 3.6 bibliographic excerpt exists');
 const body={...ref,action:'analyze',preview_digest:p.preview_digest,privacy_confirmed:true,selections:[{id:chunk.id,text:chunk.text}]};
 const missingAck=await send(body);assert.equal(missingAck.body.error,'partial_coverage_unconfirmed');assert.equal(providerCalls,0);checks.push('Partial coverage without acknowledgement is blocked before provider');
 const confirmed={...body,coverage_acknowledged:true};const analysis=await send(confirmed);assert.equal(analysis.status,200,JSON.stringify(analysis.body));assert.equal(analysis.body.state,'completed');assert.equal(providerCalls,1);
 const result=analysis.body.result,runId=analysis.body.run_id;assert.match(result.links[0].justification,/referência normativa apenas/);assert.match(result.links[0].justification,/Não comprova/);assert.equal(result.links[0].compatibility,'baixa');assert.equal(result.links[0].quotes[0].page,chunk.page);assert.equal(result.provenance.contentHash,fileHash);assert.equal(result.provenance.pageCoverage.length,54);assert.equal(result.provenance.selectedChunkHashes[0].sha256,await hash(chunk.text));assert.equal(result.provenance.coverageAcknowledged,true);assert.match(result.limitations.join(' '),/não representam leitura integral/);checks.push('Confirmed selected excerpt persisted with real page, content/catalog/selection hashes and partial-reading limitations');
 const repeated=await send(confirmed);assert.equal(repeated.body.reused,true);assert.equal(repeated.body.run_id,runId);assert.equal(providerCalls,1);checks.push('Identical repeated analysis reuses SQL reservation without another simulated provider call');
 const objectKey=result.links[0].objectKey;
 const accepted=await send({action:'review',run_id:runId,object_key:objectKey,decision:'accepted',reason:'Simulated manager accepts thematic reference only, not institutional evidence.'});assert.equal(accepted.status,200,JSON.stringify(accepted.body));assert.equal(accepted.body.review.validation_status,'pending');
 const rejected=await send({action:'review',run_id:runId,object_key:objectKey,decision:'rejected',reason:'No institutional evidence; preserve initial acceptance in audit.'});assert.equal(rejected.status,200);
 const history=await send({...ref,action:'history'});assert.equal(history.status,200);assert.equal(history.body.runs[0].decisions.length,2);assert.deepEqual(history.body.runs[0].decisions.map(x=>x.decision),['rejected','accepted']);checks.push('Manager acceptance remains validation pending; later rejection preserves append-only decisions');
 noCorrelation=true;
 const secondChunk=p.chunks.find(c=>c.id!==chunk.id&&!c.sensitive_flags.length);assert(secondChunk);
 const none=await send({...confirmed,selections:[{id:secondChunk.id,text:secondChunk.text}]});assert.equal(none.status,200,JSON.stringify(none.body));assert.equal(none.body.result.correlation,'none');assert.equal(none.body.result.links.length,0);assert.equal(providerCalls,2);checks.push('Separate selected excerpt allows explicit no-correlation result without fabricated links');
 await exec('reset role');
 const beforeChange=(await db.query('select id,state,provider,model,request_hash,catalog_hash,result from public.vertice_evidence_preanalysis_runs order by created_at')).rows;
 assert.equal(beforeChange.length,2);for(const row of beforeChange){assert.equal(row.provider,'simulated-local-provider');assert.equal(row.model,'deterministic-reference-only-v1');assert.match(row.request_hash,/^[a-f0-9]{64}$/);assert.equal(row.catalog_hash,row.result.provenance.catalogHash);}
 assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,1);assert.equal((await db.query('select count(*)::int n from public.vertice_documents')).rows[0].n,1);assert.equal((await db.query('select count(*)::int n from public.vertice_repository_files')).rows[0].n,0);checks.push('Acceptance creates only logical reference; no copied document/storage object or repository file');
 assert.deepEqual((await db.query('select (select jsonb_agg(to_jsonb(d)) from public.vertice_documents d) documents,(select jsonb_agg(to_jsonb(o)) from storage.objects o) objects')).rows[0],sourceRowsBefore);
 assert.equal((await db.query("select count(*)::int n from pg_trigger where tgrelid in ('public.vertice_documents'::regclass,'storage.objects'::regclass,'public.vertice_repository_files'::regclass,'public.vertice_institutions'::regclass,'public.vertice_courses'::regclass) and tgname='preanalysis_source_event'")).rows[0].n,0);checks.push('Exact minimal canary leaves existing document/storage rows unchanged and installs no source-event triggers');
 await db.query('update public.vertice_documents set version_number=2 where id=$1',[D]);
 const stale=await send({action:'review',run_id:runId,object_key:objectKey,decision:'accepted',reason:'Must fail on changed source version.'});assert.equal(stale.status,409);assert.equal(stale.body.error,'source_changed');
 const changed=await send(confirmed);assert.equal(changed.body.error,'preview_changed_or_unconfirmed');assert.equal(providerCalls,2);checks.push('Source revision blocks stale review and stale preview without provider call');
 await exec('reset role');
 const decisions=(await db.query('select run_id,object_key,decision,validation_status,audit_sequence from public.vertice_evidence_preanalysis_decisions order by audit_sequence')).rows;
 assert.equal(decisions.length,2);
 const report={status:'passed',providerMode:'simulated',paidInference:false,networkCalls:0,productionChanges:false,migration:{path:CANARY_MIGRATION_PATH,sha256:migrationHash,...assertCanaryScope(migrationSQL)},persistence:'Actual PGlite PostgreSQL RPCs, in-memory database',source:{kind:'public regulatory reference, not institutional evidence',sha256:fileHash,bytes:bytes.length,pages:54,textPages:49,unresolvedPages:gaps,selectedPage:chunk.page,selectedQuote:result.links[0].quotes[0],catalogObject:objectKey},runs:beforeChange.map(r=>({id:r.id,state:r.state,provider:r.provider,model:r.model,requestHash:r.request_hash,catalogHash:r.catalog_hash,provenance:r.result.provenance,simulatedResult:{summary:r.result.summary,correlation:r.result.correlation,links:r.result.links,limitations:r.result.limitations}})),decisions,providerCalls,storageReads,rpcCalls:rpcCalls.reduce((a,n)=>(a[n]=(a[n]||0)+1,a),{}),assertions:checks,limitations:['Provider and authentication are simulated; this does not validate real model quality, hosted Supabase deployment, real authentication or live storage policies.','PGlite stores real PostgreSQL rows only within this local process; report is the durable artifact.','Five unresolved pages are not asserted blank; visual/OCR review remains outstanding.','Regulatory reference is not evidence of institutional compliance.']};
 writeFileSync(new URL('docs/preanalysis-public-local-result.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,providerMode:report.providerMode,pages:54,checks:checks.length,runs:beforeChange.length,decisions:decisions.length,providerCalls}));
} finally {await db.close();}
