// Run from the composed ZIP + source-overrides build with the locked isolated test runtime (PGlite 0.5.16; also checked on 0.5.8).
// node --test ../scripts/tests/learning-medical-replay.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(process.cwd()+'/package.json');
const {PGlite}=require('@electric-sql/pglite');
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const institution='00000000-0000-4000-8000-000000000001',school='00000000-0000-4000-8000-000000000002';
const course='00000000-0000-4000-8000-000000000003',schoolCourse='00000000-0000-4000-8000-000000000004',actor='00000000-0000-4000-8000-000000000005';
const files=['20261107223000_learning_connected_cpf_bridge.sql','20261107224500_learning_bridge_rpc.sql','20261107230000_learning_alignment_metrics.sql','20261107231000_learning_mapping_and_calendar.sql','20261107232000_learning_bridge_cursors.sql','20261112230000_learning_bridge_medical_modules.sql','20261112234500_learning_enem_schools_only.sql'];
const migration='20261113033000_learning_reviewed_module_mapping.sql';
const securitySQL=`SELECT n.nspname,c.relname,c.relrowsecurity,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','vertice_private') ORDER BY 1,2; SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies ORDER BY 1,2,3; SELECT p.proname,p.prosecdef,p.proconfig,p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'vertice_bridge_%' ORDER BY 1;`;
test('actual migrations: medical ingest, school isolation, reviewed module scope, idempotency and microsecond replay',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA vertice_private;
   CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$; CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
   CREATE TABLE public.vertice_institutions(id uuid PRIMARY KEY,tier text NOT NULL);
   CREATE TABLE public.vertice_courses(id uuid PRIMARY KEY,institution_id uuid REFERENCES public.vertice_institutions(id));
   CREATE FUNCTION vertice_private.can_read_institution(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
   CREATE FUNCTION vertice_private.has_role(uuid,text[]) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;`);
  for(const file of files)await db.exec(read('supabase/migrations/'+file));
  const securityBefore=await db.exec(securitySQL);
  await db.exec(read('supabase/migrations/'+migration));
  assert.deepEqual(await db.exec(securitySQL),securityBefore,'ACL, RLS, policies and security settings unchanged');
  await db.query('INSERT INTO public.vertice_institutions VALUES ($1,\'superior\'),($2,\'escolas\')',[institution,school]);
  await db.query('INSERT INTO public.vertice_courses VALUES ($1,$2),($3,$4)',[course,institution,schoolCourse,school]);
  await db.query('INSERT INTO auth.users VALUES ($1)',[actor]);
  for(let i=1;i<=5;i++)await db.query(`SELECT public.vertice_bridge_accept_roster($1,$2::jsonb)`,[institution,JSON.stringify([{studentToken:String(i).padStart(64,'0'),courseId:course,enrollmentRef:'synthetic-'+i,sourceLabel:'Synthetic verified fixture'}])]);
  await db.query(`SELECT public.vertice_bridge_accept_roster($1,$2::jsonb)`,[school,JSON.stringify([{studentToken:'f'.repeat(64),courseId:schoolCourse,enrollmentRef:'synthetic-school',sourceLabel:'Synthetic school fixture'}])]);
  await db.query(`SELECT public.vertice_bridge_accept_windows($1,$2::jsonb)`,[institution,JSON.stringify([{courseId:course,semester:'2026/2',startsOn:'2026-07-01',endsOn:'2026-12-31',sourceRef:'Synthetic official calendar'}])]);
  const events=[];
  for(const module of ['enamed','residencia'])for(let i=1;i<=5;i++)for(let q=1;q<=5;q++)events.push({studentToken:String(i).padStart(64,'0'),courseId:course,module,eventId:module+':synthetic:'+i+':'+q,itemId:(q%2?'booklet-a':'booklet-b')+':'+q,occurredAt:'2026-11-12T12:00:00.123456Z',graded:true,correct:q!==5,confidence:3,competency:null});
  const ingest=await db.query('SELECT public.vertice_bridge_ingest_events($1,$2::jsonb) AS r',[institution,JSON.stringify(events)]);
  assert.equal(ingest.rows[0].r.inserted,50);
  assert.equal((await db.query('SELECT public.vertice_bridge_ingest_events($1,$2::jsonb) AS r',[institution,JSON.stringify(events)])).rows[0].r.inserted,0);
  await db.query('SELECT public.vertice_bridge_refresh_metrics($1)',[institution]);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.vertice_learning_course_metrics')).rows[0].n,0,'no automatic mapping');
  for(const module of ['enamed','residencia'])await db.query('SELECT public.vertice_bridge_map_subject($1,$2,$3,$4,$5,$6,$7)',[institution,course,'SYNTHETIC',module,'*','Reviewed whole-module synthetic evidence',actor]);
  await db.query('SELECT public.vertice_bridge_refresh_metrics($1)',[institution]);
  const metrics=(await db.query('SELECT module,participants,attempts,correct,curricular_average,external_accuracy FROM public.vertice_learning_course_metrics ORDER BY module')).rows;
  assert.equal(metrics.length,2);for(const row of metrics){assert.equal(row.participants,5);assert.equal(row.attempts,25);assert.equal(row.correct,20);assert.equal(row.curricular_average,null);assert.equal(row.external_accuracy,null);}
  await assert.rejects(db.query('SELECT public.vertice_bridge_map_subject($1,$2,$3,$4,$5,$6,$7)',[institution,course,'SYNTHETIC','enamed','ab','Synthetic evidence',actor]),/Invalid verified mapping/);
  const small=events.filter(e=>e.module==='enamed'&&e.itemId==='booklet-a:1'&&e.studentToken!==String(5).padStart(64,'0')).map(e=>({...e,eventId:e.eventId+':small',competency:'synthetic-small'}));
  await db.query('SELECT public.vertice_bridge_ingest_events($1,$2::jsonb)',[institution,JSON.stringify(small)]);
  await db.query('SELECT public.vertice_bridge_map_subject($1,$2,$3,$4,$5,$6,$7)',[institution,course,'SMALL','enamed','synthetic-small','Synthetic small cohort evidence',actor]);
  await db.query('SELECT public.vertice_bridge_refresh_metrics($1)',[institution]);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM public.vertice_learning_course_metrics WHERE subject_code='SMALL'")).rows[0].n,0,'cohort below five suppressed');
  const schoolEvent={...events[0],courseId:schoolCourse,studentToken:'f'.repeat(64),module:'enem',eventId:'enem:synthetic'};
  await db.query('SELECT public.vertice_bridge_ingest_events($1,$2::jsonb)',[school,JSON.stringify([schoolEvent])]);
  await assert.rejects(db.query('SELECT public.vertice_bridge_ingest_events($1,$2::jsonb)',[institution,JSON.stringify([{...events[0],module:'enem',eventId:'enem:wrong'}])]),/segment mismatch/);
  await assert.rejects(db.query('SELECT public.vertice_bridge_ingest_events($1,$2::jsonb)',[school,JSON.stringify([{...schoolEvent,module:'enamed',eventId:'enamed:wrong'}])]),/segment mismatch/);
  await db.query('SELECT public.vertice_bridge_commit_cursor($1,$2,$3)',[institution,'2026-11-12T12:00:00.123456Z','residencia:synthetic']);
  assert.match((await db.query('SELECT public.vertice_bridge_read_cursor($1) AS r',[institution])).rows[0].r.after,/\.123456/);
  await db.query('SELECT public.vertice_bridge_commit_cursor($1,$2,$3)',[institution,'2026-11-12T12:00:00.123455Z','earlier']);
  assert.match((await db.query('SELECT public.vertice_bridge_read_cursor($1) AS r',[institution])).rows[0].r.after,/\.123456/,'older cursor cannot move progress backwards');
  await db.query('SELECT public.vertice_bridge_reset_cursor($1)',[institution]);
  assert.equal(Date.parse((await db.query('SELECT public.vertice_bridge_read_cursor($1) AS r',[institution])).rows[0].r.after),Date.parse('2000-01-01T00:00:00Z'));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM vertice_private.learning_events')).rows[0].n,55,'reset keeps idempotent event history');
 }finally{await db.close();}
});
