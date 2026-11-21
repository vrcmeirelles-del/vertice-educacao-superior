import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';import {before,after,test} from 'node:test';import assert from 'node:assert/strict';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');let db;
const sql=(q,...args)=>db.query(q,args);
const value=async(q,...args)=>(await sql(q,...args)).rows[0]?.value;
const actor=(n,aal='aal2')=>sql("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",n?id(n):'',aal);
const move=(action,version=0,student=41,project=31)=>value('select public.vertice_extension_student_lifecycle($1,$2,$3,$4,$5) value',id(student),id(project),action,version,'Alteração sintética para teste de permissão');
before(async()=>{
 db=new PGlite();await db.exec(read('./fixture.sql'));
 for(const name of ['20261114124054_extension_electronic_forms.sql','20261117193500_extension_project_workspace.sql','20261117193600_extension_student_invites.sql'])await db.exec(read('../../../supabase/migrations/'+name));
 await db.exec(`create table public.vertice_extension_students(id uuid primary key,institution_id uuid,project_id uuid,full_name text,email text,status text default 'ativo',hours_completed numeric default 0);
 create table public.vertice_extension_hour_entries(id uuid,student_id uuid references public.vertice_extension_students(id) on delete cascade,minutes int);
 create table public.vertice_extension_activity_participation(id uuid,student_id uuid references public.vertice_extension_students(id) on delete cascade);
 grant select,insert,update,delete on public.vertice_extension_students to authenticated;`);
 await db.exec(read('../../../supabase/migrations/20261118113412_extension_student_lifecycle.sql'));
 await sql("insert into auth.users(id,email,email_confirmed_at) values($1,'owner@example.org',now()),($2,'viewer@example.org',now()),($3,'outsider@example.org',now()),($4,'student@example.org',now())",id(1),id(2),id(3),id(4));
 await sql("insert into vertice_institutions values($1,'IES A'),($2,'IES B')",id(11),id(12));
 await sql("insert into vertice_memberships values($1,$2,'equipe'),($3,$2,'equipe'),($4,$5,'gestor')",id(1),id(11),id(2),id(3),id(12));
 await actor(1);
 await sql("insert into vertice_extension_projects(id,institution_id,title,status,review_status) values($1,$2,'Projeto A','planejamento','rascunho'),($3,$2,'Projeto B','planejamento','rascunho')",id(31),id(11),id(32));
 await sql("insert into vertice_extension_students(id,institution_id,project_id,full_name,email,hours_completed) values($1,$2,$3,'Aluno sintético','student@example.org',10),($4,$2,$5,'Mesmo aluno, outro projeto','student@example.org',5),($6,$2,$3,'Outro aluno','other@example.org',0)",id(41),id(11),id(31),id(42),id(32),id(43));
 await sql('insert into vertice_extension_hour_entries values($1,$2,600)',id(51),id(41));await sql('insert into vertice_extension_activity_participation values($1,$2)',id(52),id(41));
 await sql("select vertice_extension_student_issue($1,'A123','12345678901','student@example.org',array['introduction'],false)",id(31));await sql("select vertice_extension_student_issue($1,'A123','12345678901','student@example.org',array['introduction'],false)",id(32));
 await db.exec('set role authenticated');
});after(async()=>db.close());
test('nega não responsável, outra instituição, sessão sem MFA e projeto incorreto',async()=>{
 for(const n of [2,3]){await actor(n);await assert.rejects(move('desativar'),/não autorizada/);}
 await actor(1,'aal1');await assert.rejects(move('desativar'),/não autorizada/);await actor(1);await assert.rejects(move('desativar',0,41,32),/não pertence/);
});
test('desativa somente o vínculo selecionado e revoga somente seu convite',async()=>{
 assert.equal((await move('desativar')).status,'inativo');await db.exec('reset role');
 assert.equal(await value('select status value from vertice_extension_students where id=$1',id(42)),'ativo');
 assert.equal(await value('select count(*)::int value from vertice_private.extension_student_invites where project_id=$1 and revoked_at is not null and token_hash is null',id(31)),1);
 assert.equal(await value('select count(*)::int value from vertice_private.extension_student_invites where project_id=$1 and revoked_at is null',id(32)),1);
 await db.exec('set role authenticated');
});
test('recusa versão desatualizada e mudança direta que contorne o comando',async()=>{
 await assert.rejects(move('reativar',0),/outra sessão/);
 await assert.rejects(sql("update vertice_extension_students set status='ativo' where id=$1",id(41)),/ações autorizadas/);
});
test('retira e reintegra sem excluir horas, presença ou histórico',async()=>{
 assert.equal((await move('retirar',1)).status,'retirado');assert.equal((await move('reintegrar',2)).status,'inativo');await db.exec('reset role');
 assert.equal(await value('select count(*)::int value from vertice_extension_hour_entries where student_id=$1',id(41)),1);
 assert.equal(await value('select count(*)::int value from vertice_extension_activity_participation where student_id=$1',id(41)),1);
 assert.equal(await value('select hours_completed::int value from vertice_extension_students where id=$1',id(41)),10);
 await db.exec('set role authenticated');
});
test('exclusão é recuperável, bloqueia delete físico e preserva a conta',async()=>{
 assert.equal((await move('excluir',3)).status,'excluido');await assert.rejects(sql('delete from vertice_extension_students where id=$1',id(41)),/recuperável/);
 await assert.rejects(sql("update vertice_extension_students set full_name='Alterado' where id=$1",id(41)),/Recupere/);
 assert.equal((await move('restaurar',4)).status,'inativo');assert.equal((await move('reativar',5)).status,'ativo');
 await db.exec('reset role');assert.equal(await value('select count(*)::int value from auth.users where id=$1',id(4)),1);
 assert.equal(await value('select count(*)::int value from vertice_private.extension_student_invites where project_id=$1 and revoked_at is not null',id(31)),1);
 assert.equal(await value("select count(*)::int value from vertice_extension_project_history where field_changed=$1",'student_lifecycle:'+id(41)),6);
 await db.exec('set role authenticated');
});
test('exige motivo, recusa ação inválida e não permite falsificar estado no insert',async()=>{
 await assert.rejects(sql("select vertice_extension_student_lifecycle($1,$2,'desativar',0,'')",id(43),id(31)),/motivo/);
 await assert.rejects(move('apagar_tudo',0,43),/Ação inválida/);
 await assert.rejects(sql("insert into vertice_extension_students(id,institution_id,project_id,status,lifecycle_version) values($1,$2,$3,'ativo',5)",id(44),id(11),id(31)),/ações de gestão/);
});
