import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration = readFileSync(new URL('../../../supabase/migrations/20261118132007_teaching_ac_handoff.sql',import.meta.url),'utf8');
const id=n=>'93300000-0000-4000-8000-'+String(n).padStart(12,'0');
const [inst,otherInst,course,otherCourse,manager,coord,otherCoord,lector,doc,student,studentOther,rule,category,activity,otherRule,otherCat,legacy]=Array.from({length:17},(_,i)=>id(i+1));
const role=(d,uid,aal='aal2')=>d.exec(`reset role; select set_config('test.u','${uid}',false),set_config('test.aal','${aal}',false); set role authenticated;`);
const pg=async(d,query)=> (await d.query(query)).rows;
const options=(courseId=course,instId=inst,mat='M01')=>`select public.vertice_teaching_ac_options('${instId}','${courseId}','${activity}','${mat}') value`;
const forward=(args={})=>{
 const a={ courseInst:inst, courseId:course, enrollment:'M01', chosenCategory:category, participant:'organizador', mins:90, flag:'true', ...args};
 return `select public.vertice_teaching_ac_forward('${a.courseInst}','${a.courseId}','${activity}','${a.enrollment}','${a.chosenCategory}','${a.participant}',${a.mins},${a.flag}) value`;
};

test('encaminhamento AC nativo mantém recorte, idempotência e bloqueia crédito legado',async(t)=>{
 const d=new PGlite();
 try {
 const tables = ['vertice_ac_extractions','vertice_ac_calculations','vertice_ac_decisions','vertice_ac_ledger_entries','vertice_ac_duplicate_checks'];
 await d.exec(`
 create role anon; create role authenticated;
 create schema auth; create schema vertice_private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.u',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('test.aal',true))$$;
 grant usage on schema auth,vertice_private to authenticated;
 create function vertice_private.teaching_access(inst uuid,course uuid,permission text)
 returns boolean language sql stable as $$select
  auth.jwt()->>'aal'='aal2' and inst='${inst}' and (
      auth.uid()='${manager}' or (auth.uid()='${coord}' and course='${course}')
      or (auth.uid()='${otherCoord}' and course='${otherCourse}')) $$;
 create table public.vertice_teaching_activities (id uuid primary key,institution_id uuid,course_id uuid,title text,evidence_doc_id uuid,status text,activity_date date);
 create table public.vertice_documents(id uuid primary key,institution_id uuid,course_id uuid,status text,superseded_by uuid,expiry_date date);
 create table public.vertice_student_registry(id uuid primary key,institution_id uuid,course_id uuid,enrollment_code text,academic_status text,verified boolean,curriculum_version text,full_name text);
 create table public.vertice_ac_rules(id uuid primary key,institution_id uuid,course_id uuid,curriculum_version text,is_active boolean,approved_at timestamptz,effective_from date,effective_until date);
 create table public.vertice_ac_categories(id uuid primary key,institution_id uuid,rule_id uuid,label text,sort_order integer);
 create table public.vertice_ac_submissions(id uuid primary key default gen_random_uuid(),institution_id uuid,student_id uuid,rule_id uuid,category_id uuid,title text,start_date date,end_date date,documentary_minutes integer,document_id uuid,status text);
 create table public.vertice_ac_audit(id uuid primary key default gen_random_uuid(),aggregate_type text,aggregate_id uuid);
 ${tables.map(t=>`create table public.${t}(id uuid primary key default gen_random_uuid(),submission_id uuid,matched_submission_id uuid);alter table public.${t} enable row level security;create policy legacy_all on public.${t} for all using(true);grant all on public.${t} to authenticated;`).join('\n')}
 alter table public.vertice_ac_submissions enable row level security;
 alter table public.vertice_ac_audit enable row level security;
 create policy legacy_all on public.vertice_ac_submissions for all using(true);
 create policy legacy_all on public.vertice_ac_audit for all using(true);
 grant all on public.vertice_ac_submissions, public.vertice_ac_audit to authenticated;
 grant select on public.vertice_teaching_activities to authenticated;
 create view v_ac_synthetic with (security_invoker=true) as select id,student_id from public.vertice_ac_submissions;
 grant select on v_ac_synthetic to authenticated;
 insert into public.vertice_documents values ('${doc}','${inst}','${course}','active',null,null);
 insert into public.vertice_student_registry values
 ('${student}','${inst}','${course}','M01','active',true,'V1','Pessoa Sintética'),
 ('${studentOther}','${inst}','${otherCourse}','M02','active',true,'V1','Outro Curso');
 insert into public.vertice_ac_rules values
 ('${rule}','${inst}','${course}','V1',true,now(),'2026-01-01',null),
 ('${otherRule}','${inst}','${otherCourse}','V1',true,now(),'2026-01-01',null);
 insert into public.vertice_ac_categories values
 ('${category}','${inst}','${rule}','Evento interno',1),
 ('${otherCat}','${inst}','${otherRule}','Outro curso',1);
 insert into public.vertice_teaching_activities values ('${activity}','${inst}','${course}','Seminário sintético','${doc}','validada','2026-07-13');
 insert into public.vertice_ac_submissions(id,institution_id,student_id,rule_id,category_id,title,status) values ('${legacy}','${inst}','${student}','${rule}','${category}','Legado','submitted');
 `);
 await d.exec(migration);
 let submission;
 await t.test('coordenação seleciona por matrícula comprovada e registra só uma solicitação, sem livro-razão',async()=>{
  await role(d,coord);
  assert.deepEqual((await pg(d,options()))[0].value,{student_name:'Pessoa Sintética',categories:[{id:category,label:'Evento interno'}]});
  await assert.rejects(d.query(forward({flag:'false'})),{code:'22023'});
  await assert.rejects(d.query(forward({mins:0})),{code:'22023'});
  await assert.rejects(d.query(forward({chosenCategory:otherCat})),{code:'22023'});
  await assert.rejects(d.query(forward({enrollment:'M02'})),{code:'22023'});
  const first=(await pg(d,forward()))[0].value;
  submission=first.id;
  assert.equal(first.already_forwarded,false);
  assert.deepEqual((await pg(d,forward()))[0].value,{id:submission,already_forwarded:true});
  assert.deepEqual((await pg(d,`select teaching_activity_id,teaching_participant_role,status,documentary_minutes from public.vertice_ac_submissions where id='${submission}'`))[0],
  {teaching_activity_id:activity,teaching_participant_role:'organizador',status:'submitted',documentary_minutes:90});
  assert.equal((await pg(d,'select * from vertice_ac_ledger_entries')).length,0);
 });
 await t.test('MFA, outro curso, outro papel e evidência inativa bloqueiam o envio',async()=>{
  await role(d,otherCoord);
  await assert.rejects(d.query(forward()),{code:'42501'});
  await assert.rejects(d.query(forward({courseId:otherCourse})),{code:'22023'});
  await role(d,lector);
  await assert.rejects(d.query(options()),{code:'42501'});
  await role(d,coord,'aal1');
  await assert.rejects(d.query(forward()),{code:'42501'});
  await d.exec(`reset role; update public.vertice_documents set status='expired' where id='${doc}'`);
  await role(d,manager);
  await assert.rejects(d.query(forward()),{code:'22023'});
  await d.exec(`reset role; update public.vertice_documents set status='active' where id='${doc}'`);
 });
 await t.test('registros e auditoria derivados não vazam, nem recebem mutações/decisões pelo caminho legado',async()=>{
  await d.exec(`reset role; insert into vertice_ac_audit(aggregate_type,aggregate_id) values('submission','${submission}'),('submission','${legacy}');`);
  await role(d,otherCoord);
  assert.deepEqual((await pg(d,'select id from public.vertice_ac_submissions')).map(x=>x.id),[legacy]);
  assert.deepEqual((await pg(d,'select id from v_ac_synthetic')).map(x=>x.id),[legacy]);
  assert.deepEqual((await pg(d,'select aggregate_id from vertice_ac_audit')).map(x=>x.aggregate_id),[legacy]);
  await role(d,manager);
  assert.equal((await pg(d,`delete from vertice_ac_submissions where id='${submission}' returning id`)).length,0);
  assert.equal((await pg(d,`update vertice_ac_submissions set status='credited',teaching_activity_id=null,teaching_participant_role=null where id='${submission}' returning id`)).length,0);
  await assert.rejects(d.query(`insert into vertice_ac_submissions(institution_id,student_id,teaching_activity_id,teaching_participant_role) values('${inst}','${student}','${activity}','participante')`),{code:'42501'});
  for(const table of tables) await assert.rejects(d.query(`insert into ${table}(submission_id) values('${submission}')`),{code:'42501'});
  await assert.rejects(d.query(`insert into vertice_ac_duplicate_checks(submission_id,matched_submission_id) values('${legacy}','${submission}')`),{code:'42501'});
  assert.equal((await pg(d,`update vertice_ac_submissions set status='under_review' where id='${legacy}' returning id`)).length,1);
 });
 } finally {await d.close();}
});
