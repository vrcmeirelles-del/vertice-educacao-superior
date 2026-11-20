import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,id} from './fixture.mjs';

test('rascunho cria, lista, reabre e atualiza sem perder histórico',async t=>{
 const {db,rpc,question}=await fixture(t);
 const c=await rpc('create',{questions:[question]});
 assert.equal(c.revision,1);assert.equal(c.status,'draft');
 const listed=await rpc('list');assert.equal(listed.drafts.length,1);
 const loaded=await rpc('get',{id:c.id});assert.equal(loaded.snapshot.questions.length,1);
 const updated=await rpc('update',{id:c.id,expectedRevision:1,questions:[{...question,statement:'Novo enunciado sobre relações jurídicas e responsabilidade civil.'}]});
 assert.equal(updated.id,c.id);assert.equal(updated.revision,2);
 await db.exec('reset role'); // auditoria técnica somente no banco isolado; usuário autenticado não possui SELECT direto
 const events=await db.query('select action,revision,snapshot->\'questions\'->0->>\'statement\' as title from vertice_avalia.assessment_draft_events order by revision');
 assert.deepEqual(events.rows.map(x=>x.revision),[1,2]);
 assert.notEqual(events.rows[0].title,events.rows[1].title);
});
test('rejeita revisão defasada',async t=>{
 const {rpc,question}=await fixture(t);
 const d=await rpc('create',{questions:[question]});
 await assert.rejects(()=>rpc('update',{id:d.id,expectedRevision:0,questions:[question]}),/Conflito de versão/);
});
test('bloqueia uso sem MFA AAL2',async t=>{
 const {rpc,session,question}=await fixture(t);await session(id(1),'equipe','aal1');
 await assert.rejects(()=>rpc('create',{questions:[question]}),/MFA/);
});
test('bloqueia professor não vinculado à disciplina',async t=>{
 const {rpc,session,question}=await fixture(t);await session(id(2),'equipe');
 await assert.rejects(()=>rpc('create',{questions:[question]}),/não autorizado/);
});
test('bloqueia curso de outra IES e IDOR de rascunho',async t=>{
 const {rpc,session,question}=await fixture(t);
 const d=await rpc('create',{questions:[question]});
 await assert.rejects(()=>rpc('get',{id:d.id},id(31),id(12)),/não autorizado|não encontrado/);
 await session(id(2),'master');
 await assert.rejects(()=>rpc('get',{id:d.id}),/não encontrado/);
});
test('não aceita mídia ainda sem upload autorizado',async t=>{
 const {rpc,question}=await fixture(t);
 await assert.rejects(()=>rpc('create',{questions:[{...question,pendingImageCount:1}]}),/Quantidade de imagens inválida/);
});
test('não permite escrita direta em tabela privada ao usuário autenticado',async t=>{
 const {db}=await fixture(t);
 await assert.rejects(()=>db.query('select * from vertice_avalia.assessment_drafts'),/permission denied/);
});
test('bloqueia currículo não publicado e não presume mapeamento',async t=>{
 const {db,rpc,question}=await fixture(t);
 await db.exec('reset role');
 await db.query('insert into vertice_app.curriculum_builds values($1,$2,$3,$4)',[id(41),id(11),id(21),'draft']);
 await db.exec(`set role authenticated;set "request.jwt.claim.sub"='${id(1)}';set "request.jwt.claim.aal"='aal2';set "test.role"='equipe'`);
 await assert.rejects(()=>rpc('create',{questions:[question],buildId:id(41)}),/não vinculado/);
 const unmapped=await rpc('create',{questions:[question]});
 const receipt=await rpc('get',{id:unmapped.id});
 assert.equal(receipt.snapshot.curriculumStatus,'unmapped');
});

test('estrutura real: rejeita course_id válido com institution_id de outra IES',async t=>{
 const {db}=await fixture(t);
 await db.exec('reset role');
 await assert.rejects(
   ()=>db.query(`insert into vertice_avalia.assessment_drafts
     (institution_id,course_id,discipline_code,author_id,snapshot)
     values ($1,$2,'civil',$3,'{}'::jsonb)`,[id(12),id(21),id(1)]),
   /Curso pertence a outra instituição/
 );
 await assert.rejects(
   ()=>db.query(`insert into vertice_avalia.question_media
     (institution_id,course_id,discipline_code,question_id,created_by,
      storage_path,expected_sha256,mime,size_bytes)
     values ($1,$2,'civil',$3,$4,'forged/path.png',$5,'image/png',1024)`,
     [id(12),id(21),id(51),id(1),'a'.repeat(64)]),
   /Curso pertence a outra instituição/
 );
});
