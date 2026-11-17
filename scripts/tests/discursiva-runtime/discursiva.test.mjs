import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {validateQuestion,validateGrade,signQR,verifyQR} from '../../../supabase/functions/vertice-discursiva/core.ts';
import {runAction} from '../../../supabase/functions/vertice-discursiva/handler.ts';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const q={case:'Um caso fictício com fatos suficientes para uma análise fundamentada.',command:'Analise e justifique a decisão proposta.',expectedAnswer:'Uma resposta fundamentada nos fatos descritos e nas fontes.',competency:'Analisar evidências',difficulty:'medium',rubric:[{criterion:'Análise',points:6},{criterion:'Decisão',points:4}],referenceIds:['source:1']};
const grade=(total=10)=>({criteria:[{index:0,score:total*.6,reason:'Raciocínio presente',evidence:['Resposta']},{index:1,score:total*.4,reason:'Decisão fundamentada',evidence:['fundamentada']}],feedback:'Reveja os pontos indicados.'});
test('question requires grounded sources and rubric totaling ten',()=>{
 assert.equal(validateQuestion(q,[{id:'source:1'}]).sources.length,1);
 assert.throws(()=>validateQuestion({...q,referenceIds:['fake']},[{id:'source:1'}]));
 assert.throws(()=>validateQuestion({...q,rubric:[{criterion:'Teste',points:11}]},[{id:'source:1'}]));
});
test('grade rejects hallucinated evidence, excessive points, NaN and missing criteria',()=>{
 assert.equal(validateGrade(grade(),q,'Resposta fundamentada').total,10);
 for(const mutate of [g=>g.criteria[0].score=7,g=>g.criteria[0].evidence=['não foi escrito'],g=>g.criteria[0].score=NaN,g=>g.criteria.pop(),g=>g.criteria[0].evidence=[]]){const g=grade();mutate(g);assert.throws(()=>validateGrade(g,q,'Resposta fundamentada'));}
});
test('QR signature detects altered metadata and wrong signing key',async()=>{
 const p={v:1,purpose:'discursiva-answer',examId:id(1),questionId:id(2),institutionId:id(3),courseId:id(4),page:1};const secret='synthetic-'.repeat(6);const token=await signQR(p,secret);
 assert.deepEqual(await verifyQR(token,secret),p);await assert.rejects(verifyQR(token,secret+'x'));
 await assert.rejects(verifyQR(token.replace(/.$/,'!'),secret));
});
test('grade independently calls both providers and saves suggestion with optimistic version, never finalizes',async()=>{
 const actions=[],calls=[];const deps={authorize:async()=>{},rpc:async(a,p)=>{actions.push([a,p]);return {submission:{id:id(5),answer:'Resposta fundamentada',version:3},question:{content:q}};},call:async p=>{calls.push(p);return{content:JSON.stringify(grade(p==='openai'?10:8)),provider:p,model:'synthetic'};}};
 const r=await runAction({action:'grade',submissionId:id(5)},deps);assert.deepEqual(calls,['openai','anthropic']);assert.equal(r.suggestedScore,9);assert.equal(r.requiresHumanReview,true);assert.equal(actions[1][0],'save_assessment');assert.equal(actions[1][1].version,3);assert(!actions.some(([a])=>a==='finalize'));
});
test('no provider call when course authorization or transcription confirmation fails',async()=>{
 let calls=0;const deps={authorize:async()=>{throw Error('denied');},call:async()=>calls++};await assert.rejects(runAction({action:'grade'},deps));assert.equal(calls,0);
 deps.authorize=async()=>{};deps.rpc=async()=>({submission:{image_path:'x',transcription_confirmed:false},question:{content:q}});await assert.rejects(runAction({action:'grade'},deps));assert.equal(calls,0);
});
test('generation re-reads selected sources and remains a draft even after positive AI review',async()=>{
 let content;const sources=[{source_table:'source',source_id:'1',excerpt:'Trecho de referência suficiente para testar o vínculo de fontes.',text_status:'ready'}];
 const deps={authorize:async()=>{},sources:async()=>sources,rpc:async(a,p)=>{assert.equal(a,'save_question');content=p.content;return{id:id(10)};},call:async p=>({content:JSON.stringify(p==='openai'?q:{approve:true,issues:[],reason:'Consistente com o excerto.'}),provider:p,model:'synthetic'})};
 const r=await runAction({action:'generate',discipline:'Teste',query:'tema',difficulty:'medium',sourceIds:['source:1']},deps);assert.equal(r.status,'draft');assert.equal(content.sources[0].id,'source:1');
 await assert.rejects(runAction({action:'generate',discipline:'Teste',query:'tema',difficulty:'medium',sourceIds:['source:other']},deps));
});
async function fixture(t){
 const db=new PGlite();await db.waitReady;t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema vertice_private;create schema storage;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;
 create table vertice_courses(id uuid,institution_id uuid,primary key(id,institution_id));create table vertice_learning_staff_scope(user_id uuid,institution_id uuid,course_id uuid,active boolean);
 create function vertice_private.member_role(uuid) returns text language sql stable as $$select current_setting('test.role',true)$$;
 create table vertice_documents(id uuid,institution_id uuid,course_id uuid,title text,extracted_text text,sha256 text);
 create table vertice_repository_requests(id uuid,institution_id uuid,course_id uuid);
 create table vertice_repository_files(id uuid,institution_id uuid,request_id uuid,file_name text);
 create table vertice_doc_prevalidation(id uuid,institution_id uuid,repository_file_id uuid,extracted_text text,source_sha256 text,extraction_status text,extracted_at timestamptz);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid,name text,bucket_id text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 grant usage on schema auth,public to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`);
 await db.exec(await readFile(new URL('../../../supabase/migrations/20261117171929_discursiva360.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../../supabase/migrations/20261117175935_discursiva_clinical_profiles.sql',import.meta.url),'utf8'));
 await db.query('insert into vertice_courses values($1,$2),($3,$2),($4,$5)',[id(21),id(11),id(22),id(23),id(12)]);
 await db.exec(`set role authenticated;set "request.jwt.claim.sub"='${id(1)}';set "request.jwt.claim.aal"='aal2';set "test.role"='master'`);
 const rpc=async(action,payload={},inst=id(11),course=id(21))=>(await db.query('select public.vertice_discursiva($1,$2,$3,$4) result',[inst,course,action,payload])).rows[0].result;
 return{db,rpc};
}
test('PostgreSQL complete cycle: private data, scope, draft approval, immutable exam and final score audit',async t=>{
 const {db,rpc}=await fixture(t);
 await assert.rejects(db.query('select * from vertice_discursiva.questions'),/permission denied/);
 const saved=await rpc('save_question',{discipline:'Teste',content:q});await assert.rejects(rpc('create_exam',{title:'Prova',student_ref:'A',question_ids:[saved.id]}),/homologadas/);
 await rpc('approve_question',{id:saved.id});const exam=await rpc('create_exam',{title:'Prova',student_ref:'A',question_ids:[saved.id]});
 await assert.rejects(rpc('get_exam',{id:exam.id},id(12),id(23)),/localizada/);
 await assert.rejects(rpc('submit',{exam_id:exam.id,question_id:id(999),answer:'Resposta'}),/pertence/);
 const s=await rpc('submit',{exam_id:exam.id,question_id:saved.id,answer:'Resposta fundamentada'});
 await rpc('save_assessment',{id:s.id,version:1,assessment:{suggestedScore:8}});
 await assert.rejects(rpc('finalize',{id:s.id,version:1,score:9,feedback:'Conferido pelo docente.'}),/alterada/);
 await assert.rejects(rpc('finalize',{id:s.id,version:2,score:11,feedback:'Conferido pelo docente.'}),/check constraint/);
 await rpc('finalize',{id:s.id,version:2,score:9,feedback:'Conferido pelo docente.'});
 await assert.rejects(rpc('save_assessment',{id:s.id,version:3,assessment:{}}),/homologada/);
 const result=await rpc('list');assert.equal(result.submissions[0].final_score,9);assert.equal(result.submissions[0].reviewed_by,id(1));
 await db.exec('reset role');assert.equal((await db.query("select count(*)::int n from vertice_discursiva.audit where action='finalize'")).rows[0].n,1);
});
test('PostgreSQL denies missing MFA, unauthorized role, other course and coordinator without binding',async t=>{
 const {db,rpc}=await fixture(t);await db.exec(`set "request.jwt.claim.aal"='aal1'`);await assert.rejects(rpc('list'),/MFA/);
 await db.exec(`set "request.jwt.claim.aal"='aal2';set "test.role"='leitor'`);await assert.rejects(rpc('list'),/Acesso/);
 await db.exec(`set "test.role"='coordenador'`);await assert.rejects(rpc('list'),/Acesso/);
 await db.exec('reset role');await db.query('insert into vertice_learning_staff_scope values($1,$2,$3,true)',[id(1),id(11),id(21)]);await db.exec('set role authenticated');
 assert.equal((await rpc('list')).questions.length,0);await assert.rejects(rpc('list',{},id(11),id(22)),/Acesso/);await assert.rejects(rpc('list',{},id(12),id(21)),/Acesso/);
});

test('PostgreSQL source retrieval excludes other courses/institutions and metadata-only files',async t=>{
 const {db,rpc}=await fixture(t);await db.exec('reset role');
 for(const [n,inst,course,txt] of [[1,11,21,'Conteúdo pedagógico de direito civil extraído para avaliação.'],[2,11,22,'Conteúdo de outro curso que não pode vazar para a coordenação.'],[3,12,23,'Conteúdo institucional de outra faculdade não autorizado.'],[4,11,null,'Conteúdo institucional reservado à gestão da instituição.'],[5,11,21,'']])await db.query('insert into vertice_documents values($1,$2,$3,$4,$5,null)',[id(100+n),id(inst),course?id(course):null,'Documento '+n,txt]);
 await db.exec('set role authenticated');assert.equal((await rpc('sources',{query:''})).sources.length,2);
 await db.exec('reset role');await db.query('insert into vertice_learning_staff_scope values($1,$2,$3,true)',[id(1),id(11),id(21)]);await db.exec(`set role authenticated;set "test.role"='coordenador'`);
 const result=await rpc('sources',{query:''});assert.equal(result.sources.length,1);assert.equal(result.sources[0].source_id,id(101));
});
test('transcription keeps independent readings and always requires human confirmation',async()=>{
 let n=0;const deps={authorize:async()=>{},image:async()=>({base64:'synthetic',mime:'image/png'}),call:async provider=>({content:JSON.stringify({text:++n===1?'não administrar':'administrar',uncertain:true,issues:['Negação ambígua.']}),provider,model:'synthetic'})};
 const r=await runAction({action:'transcribe',path:'synthetic'},deps);assert.equal(r.divergent,true);assert.equal(r.requiresHumanConfirmation,true);assert.equal(r.transcriptions.length,2);
});
test('metadata-only sources are refused before generation',async()=>{
 let calls=0;const deps={authorize:async()=>{},sources:async()=>[{source_table:'source',source_id:'1',excerpt:'Somente metadados; conteúdo ainda não indexado.',text_status:'catalog_only'}],call:async()=>{calls++;}};
 await assert.rejects(runAction({action:'generate',discipline:'Teste',query:'',difficulty:'medium',sourceIds:['source:1']},deps),/without_text/);assert.equal(calls,0);
});
test('all 24 original cases have complete practical commands and ten-point rubrics',async()=>{
 const {templates,templateContent}=await import('../../../source-overrides/client/src/lib/discursiva/templates.ts');assert.equal(templates.length,24);
 for(const t of templates){const c=templateContent(t);assert(c.case.length>=30);assert(c.command.length>=10);assert(c.expectedAnswer.length>=20);assert.equal(c.rubric.reduce((n,r)=>n+r.points,0),10);assert.equal(c.origin,'original_educational_draft');assert(c.validation.includes('Revisão docente'));}
});

const clinicalModule=await import('../../../source-overrides/shared/discursiva-clinical.ts');
const clinicalQ=()=>({...structuredClone(q),profile:'enamed',medicalArea:'Clínica Médica',referenceVersion:'Referência sintética de teste v1',clinicalExpected:Object.fromEntries(clinicalModule.CLINICAL_DIMENSIONS.map(d=>[d.key,'Resposta clínica específica e fundamentada no caso de teste.'])),rubric:clinicalModule.CLINICAL_DIMENSIONS.map(d=>({key:d.key,criterion:'Descritor clínico observável e específico deste caso: '+d.label,points:d.points})),sources:[{id:'source:1',excerpt:'Trecho sintético de referência usado apenas em teste de contrato.'}]});
test('medical profiles require four distinct clinical dimensions, reference version and residency program',()=>{
 const c=clinicalQ();assert.equal(clinicalModule.validateClinicalContent(c).profile,'enamed');
 for(const change of [c=>delete c.clinicalExpected.management,c=>c.rubric[1].key=c.rubric[0].key,c=>c.referenceVersion='',c=>c.medicalArea='genérica',c=>c.profile='official']){const c=clinicalQ();change(c);assert.throws(()=>clinicalModule.validateClinicalContent(c));}
 assert.throws(()=>clinicalModule.validateClinicalContent({...c,profile:'residencia'}),/program/);
 assert.equal(clinicalModule.validateClinicalContent({...c,profile:'residencia',residencyProgram:'Programa sintético 2026'}).profile,'residencia');
});
test('clinical generation propagates versioned profile and case-specific rubric to independent review and storage',async()=>{
 const saved=[],calls=[],c=clinicalQ();
 const deps={authorize:async()=>{},sources:async()=>[{source_table:'source',source_id:'1',excerpt:c.sources[0].excerpt,text_status:'ready'}],rpc:async(a,p)=>{saved.push([a,p]);return{id:id(300)};},call:async(provider,prompt,input)=>{calls.push({provider,prompt,input});return{content:JSON.stringify(provider==='openai'?c:{approve:true,issues:[],reason:'Verificação sintética.'}),provider,model:'synthetic'};}};
 const r=await runAction({action:'generate',discipline:'Clínica Médica',query:'',difficulty:'medium',sourceIds:['source:1'],profile:'enamed',medicalArea:c.medicalArea,referenceVersion:c.referenceVersion},deps);
 assert.equal(r.content.origin,'authorial_preparation');assert.equal(r.content.clinicalExpected.management,c.clinicalExpected.management);assert.equal(r.content.rubric.length,4);assert(calls[0].prompt.includes('CLÍNICO')||calls[0].prompt.includes('clínico'));assert.equal(calls[1].input.question.profile,'enamed');assert.equal(saved[0][1].content.referenceVersion,c.referenceVersion);assert.equal(r.status,'draft');
});
test('PostgreSQL validates clinical RPC submissions, blocks ungrounded approval and freezes medical metadata in exams',async t=>{
 const {db,rpc}=await fixture(t);const c=clinicalQ();
 await assert.rejects(rpc('save_question',{discipline:'Clínica Médica',content:{...c,clinicalExpected:{}}}),/clínica específica/);
 const noSources=await rpc('save_question',{discipline:'Clínica Médica',content:{...c,sources:[]}});await assert.rejects(rpc('approve_question',{id:noSources.id}),/fontes/);
 const saved=await rpc('save_question',{discipline:'Clínica Médica',content:{...c,origin:'official'}});await rpc('approve_question',{id:saved.id});
 const ex=await rpc('create_exam',{title:'Caso de preparação autoral',student_ref:'Aplicação sintética',question_ids:[saved.id]});const snap=(await rpc('get_exam',{id:ex.id})).snapshot[0].content;
 assert.equal(snap.profile,'enamed');assert.equal(snap.origin,'authorial_preparation');assert.equal(snap.rubric.length,4);assert.equal(snap.referenceVersion,c.referenceVersion);
});
test('clinical grading uses frozen case-specific clinical criteria and preserves mandatory review',async()=>{
 const c=clinicalQ();let prompt;const deps={authorize:async()=>{},rpc:async a=>a==='get_submission'?{submission:{id:id(10),answer:'Resposta fundamentada',version:1},question:{content:c}}:{},call:async(provider,p,input)=>{prompt=p;assert.deepEqual(input.question.clinicalExpected,c.clinicalExpected);return {provider,model:'synthetic',content:JSON.stringify({criteria:c.rubric.map((r,index)=>({index,score:r.points,reason:'Critério atendido no texto.',evidence:['Resposta']})),feedback:'Devolutiva clínica de teste.'})};}};
 const result=await runAction({action:'grade',submissionId:id(10)},deps);assert(prompt.includes('Avaliação clínica educacional'));assert.equal(result.suggestedScore,10);assert.equal(result.requiresHumanReview,true);
});
