import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const read = path => readFileSync(new URL(path,import.meta.url),'utf8');
const workspaceMigrations = [
 '20261114122806_extension_electronic_forms.sql',
 '20261117193500_extension_project_workspace.sql',
 '20261117193600_extension_student_invites.sql',
 '20261117201000_extension_cancelled_project_discard.sql',
 '20261118200000_extension_evidence_project_links.sql',
];
async function workspace(t){
 const db=new PGlite();
 t.after(()=>db.close());
 await db.exec(read('./fixture.sql'));
 for(const file of workspaceMigrations){
  await db.exec(read('../../../supabase/migrations/'+file));
 }
 return db;
}

test('linked form, recoverable deletion, immutable first submission and scoped student activation',async t=>{
 const db=await workspace(t);
 const actor=async n=>db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal','aal2',false)",[id(n)]);
 const sql=(statement,...values)=>db.query(statement,values);
 const value=async(statement,...values)=>(await sql(statement,...values)).rows[0]?.value;
 await sql("insert into auth.users(id,email,email_confirmed_at) values($1,'docente@example.org',now()),($2,'aluno@example.org',now()),($3,'outro@example.org',now())",id(1),id(2),id(3));
 await sql("insert into vertice_institutions values($1,'IES de teste');",id(11));
 await sql("insert into vertice_courses values($1,$2,'Direito'),($3,$2,'Fisioterapia')",id(21),id(11),id(22));
 await sql("insert into vertice_memberships values($1,$2,'equipe')",id(1),id(11));
 await actor(1);
 await sql("insert into vertice_extension_projects(id,institution_id,title,course_ids,status,review_status) values($1,$2,'Cesamar fictício',array[$3,$4]::uuid[],'planejamento','rascunho'),($5,$2,'Outro projeto',array[$3]::uuid[],'planejamento','rascunho')",id(31),id(11),id(21),id(22),id(32));

 const save=answers=>value("select (vertice_extension_form_save($1,$2,$3,'extensao',$4,'[]',0)).project_id value",id(31),id(11),id(21),answers);
 await assert.rejects(save({title:'Cesamar fictício',evidence_ids:id(52)}),/Evidência fora/);
 assert.equal(await save({title:'Cesamar fictício',hours:'4',investment_actual:'0'}),id(31));
 assert.deepEqual(await value("select course_ids value from vertice_extension_projects where id=$1",id(31)),[id(21),id(22)]);
 assert.equal(await value("select budget_executed::text value from vertice_extension_projects where id=$1",id(31)),'0');

 const issue=await value("select vertice_extension_student_issue($1,'ABC-01','123.456.789-01','Aluno@example.org',array['introduction'],false) value",id(31));
 const invite=(await sql("select vertice_extension_student_review($1) value",id(31))).rows[0].value;
 assert.equal(issue.email,'aluno@example.org');
 assert.match(issue.token,/^[a-f0-9]{64}$/);
 const activation=(registration='ABC-01')=>value("select vertice_extension_student_activate($1,$2,'12345678901','aluno@example.org') value",issue.token,registration);
 await actor(3);
 assert.equal(await activation(),null);
 assert.equal((await sql("select * from vertice_extension_student_projects()")).rows.length,0);
 await actor(2);
 assert.equal(await activation('errada'),null);
 assert.equal(await activation(),id(31));
 assert.equal(await activation(),null);
 assert.equal((await sql("select * from vertice_extension_student_projects()")).rows.length,1);
 await assert.rejects(sql("select vertice_extension_student_save($1,0,$2,false)",invite.id,{execution:'não autorizado'}),/fora da etapa/);
 await sql("select vertice_extension_student_save($1,0,$2,false)",invite.id,{introduction:'Proposta'});
 await sql("select vertice_extension_student_save($1,1,'{}',true)",invite.id);
 await assert.rejects(sql("select vertice_extension_draft_visibility($1,true)",id(31)),/responsável/);
 await actor(1);
 await sql("select vertice_extension_student_review($1,$2,'ajustes')",id(31),invite.id);
 await sql("select vertice_extension_draft_visibility($1,true)",id(31));
 await actor(2);
 assert.equal((await sql("select * from vertice_extension_student_projects()")).rows.length,0);
 await assert.rejects(sql("select vertice_extension_student_save($1,3,'{}',true)",invite.id),/indisponível/);
 await actor(1);
 await sql("select vertice_extension_draft_visibility($1,false)",id(31));
 assert.equal(await value("select count(*)::int value from vertice_extension_forms where project_id=$1",id(31)),1);
 await sql("select vertice_extension_review_move($1,'rascunho','submetido')",id(31));
 await sql("select vertice_extension_review_move($1,'submetido','pendente_ajustes','Completar dados')",id(31));
 await sql("update vertice_extension_projects set review_status='rascunho', first_submitted_at=null where id=$1",id(31));
 await assert.rejects(sql("select vertice_extension_draft_visibility($1,true)",id(31)),/nunca submetido/);
 await sql("update vertice_extension_projects set status='cancelado', review_status='pendente' where id in ($1,$2)",id(31),id(32));
 await assert.rejects(sql("select vertice_extension_draft_visibility($1,true)",id(31)),/nunca submetido/);
 const eligible=async()=> (await sql("select vertice_extension_discardable_projects($1) as value",id(11))).rows.map(r=>r.value);
 assert.deepEqual(await eligible(),[id(32)]);
 await sql("select vertice_extension_draft_visibility($1,true)",id(32));
 assert.equal(await value("select status value from vertice_extension_projects where id=$1 and deleted_at is not null",id(32)),'cancelado');
 await sql("select vertice_extension_draft_visibility($1,false)",id(32));
 await sql("insert into vertice_extension_reviews values($1)",id(32));
 assert.deepEqual(await eligible(),[]);
 await assert.rejects(sql("select vertice_extension_draft_visibility($1,true)",id(32)),/nunca submetido/);
 await assert.rejects(sql("delete from vertice_extension_projects where id=$1",id(31)),/recuperável/);
});


test('shares one evidence record among projects and validates final report references',async t=>{
 const db=await workspace(t);
 const sql=(statement,...values)=>db.query(statement,values);
 const actor=async n=>sql("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal','aal2',false)",id(n));
 await sql("insert into auth.users(id) values($1),($2),($3)",id(1),id(2),id(3));
 await sql("insert into vertice_institutions values($1,'IES A'),($2,'IES B')",id(11),id(12));
 await sql("insert into vertice_courses values($1,$2,'Direito')",id(21),id(11));
 await sql("insert into vertice_memberships values($1,$2,'equipe'),($3,$2,'equipe'),($4,$5,'gestor')",id(1),id(11),id(2),id(3),id(12));
 await actor(1);
 await sql("insert into vertice_extension_projects(id,institution_id,title,status,review_status) values($1,$2,'Projeto original','planejamento','rascunho'),($3,$2,'Projeto destino','planejamento','rascunho'),($4,$2,'Projeto sem vínculo','planejamento','rascunho')",id(31),id(11),id(32),id(33));
 await sql("insert into vertice_extension_evidence_registry(id,institution_id,project_id,student_id,is_current) values($1,$2,$3,null,true),($4,$2,null,$5,true),($6,$7,null,null,true),($8,$2,null,null,false)",id(51),id(11),id(31),id(52),id(2),id(53),id(12),id(54));

 await db.exec('set role authenticated');
 const link=(project,evidence)=>sql('select vertice_extension_link_evidence($1,$2)',id(project),id(evidence));
 await actor(2);
 await assert.rejects(link(32,51),/responsável ou gestor/);
 await actor(1);
 await assert.rejects(link(32,53),/indisponível nesta instituição/);
 await assert.rejects(link(32,52),/compartilhamento/);
 await assert.rejects(link(32,54),/compartilhamento/);
 await assert.rejects(sql("insert into vertice_extension_evidence_project_links(project_id,evidence_id,institution_id) values($1,$2,$3)",id(32),id(51),id(11)),/permission denied/);
 await link(31,51);
 await link(32,51);
 await link(32,51);
 const list=()=>sql('select target_project_id from vertice_extension_project_evidence where id=$1 order by target_project_id',id(51));
 assert.deepEqual((await list()).rows.map(row=>row.target_project_id),[id(31),id(32)]);
 const stored=await sql('select project_id,evidence_id,linked_by from vertice_extension_evidence_project_links');
 assert.deepEqual(stored.rows,[{project_id:id(32),evidence_id:id(51),linked_by:id(1)}]);
 const save=(project,title)=>sql("select (vertice_extension_form_save($1,$2,$3,'extensao',$4,'[]',0)).answers as answers",id(project),id(11),id(21),{title,evidence_ids:id(51)});
 await assert.rejects(save(33,'Projeto sem vínculo'),/Evidência fora do projeto/);
 assert.equal((await save(32,'Projeto destino')).rows[0].answers.evidence_ids,id(51));
 assert.equal((await save(31,'Projeto original')).rows[0].answers.evidence_ids,id(51));

 await actor(3);
 assert.deepEqual((await list()).rows,[]);
});
