// Contrato mastery-feed: provedor REAL do Fato & Ordem (PGlite) → validação e agregação da Vértice.
// Uso: FATO_ORDEM_REPO=/caminho/fato-e-ordem node --test scripts/tests/sapiens-runtime/mastery-feed.test.mjs
import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';
import {masteryContract,aggregateMastery,MASTERY_RULES} from '../../../supabase/functions/vertice-learning-bridge/mastery.ts';
const fo=process.env.FATO_ORDEM_REPO;if(!fo)throw Error('Set FATO_ORDEM_REPO to a checkout of the paired F&O branch');
const {fixture,id,token}=await import(pathToFileURL(resolve(fo,'test/helpers/sapiens-fixture.mjs')));

test('feed real do F&O passa no contrato, inclusive com tema vazio da origem',async t=>{
 const f=await fixture();t.after(()=>f.db.close());
 const feed=await f.bridge.masteryFeed(id(11));
 const records=masteryContract(feed,id(11));
 // 6 vínculos verificados na IES 11 (o 7º não verificado fica de fora na origem).
 assert.equal(records.length,6);
 assert.ok(records.every(r=>r.theme===''&&r.discipline==='Civil'));
 // Nada de outra instituição atravessa: o envelope é da IES pedida.
 assert.throws(()=>masteryContract(feed,id(12)),/envelope/);
});

test('agrega só matrículas ativas, suprime grupos pequenos e não devolve tokens',async t=>{
 const f=await fixture();t.after(()=>f.db.close());
 const records=masteryContract(await f.bridge.masteryFeed(id(11)),id(11));
 // Roster da Vértice: alunos 1..5 ativos no curso 21; o aluno 6 (curso 22) não tem matrícula ativa.
 const roster=[1,2,3,4,5].map(n=>({student_token:token(n),course_id:id(21),course_name:'Direito'}));
 const snap=aggregateMastery(records,roster);
 assert.equal(snap.coverage.matchedStudents,5);assert.equal(snap.coverage.unmatchedStudents,1);
 assert.equal(snap.groups.length,1);
 assert.deepEqual(snap.groups[0],{courseId:id(21),courseName:'Direito',discipline:'Civil',theme:'',students:5,meanPKnow:0.25,studentsBelow:5,attempts:50,accuracy:0});
 assert.equal(JSON.stringify(snap).includes(token(1)),false,'nenhum token sai da agregação');
 // Com 4 alunos o grupo é suprimido.
 const small=aggregateMastery(records,roster.slice(0,MASTERY_RULES.minGroup-1));
 assert.equal(small.groups.length,0);assert.equal(small.coverage.suppressedGroups,1);assert.equal(small.disciplines.length,0);
});
