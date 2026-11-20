import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,id} from './fixture.mjs';
const sha='a'.repeat(64);
test('imagem confirmada é preservada no snapshot e reabertura do rascunho',async t=>{
 const {db,rpc,question}=await fixture(t);
 const media=await db.query('SELECT public.vertice_avalia_media($1,$2,$3,$4,$5,$6) as result',[
  id(11),id(21),'civil',id(51),'prepare',{sha256:sha,mime:'image/png',sizeBytes:1200}
 ]);
 const ticket=media.rows[0].result;
 await db.exec('reset role');
 const finalized=await db.query('SELECT public.vertice_avalia_media_finalize($1,$2,$3,$4) as result',[
  ticket.imageId,sha,1200,'image/png'
 ]);
 assert.equal(finalized.rows[0].result.sha256,sha);
 await db.exec(`set role authenticated;set "request.jwt.claim.sub"='${id(1)}';set "request.jwt.claim.aal"='aal2';set "test.role"='equipe'`);
 const image={imageId:ticket.imageId,path:ticket.path,sha256:sha,mime:'image/png',sizeBytes:1200,
  altText:'Gráfico de incidência de responsabilidade objetiva',caption:'Figura A',
  placement:'enunciado',rightsStatus:'autoral',order:0};
 const draft=await rpc('create',{questions:[{...question,id:id(51),pendingImageCount:1,images:[image]}]});
 assert.equal(draft.revision,1);
 const opened=await rpc('get',{id:draft.id});
 assert.equal(opened.snapshot.questions[0].images[0].imageId,ticket.imageId);
 assert.equal(opened.snapshot.questions[0].images[0].altText,image.altText);
});
test('imagem confirmada não pode ser usada em outra questão',async t=>{
 const {db,rpc,question}=await fixture(t);
 const media=await db.query('SELECT public.vertice_avalia_media($1,$2,$3,$4,$5,$6) as result',[
  id(11),id(21),'civil',id(51),'prepare',{sha256:sha,mime:'image/png',sizeBytes:1200}
 ]);
 const ticket=media.rows[0].result;
 await db.exec('reset role');
 await db.query('SELECT public.vertice_avalia_media_finalize($1,$2,$3,$4)',[ticket.imageId,sha,1200,'image/png']);
 await db.exec(`set role authenticated;set "request.jwt.claim.sub"='${id(1)}';set "request.jwt.claim.aal"='aal2';set "test.role"='equipe'`);
 const image={imageId:ticket.imageId,path:ticket.path,sha256:sha,mime:'image/png',sizeBytes:1200,
  altText:'Gráfico de responsabilidade civil',placement:'enunciado',rightsStatus:'autoral',order:0};
 await assert.rejects(()=>rpc('create',{questions:[{...question,id:id(52),pendingImageCount:1,images:[image]}]}),
   /fora do escopo/);
});
test('imagem pendente não pode ser gravada na questão',async t=>{
 const {db,rpc,question}=await fixture(t);
 const media=await db.query('SELECT public.vertice_avalia_media($1,$2,$3,$4,$5,$6) as result',[
  id(11),id(21),'civil',id(51),'prepare',{sha256:sha,mime:'image/png',sizeBytes:1200}
 ]);
 const ticket=media.rows[0].result;
 const image={imageId:ticket.imageId,path:ticket.path,sha256:sha,mime:'image/png',sizeBytes:1200,
  altText:'Imagem de caso jurídico',placement:'enunciado',rightsStatus:'autoral',order:0};
 await assert.rejects(()=>rpc('create',{questions:[{...question,id:id(51),pendingImageCount:1,images:[image]}]}),
  /não confirmada/);
});

test('imagem sem declaração de direitos de uso é rejeitada',async t=>{
 const {db,rpc,question}=await fixture(t);
 const media=await db.query('SELECT public.vertice_avalia_media($1,$2,$3,$4,$5,$6) as result',[
  id(11),id(21),'civil',id(51),'prepare',{sha256:sha,mime:'image/png',sizeBytes:1200}
 ]);
 const ticket=media.rows[0].result;
 await db.exec('reset role');
 await db.query('SELECT public.vertice_avalia_media_finalize($1,$2,$3,$4)',[ticket.imageId,sha,1200,'image/png']);
 await db.exec(`set role authenticated;set "request.jwt.claim.sub"='${id(1)}';set "request.jwt.claim.aal"='aal2';set "test.role"='equipe'`);
 const image={imageId:ticket.imageId,path:ticket.path,sha256:sha,mime:'image/png',sizeBytes:1200,
  altText:'Gráfico de incidência de responsabilidade objetiva',placement:'enunciado',order:0};
 await assert.rejects(()=>rpc('create',{questions:[{...question,id:id(51),pendingImageCount:1,images:[image]}]}),
  /Imagem não confirmada ou fora do escopo/);
});
