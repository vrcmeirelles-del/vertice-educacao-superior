import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
let db,pgClient;
if(process.env.PG_TEST_SOCKET){
 assert(process.env.PG_TEST_SOCKET.startsWith('/'));
 assert(/^extension_qa_[a-z0-9_]+$/.test(process.env.PG_TEST_DB||''));
 const {default:pg}=await import(pathToFileURL(process.env.PG_MODULE));pg.types.setTypeParser(20,Number);
 pgClient=new pg.Client({host:process.env.PG_TEST_SOCKET,port:Number(process.env.PG_TEST_PORT||5432),database:process.env.PG_TEST_DB,user:process.env.PG_TEST_USER});await pgClient.connect();
 assert.equal((await pgClient.query("select count(*)::int n from pg_tables where schemaname='public'")).rows[0].n,0);
 db={query:(...args)=>pgClient.query(...args),exec:sql=>pgClient.query(sql),close:()=>pgClient.end()};
}else{
 const modulePath=process.env.PGLITE_MODULE || new URL('./preanalysis-runtime/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url).pathname;
 const {PGlite}=await import(pathToFileURL(modulePath));db=new PGlite();
}
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated;END IF;IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon;END IF;END$$;
CREATE TABLE vertice_courses(id uuid primary key,institution_id uuid);
CREATE TABLE vertice_extension_projects(id uuid primary key,institution_id uuid,semester text,status text,course_ids uuid[]);
CREATE TABLE vertice_extension_students(id uuid primary key,institution_id uuid,project_id uuid,course_id uuid,status text,hours_completed int);
CREATE TABLE vertice_extension_deliverables(id int,project_id uuid);
INSERT INTO vertice_courses VALUES('${id(11)}','${id(1)}'),('${id(12)}','${id(1)}'),('${id(13)}','${id(2)}');
INSERT INTO vertice_extension_projects VALUES
('${id(21)}','${id(1)}','2026/1','em_execucao',ARRAY['${id(11)}','${id(12)}','${id(11)}']::uuid[]),
('${id(22)}','${id(1)}','2026/2','concluido',ARRAY['${id(11)}']::uuid[]),
('${id(23)}','${id(1)}','2026/1','cancelado',ARRAY['${id(11)}']::uuid[]),
('${id(24)}','${id(1)}','2026/1','suspenso',ARRAY['${id(11)}']::uuid[]),
('${id(25)}','${id(2)}','SECRET','em_execucao',ARRAY['${id(13)}']::uuid[]);
INSERT INTO vertice_extension_students VALUES
('${id(31)}','${id(1)}','${id(21)}','${id(11)}','ativo',3),
('${id(32)}','${id(1)}','${id(21)}','${id(12)}','ativo',7),
('${id(33)}','${id(1)}','${id(22)}','${id(11)}','concluido',5),
('${id(34)}','${id(1)}','${id(23)}','${id(11)}','ativo',100),
('${id(35)}','${id(1)}','${id(24)}','${id(11)}','ativo',100),
('${id(36)}','${id(1)}','${id(21)}',NULL,'ativo',19),
('${id(37)}','${id(1)}','${id(25)}','${id(11)}','ativo',100),
('${id(38)}','${id(1)}','${id(21)}','${id(13)}','ativo',100);
INSERT INTO vertice_extension_deliverables VALUES(1,'${id(21)}'),(2,'${id(21)}');`);
const migration = readFileSync('supabase/migrations/20261112090000_extension_coverage_contract.sql','utf8');
await db.exec(migration);
await db.exec(migration); // retry-safe
const rows = (await db.query(`SELECT * FROM v_extension_coverage_v2 WHERE institution_id='${id(1)}' ORDER BY semester,course_id`)).rows;
assert.equal(rows.length,3);
assert.deepEqual(rows.map(r => [Number(r.total_projects),Number(r.total_students),Number(r.total_student_hours)]),[[1,1,3],[1,1,7],[1,0,5]]);
const pending = (await db.query(`SELECT * FROM v_extension_student_quality WHERE quality<>'valido' ORDER BY id`)).rows;
assert.deepEqual(pending.map(p=>p.quality),['sem_curso','projeto_inconsistente','curso_inconsistente']);
assert.equal(pending[1].semester,null,'cross-tenant project semester must never leak');
for (const sql of [
`INSERT INTO vertice_extension_students VALUES('${id(41)}','${id(1)}','${id(25)}',NULL,'ativo',1)`,
`INSERT INTO vertice_extension_students VALUES('${id(41)}','${id(1)}','${id(21)}','${id(13)}','ativo',1)`,
`INSERT INTO vertice_extension_students VALUES('${id(41)}','${id(1)}','${id(22)}','${id(12)}','ativo',1)`,
`UPDATE vertice_extension_projects SET course_ids=ARRAY['${id(11)}']::uuid[] WHERE id='${id(21)}'`,
`INSERT INTO vertice_extension_projects VALUES('${id(41)}','${id(1)}','2026/1','em_execucao',ARRAY['${id(13)}']::uuid[])`
]) await assert.rejects(db.exec(sql),e=>e.code==='23514');
await db.exec(`INSERT INTO vertice_extension_students VALUES('${id(41)}','${id(1)}','${id(21)}',NULL,'ativo',1)`);
assert.equal((await db.query(`SELECT count(*) n FROM v_extension_student_quality WHERE quality='sem_curso'`)).rows[0].n,2);
await db.exec(`ALTER TABLE vertice_extension_students ENABLE ROW LEVEL SECURITY; ALTER TABLE vertice_extension_projects ENABLE ROW LEVEL SECURITY; ALTER TABLE vertice_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY test_students ON vertice_extension_students FOR SELECT TO authenticated USING (institution_id='${id(1)}');
CREATE POLICY test_projects ON vertice_extension_projects FOR SELECT TO authenticated USING (institution_id='${id(1)}');
CREATE POLICY test_courses ON vertice_courses FOR SELECT TO authenticated USING (institution_id='${id(1)}');
GRANT SELECT ON vertice_extension_students,vertice_extension_projects,vertice_courses TO authenticated;
SET ROLE authenticated;`);
assert.equal((await db.query(`SELECT count(*) n FROM v_extension_coverage_v2 WHERE institution_id='${id(2)}'`)).rows[0].n,0);
assert.equal((await db.query(`SELECT count(*) n FROM v_extension_student_quality WHERE semester='SECRET'`)).rows[0].n,0);
await db.exec('RESET ROLE');
if(pgClient){
 const {default:pg}=await import(pathToFileURL(process.env.PG_MODULE));pg.types.setTypeParser(20,Number);
 const second=new pg.Client({host:process.env.PG_TEST_SOCKET,port:Number(process.env.PG_TEST_PORT||5432),database:process.env.PG_TEST_DB,user:process.env.PG_TEST_USER});await second.connect();
 try{
  // Separate protocol messages are essential: INSERT; BEGIN; INSERT in one
  // simple-query message can leave the project itself uncommitted/invisible.
  // Session B would then update zero rows, which is not a locking test.
  await db.exec(`INSERT INTO vertice_extension_projects VALUES('${id(501)}','${id(1)}','2099/1','planejamento',ARRAY['${id(11)}']::uuid[]);`);
  const visible = await second.query(`SELECT course_ids FROM vertice_extension_projects WHERE id='${id(501)}'`);
  assert.equal(visible.rowCount,1,'committed fixture project must be visible in session B');
  assert.deepEqual(visible.rows[0].course_ids,[id(11)]);
  const holder = (await db.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  const waiter = (await second.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  await second.query("SET statement_timeout='10s'");
  await db.exec('BEGIN');
  await db.exec(`INSERT INTO vertice_extension_students VALUES('${id(502)}','${id(1)}','${id(501)}','${id(11)}','ativo',1);`);
  let finished=false;
  let earlyResult;
  const waiting=second.query(`UPDATE vertice_extension_projects SET course_ids=ARRAY[]::uuid[] WHERE id='${id(501)}'`)
    .then(r=>({ok:true,rowCount:r.rowCount}),e=>({error:e}))
    .then(result=>{earlyResult=result;finished=true;return result;});
  // Observe the actual database blocker instead of inferring it from elapsed time.
  let blocked=false;
  const deadline=Date.now()+4000;
  while(Date.now()<deadline && !finished){
    const state=await db.query('SELECT $1::int = ANY(pg_blocking_pids($2::int)) AS blocked',[holder,waiter]);
    if(state.rows[0].blocked){blocked=true;break;}
    await new Promise(r=>setTimeout(r,25));
  }
  assert.equal(finished,false,`project change completed before releasing validation lock: ${JSON.stringify({rowCount:earlyResult?.rowCount,code:earlyResult?.error?.code})}`);
  assert.equal(blocked,true,'session B must be blocked by the student transaction in session A');
  await db.exec('COMMIT');
  const result=await waiting;
  assert.equal(result.error?.code,'23514','after waiting, removal must reject the newly committed participant, not succeed or timeout');
  assert.equal((await db.query(`SELECT course_ids FROM vertice_extension_projects WHERE id='${id(501)}'`)).rows[0].course_ids[0],id(11));
  assert.equal((await db.query(`SELECT count(*) n FROM vertice_extension_students WHERE id='${id(502)}' AND project_id='${id(501)}' AND course_id='${id(11)}'`)).rows[0].n,1);
  console.log('PASS real two-session project/course mutation vs participant insertion');
  // Repeatable Read pins B's snapshot BEFORE A creates the participant. A row
  // lock alone does not necessarily refresh that snapshot after it is released.
  // Keep this independent from the already-proven Read Committed scenario above.
  await db.exec(`INSERT INTO vertice_extension_projects VALUES('${id(503)}','${id(1)}','2099/2','planejamento',ARRAY['${id(11)}']::uuid[]);`);
  assert.equal((await second.query(`SELECT id FROM vertice_extension_projects WHERE id='${id(503)}'`)).rowCount,1);
  await second.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  assert.equal((await second.query('SHOW transaction_isolation')).rows[0].transaction_isolation,'repeatable read');
  assert.equal((await second.query(`SELECT count(*) n FROM vertice_extension_students WHERE project_id='${id(503)}'`)).rows[0].n,0);
  await db.exec('BEGIN');
  await db.exec(`INSERT INTO vertice_extension_students VALUES('${id(504)}','${id(1)}','${id(503)}','${id(11)}','ativo',1);`);
  let rrFinished=false;
  const rrWaiting=second.query(`UPDATE vertice_extension_projects SET course_ids=ARRAY[]::uuid[] WHERE id='${id(503)}'`)
    .then(r=>({ok:true,rowCount:r.rowCount}),e=>({error:e}))
    .then(result=>{rrFinished=true;return result;});
  let rrBlocked=false;
  const rrDeadline=Date.now()+4000;
  while(Date.now()<rrDeadline && !rrFinished){
    if((await db.query('SELECT $1::int = ANY(pg_blocking_pids($2::int)) AS blocked',[holder,waiter])).rows[0].blocked){rrBlocked=true;break;}
    await new Promise(r=>setTimeout(r,25));
  }
  await db.exec('COMMIT');
  const rrResult=await rrWaiting;
  console.log('RR concurrency observation: '+JSON.stringify({blocked:rrBlocked,rowCount:rrResult.rowCount,errorCode:rrResult.error?.code}));
  // Explicitly unsupported isolation, serialization failure or invariant rejection
  // are safe. A successful UPDATE using an old snapshot is NOT a pass.
  assert(['0A000','40001','23514'].includes(rrResult.error?.code),
    'REPEATABLE READ must reject the course removal; successful stale-snapshot UPDATE breaks participant membership');
  await second.query('ROLLBACK');
  assert.deepEqual((await db.query(`SELECT course_ids FROM vertice_extension_projects WHERE id='${id(503)}'`)).rows[0].course_ids,[id(11)]);
  assert.equal((await db.query(`SELECT count(*) n FROM vertice_extension_students WHERE id='${id(504)}' AND course_id='${id(11)}'`)).rows[0].n,1);
  console.log('PASS Repeatable Read stale-snapshot mutation is rejected without losing the participant');
 }finally{await db.exec('ROLLBACK');await second.query('ROLLBACK');await second.end();}
}else{console.log('SKIP real two-session extension race: embedded engine');}
const beforeRollback=(await db.query('select count(*) n from vertice_extension_students')).rows[0].n;
await db.exec(readFileSync('supabase/rollback/20261112090000_extension_coverage_contract.sql','utf8'));
assert.equal((await db.query("select has_table_privilege('authenticated','v_extension_coverage_v2','SELECT') ok")).rows[0].ok,false);
assert.equal((await db.query('select count(*) n from vertice_extension_students')).rows[0].n,beforeRollback);
await db.close();
console.log('PASS extension coverage: 2 courses, 2 semesters, deliverables, duplicate arrays, excluded statuses, pending legacy, tenant validation, RLS, idempotency');
