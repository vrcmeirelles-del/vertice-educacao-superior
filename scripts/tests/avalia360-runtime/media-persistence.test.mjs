import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,id} from './fixture.mjs';
const sha='a'.repeat(64);
const payload={sha256:sha,mime:'image/png',sizeBytes:1024};
const media=async db=>{
 const r=await db.query("select public.vertice_avalia_media($1,$2,$3,$4,$5,$6) as result",
 [id(11),id(21),'civil',id(51),'prepare',payload]);return r.rows[0].result;
};
test('ticket é individual, com caminho gerado e metadados vinculados',async t=>{
 const {db}=await fixture(t);
 const ticket=await media(db);
 assert.match(ticket.path,new RegExp('^'+id(11)+'/'+id(21)+'/'+id(1)+'/'+id(51)+'/'));
 assert.equal(ticket.imageId.length,36);
 const details=await db.query('select public.vertice_avalia_media($1,$2,$3,$4,$5,$6) as result',[
 id(11),id(21),'civil',id(51),'inspect',{imageId:ticket.imageId,path:ticket.path}]);
 assert.equal(details.rows[0].result.state,'pending');
 assert.equal(details.rows[0].result.sha256,sha);
});
test('sem MFA o ticket não é emitido',async t=>{
 const {db,session}=await fixture(t);
 await session(id(1),'equipe','aal1');
 await assert.rejects(()=>media(db),/MFA obrigatório/);
});
test('usuário de outro curso não emite ticket',async t=>{
 const {db,session}=await fixture(t);
 await session(id(2),'equipe','aal2');
 await assert.rejects(()=>media(db),/Acesso negado/);
});
test('cliente não pode chamar finalização privilegiada',async t=>{
 const {db}=await fixture(t);
 await assert.rejects(()=>db.query('select public.vertice_avalia_media_finalize($1,$2,$3,$4)',[
 id(91),sha,1024,'image/png']),/permission denied/);
});
test('finalização exige hash real e não aceita confirmação repetida',async t=>{
 const {db}=await fixture(t);
 const ticket=await media(db);
 await db.exec('reset role');
 await assert.rejects(()=>db.query('select public.vertice_avalia_media_finalize($1,$2,$3,$4)',[
 ticket.imageId,'b'.repeat(64),1024,'image/png']),/integridade falhou/);
 const result=await db.query('select public.vertice_avalia_media_finalize($1,$2,$3,$4) as receipt',[
 ticket.imageId,sha,1024,'image/png']);
 assert.equal(result.rows[0].receipt.sha256,sha);
 await assert.rejects(()=>db.query('select public.vertice_avalia_media_finalize($1,$2,$3,$4)',[
 ticket.imageId,sha,1024,'image/png']),/integridade falhou/);
});
test('não lê metadados privados diretamente como autenticado',async t=>{
 const {db}=await fixture(t);
 await assert.rejects(()=>db.query('select * from vertice_avalia.question_media'),/permission denied/);
});

test('bloqueia excesso de tickets pendentes mesmo variando a questão',async t=>{
 const {db,session}=await fixture(t);
 await db.exec('reset role');
 await db.query(`INSERT INTO vertice_avalia.question_media
  (institution_id,course_id,discipline_code,question_id,created_by,
   storage_path,expected_sha256,mime,size_bytes)
 SELECT $1,$2,'civil',gen_random_uuid(),$3,
   'synthetic/pending/'||g::text||'.png',repeat('a',64),'image/png',1024
 FROM generate_series(1,24) g`,[id(11),id(21),id(1)]);
 await session(id(1),'equipe','aal2');
 await assert.rejects(()=>media(db),/Limite de tickets pendentes atingido/);
});
