import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration = readFileSync(new URL('../../../supabase/migrations/20261118131715_teaching_activities_pdi.sql', import.meta.url),'utf8');
const rosterMigration = readFileSync(new URL('../../../supabase/migrations/20261118202000_teaching_activity_roster.sql', import.meta.url),'utf8');
const id = n => '91000000-0000-4000-8000-'+String(n).padStart(12,'0');
const [a,b,school,c1,c2,c3,cSchool,reitor,coord,staff,nde,outsider,program,goal,otherProgram,otherGoal,doc1,doc2,docDraft] =
 Array.from({length:19},(_,i)=>id(i+1));

const [student1,student2,studentOther,studentUnverified]=[20,21,22,23].map(id);

const role = async (db, uid, aal='aal2') => db.exec(`reset role; select set_config('s.uid','${uid}',false),set_config('s.aal','${aal}',false); set role authenticated;`);

test('atividade: instituição, curso, programa/meta nativa, evidência e validação segregados; sem medição',async(t)=>{
 const db=new PGlite();
 try {
  await db.exec(`
 create role anon; create role authenticated;
 create schema auth; create schema vertice_private;
 create table auth.users (id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('s.uid',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal',current_setting('s.aal',true)) $$;
 grant usage on schema auth,vertice_private to authenticated;
 create table public.vertice_institutions(id uuid primary key,tier text);
 create table public.vertice_courses(id uuid primary key,institution_id uuid references public.vertice_institutions(id),name text,degree text);
 create table public.vertice_student_registry(id uuid primary key,institution_id uuid,course_id uuid,full_name text,enrollment_code text,academic_status text,verified boolean);
 create table public.vertice_memberships(user_id uuid,institution_id uuid,role text);
 create table public.vertice_learning_staff_scope(user_id uuid,institution_id uuid,course_id uuid,active bool);
 create function vertice_private.member_role(inst uuid) returns text language sql stable security definer set search_path='' as $$
   select role from public.vertice_memberships where user_id=auth.uid() and institution_id=inst and auth.jwt()->>'aal'='aal2'
 $$;
 create function vertice_private.is_full_access(inst uuid) returns boolean language sql stable as $$
   select coalesce(vertice_private.member_role(inst) in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador'),false)
 $$;
 create function vertice_private.touch_updated() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
 create table public.audit_fixt(table_name text);
 create function vertice_private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.audit_fixt values (tg_table_name);return null;end$$;
 create table public.vertice_goals(id uuid primary key default gen_random_uuid(),institution_id uuid references public.vertice_institutions(id),course_id uuid,title text not null,indicator text not null,target numeric not null,owner_name text,due_date date,status text default 'ativa');
 create table public.vertice_goal_measurements(id uuid primary key default gen_random_uuid(),institution_id uuid,goal_id uuid);
 alter table public.vertice_goals enable row level security;
 create policy original_goal_read on public.vertice_goals for select to authenticated using (vertice_private.member_role(institution_id) is not null);
 create policy original_goal_edit on public.vertice_goals for all to authenticated using (vertice_private.member_role(institution_id)='gestor') with check (vertice_private.member_role(institution_id)='gestor');
 grant all on public.vertice_goals to authenticated;
 create table public.vertice_documents(id uuid primary key,institution_id uuid,course_id uuid,title text,status text,superseded_by uuid);
 alter table public.vertice_documents enable row level security;
 create policy documents_read on public.vertice_documents for select to authenticated using (vertice_private.member_role(institution_id) is not null);
 grant select on public.vertice_documents to authenticated;
 insert into auth.users values ('${reitor}'),('${coord}'),('${staff}'),('${nde}'),('${outsider}');
 insert into public.vertice_institutions values ('${a}','superior'),('${b}','superior'),('${school}','escolas');
 insert into public.vertice_courses values ('${c1}','${a}','Direito','bacharelado'),('${c2}','${a}','Especialização','pos'),('${c3}','${b}','Engenharia','bacharelado'),('${cSchool}','${school}','Ensino Médio','escola');
 insert into public.vertice_memberships values ('${reitor}','${a}','reitor'),('${reitor}','${school}','reitor'),('${coord}','${a}','coordenador'),('${staff}','${a}','equipe'),('${nde}','${a}','nde'),('${outsider}','${b}','gestor');
 insert into public.vertice_learning_staff_scope values ('${staff}','${a}','${c1}',true),('${coord}','${a}','${c1}',true),('${nde}','${a}','${c1}',true);
 insert into public.vertice_documents values ('${doc1}','${a}','${c1}','Lista sintética','active',null),('${doc2}','${a}','${c2}','Outro curso','active',null),('${docDraft}','${a}','${c1}','Não publicado','draft',null);
 `);
  await db.exec(migration);
  await db.exec(rosterMigration);
  await db.exec(`insert into public.vertice_student_registry values
    ('${student1}','${a}','${c1}','Pessoa Demo Um','DEMO-01','active',true),
    ('${student2}','${a}','${c1}','Pessoa Demo Dois','DEMO-02','active',true),
    ('${studentOther}','${a}','${c2}','Pessoa Demo Outro Curso','DEMO-03','active',true),
    ('${studentUnverified}','${a}','${c1}','Pessoa Demo Não Validada','DEMO-04','active',false);`);
  await db.exec(`insert into public.vertice_pdi_programs(id,institution_id,title) values ('${program}','${a}','Sustentabilidade'),('${otherProgram}','${b}','Programa B');
    insert into public.vertice_goals(id,institution_id,title,indicator,target,owner_name,due_date,pdi_program_id,pdi_expected_result)
    values ('${goal}','${a}','Reduzir resíduos','kg',30,'Coordenação','2027-06-30','${program}','Redução confirmada por pesagem'),
           ('${otherGoal}','${b}','Meta externa','kg',30,'Coordenação','2027-06-30','${otherProgram}','Resultado esperado')`);

  await t.test('reitoria pode criar programa/metas; Escola e meta de outra IES são bloqueadas', async()=>{
   await role(db,reitor);
   await db.exec(`insert into vertice_pdi_programs(institution_id,title) values ('${a}','Responsabilidade social')`);
   await assert.rejects(db.exec(`insert into vertice_pdi_programs(institution_id,title) values ('${school}','Não permitido')`),{code:'42501'});
   await assert.rejects(db.exec(`insert into vertice_goals(institution_id,title,indicator,target,owner_name,due_date,pdi_program_id,pdi_expected_result)
    values ('${a}','Meta','kg',10,'Dono','2027-01-01','${otherProgram}','Resultado')`),{code:'23503'});
  });

  const create=(course=c1,inst=a,goalId=goal,doc=doc1,ods='12,\'Tratamento de resíduos\'')=>db.query(`
   insert into vertice_teaching_activities(institution_id,course_id,title,category,description,activity_date,organizer_role,goal_id,evidence_doc_id,ods_goal,ods_rationale)
   values ('${inst}','${course}','Oficina de resíduos','evento','Oficina proposta pelos estudantes','2026-11-18','discente','${goalId}','${doc}',${ods})
   returning id,status`);
  let activity;
  await t.test('coordenação recortada, docente vinculado cadastra e NDE não escreve, MFA obrigatório',async()=>{
   await role(db,coord);
   assert.deepEqual((await db.query(`select id from vertice_teaching_course_options('${a}')`)).rows.map(r=>r.id),[c1]);
   await assert.rejects(create(c2),{code:'23514'}); // doc existente não é do curso solicitado
   await assert.rejects(create(c2,a,goal,doc2),{code:'42501'}); // curso irmanado, não autorizado
   await assert.rejects(create(c3,b,otherGoal,doc2),{code:'23514'});
   await assert.rejects(create(c1,a,otherGoal),{code:'23514'});
   await assert.rejects(create(c1,a,goal,doc2),{code:'23514'});
   await assert.rejects(create(c1,a,goal,docDraft),{code:'23514'});
   await assert.rejects(create(c1,a,goal,doc1,'12,null'),{code:'23514'});
   assert.deepEqual((await db.query(`select id from vertice_teaching_evidence_options('${a}','${c1}')`)).rows.map(r=>r.id),[doc1]);
   assert.equal((await db.query(`select id from vertice_teaching_evidence_options('${a}','${c2}')`)).rows.length,0);
   await role(db,staff);
   const insert=await create();activity=insert.rows[0].id;
   assert.equal(insert.rows[0].status,'rascunho');
   assert.equal((await db.query(`select total_minutes from public.vertice_teaching_activities where id='${activity}'`)).rows[0].total_minutes,null);
   await assert.rejects(db.exec(`update vertice_teaching_activities set status='validada' where id='${activity}'`),{code:'42501'});
   await role(db,nde);
   assert.equal((await db.query('select id from vertice_teaching_activities')).rows.length,1);
   await assert.rejects(create(),{code:'42501'});
   await role(db,coord,'aal1');
   assert.equal((await db.query('select id from vertice_teaching_activities')).rows.length,0);
   assert.equal((await db.query(`select id from vertice_teaching_course_options('${a}')`)).rows.length,0);
  });
  await t.test('roster limita dados à matrícula ativa verificada e equipe autorizada, com carga independente e inclusão atômica',async()=>{
   const base={title:'Registro sintético',category:'evento',description:'Sem alunos reais',activity_date:'2026-11-18',organizer_role:'discente',goal_id:goal,evidence_doc_id:doc1,ods_goal:12,ods_rationale:'Justificativa sintética',total_minutes:270};
   const roster=(activityId=null,query='')=>db.query('select * from vertice_teaching_roster($1,$2,$3,$4)',[a,c1,activityId,query]).then(r=>r.rows);
   const save=(activityId,fields,students)=>db.query(
     'select id,status,updated_at::text as version,total_minutes,evidence_doc_id from vertice_teaching_save_activity($1,$2,$3,$4,$5)',
     [a,c1,activityId,JSON.stringify(fields),students === null ? null : JSON.stringify(students)],
   ).then(r=>r.rows[0]);
   const one={student_id:student1,participant_role:'organizador',minutes:150};
   const two={student_id:student2,participant_role:'participante',minutes:45};
   await role(db,coord);
   assert.deepEqual((await roster(null,'demo')).map(r=>r.student_id).sort(),[student1,student2].sort());
   assert.deepEqual(await roster(null,'d'),[]);
   await assert.rejects(save(null,base,[{...one,student_id:studentOther}]),{code:'22023'});
   assert.equal((await db.query("select id from vertice_teaching_activities where title='Registro sintético'")).rows.length,0);
   await assert.rejects(save(null,base,[one,one]),{code:'22023'});
   await assert.rejects(save(null,base,[{...one,minutes:-1}]),{code:'22023'});
   await assert.rejects(save(null,{...base,status:'validada'},[one]),{code:'22023'});
   const original=await save(null,base,[one,two]);
   assert.equal(original.status,'rascunho');
   assert.equal(original.total_minutes,270);
   assert.equal(original.evidence_doc_id,doc1);
   assert.deepEqual((await roster(original.id)).map(({student_id,participant_role,minutes})=>({student_id,participant_role,minutes})).sort((x,y)=>x.student_id.localeCompare(y.student_id)),[one,two]);
   await role(db,staff);
   await assert.rejects(save(original.id,{...base,updated_at:original.version},[]),{code:'40001'});
   await role(db,nde);
   await assert.rejects(roster(original.id),{code:'42501'});
   await role(db,coord,'aal1');
   await assert.rejects(roster(original.id),{code:'42501'});
   await role(db,outsider);
   await assert.rejects(roster(original.id),{code:'42501'});
   await role(db,coord);
   const preserved=await save(original.id,{...base,updated_at:original.version},null);
   assert.equal((await roster(original.id)).length,2);
   assert.equal(preserved.total_minutes,270);
   assert.equal(preserved.evidence_doc_id,doc1);
   await assert.rejects(save(original.id,{...base,updated_at:original.version},[]),{code:'40001'});
   const edited=await save(original.id,{...base,updated_at:preserved.version},[{...one,minutes:170}]);
   assert.deepEqual((await roster(original.id)).map(r=>[r.student_id,r.minutes]),[[student1,170]]);
   await db.exec(`reset role; update public.vertice_student_registry set course_id='${c2}' where id='${student1}'`);
   assert.ok((await db.query(`select removed_at from vertice_private.teaching_activity_students where student_id='${student2}'`)).rows[0].removed_at);
   await role(db,coord);
   assert.equal((await roster(original.id))[0].enrollment_code,null);
   await assert.rejects(save(original.id,{...base,updated_at:edited.version},[one]),{code:'22023'});
   await save(original.id,{...base,updated_at:edited.version},[{...one,minutes:170}]);
   await db.exec(`update vertice_teaching_activities set status='validada' where id='${original.id}'`);
   assert.equal((await roster(original.id,'demo')).length,1);
   const latest=(await db.query(`select updated_at::text as v from vertice_teaching_activities where id='${original.id}'`)).rows[0].v;
   await assert.rejects(save(original.id,{...base,updated_at:latest},[]),{code:'40001'});
  });
  await t.test('coordenação valida uma vez; atividade não gera medição nem cruza IES; exclusão de arquivo preserva histórico',async()=>{
   await role(db,coord);
   const accepted=await db.query(`update vertice_teaching_activities set status='validada' where id='${activity}' returning status,validated_by`);
   assert.deepEqual(accepted.rows,[{status:'validada',validated_by:coord}]);
   assert.equal((await db.query(`update vertice_teaching_activities set title='Mudança' where id='${activity}' returning title`)).rows.length,0);
   await role(db,outsider);
   assert.equal((await db.query('select id from vertice_teaching_activities')).rows.length,0);
   assert.equal((await db.query(`select id from vertice_teaching_evidence_options('${a}','${c1}')`)).rows.length,0);
   await db.exec(`reset role; delete from public.vertice_documents where id='${doc1}'`);
   assert.deepEqual((await db.query(`select goal_id,evidence_doc_id,status from vertice_teaching_activities where id='${activity}'`)).rows,[{goal_id:goal,evidence_doc_id:null,status:'validada'}]);
   assert.equal((await db.query('select id from vertice_goal_measurements')).rows.length,0);
  });
 } finally { await db.close(); }
});
