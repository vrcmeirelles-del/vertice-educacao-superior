import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
import {groundedLinks} from '../../../supabase/functions/vertice-doc-prevalidate/document-text.mjs';
const root=new URL('../../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const I='10000000-0000-4000-8000-000000000001',F='20000000-0000-4000-8000-000000000001',A='30000000-0000-4000-8000-000000000001';
test('documentary endpoints have no AI path, even if environment is enabled',()=>{
 for(const name of ['vertice-doc-prevalidate','vertice-doc-analyze']){
  const src=read(`supabase/functions/${name}/index.ts`);
  assert.doesNotMatch(src,/analyzeWithAI|analyzeEvidence|analyzeWithClaude|api\.anthropic|api\.openai|aiAllowed|AI_SUSPENDED/);
 }
});
test('grounding rejects correct text attributed to a different spreadsheet cell',()=>{
 const text='Registro de carga horária de extensão validada pelo coordenador.';
 const link={evidence_excerpts:[{page:null,section:'sheet!B2',text}]};
 assert.equal(groundedLinks([link],{pages:[{section:'sheet!A1',page:null,text}]}).length,0);
});
test('real PostgreSQL functions: claim, duplicate, rollback, lease, retry limit, revision and privileges',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema storage;
 create table storage.objects(bucket_id text,name text,updated_at timestamptz,metadata jsonb);
 create table vertice_institutions(id uuid primary key);
 create table vertice_documents(id uuid,institution_id uuid,storage_path text,file_name text);
 create table vertice_repository_files(id uuid,institution_id uuid,storage_path text,file_name text);
 insert into vertice_institutions values('${I}');insert into vertice_documents values('${F}','${I}','original.pdf','original.pdf');
 insert into storage.objects values('vertice-documents','original.pdf',now(),'{}');`);
 const base=read('supabase/migrations/20261111170000_prevalidation_mirroring.sql');
 await db.exec(base.slice(0,base.indexOf('-- 5.'))+base.slice(base.indexOf('-- 6.'),base.indexOf('-- 7.')));
 await db.exec(`alter table vertice_instrument_catalog add source_provenance jsonb;
 insert into vertice_instrument_catalog(id,institution_id,instrument_code,instrument_label) values('${A}','${I}','reconhecimento_curso','IACG');
 insert into vertice_instrument_objects(catalog_id,object_code,object_label) values('${A}','2.1','NDE');`);
 await db.exec(read('supabase/migrations/20261117113047_enade360_evidence_text_index.sql').split('create index')[0]);
 await db.exec(read('supabase/migrations/20261120153725_documentary_rules_reliability.sql'));
 const claim=async(action='analyze')=>(await db.query('select vertice_doc_claim_rules($1,$2,$3,$4,$5,$6) j',[I,'vertice_documents',F,A,action,'regras-test'])).rows[0].j;
 let c=await claim();assert.equal(c.status,'claimed');const id=c.prevalidation_id;
 assert.equal((await claim()).prevalidation_id,id);assert.equal((await claim()).status,'processing');
 const text='Reunião do núcleo docente estruturante para revisão curricular.';
 await db.query(`update vertice_doc_prevalidation set source_sha256=repeat('a',64),extraction_status='ready',extracted_pages=$2 where id=$1`,[id,JSON.stringify([{page:1,section:null,text}])]);
 const link={instrument_code:'reconhecimento_curso',instrument_version:'2017',object_code:'2.1',dimension:'2',compatibility:'alta',justification:'Texto literal para conferência',evidence_excerpts:[{page:1,text}]};
 const finish=async(links)=>(await db.query('select vertice_doc_finish_rules($1,$2,$3) j',[id,JSON.stringify({summary:'Sugestão por regras',nature:'Ata'}),JSON.stringify(links)])).rows[0].j;
 await assert.rejects(()=>finish([link,{...link,object_code:'9.9'}]),/unknown_indicator/);
 assert.equal((await db.query('select count(*)::int n from vertice_doc_indicator_links')).rows[0].n,0);
 assert.equal((await db.query('select ai_status from vertice_doc_prevalidation where id=$1',[id])).rows[0].ai_status,'processing');
 await assert.rejects(()=>finish([{...link,evidence_excerpts:[{page:2,text}]}]),/ungrounded_excerpt/);
 assert.equal((await finish([link])).links_created,1);
 c=await claim();assert.equal(c.cached,true);assert.equal(c.prevalidation_id,id);
 assert.equal((await db.query('select status,reviewed_by from vertice_doc_indicator_links')).rows[0].status,'sugerido');
 await db.exec("update storage.objects set updated_at=updated_at+interval '1 second'");
 c=await claim();assert.equal(c.status,'claimed');assert.notEqual(c.prevalidation_id,id);
 for(let n=0;n<3;n++){
  await db.query("update vertice_doc_prevalidation set lease_until=now()-interval '1 minute' where id=$1",[c.prevalidation_id]);
  c=await claim();
 }
 assert.equal(c.status,'retry_limit');
 await db.exec("update storage.objects set updated_at=updated_at+interval '1 second'");assert.equal((await claim()).status,'claimed');
 await db.exec('set role authenticated');await assert.rejects(()=>claim(),/permission denied/);
 }finally{await db.close();}
});

test('offline benchmark refuses unreviewed gold; correct precision/recall with abstention and false suggestion',async()=>{
 const {evaluate}=await import('../../evaluate-document-rules.mjs');
 const catalogs=[{id:'c1',instrument_code:'reconhecimento_curso',instrument_version:'2017'}],objects=[{catalog_id:'c1',object_code:'2.1',object_label:'Núcleo Docente Estruturante – NDE'}];
 const positive='Ata de reunião do Núcleo Docente Estruturante do curso de Direito para revisão curricular.';
 const neutral='Registro de entrega de materiais para o evento da comunidade, conforme lista anexa.';
 const doc=(id,text,expected)=>({id,kind:'digital',fileName:'Ata.docx',reviewed_by:['A','B'],extraction:{text,pages:[{page:1,text}],partial:false},expected});
 const k='reconhecimento_curso/2017/2.1';
 const input={catalogs,objects,documents:[doc('a',positive,[k]),doc('b',positive,[]),doc('c',neutral,[k])]};
 const result=evaluate(input);assert.equal(result.tp,1);assert.equal(result.fp,1);assert.equal(result.fn,1);assert.equal(result.precision,.5);assert.equal(result.recall,.5);assert.equal(result.abstained,1);
 input.documents[0].reviewed_by=['A'];assert.throws(()=>evaluate(input),/two_human_reviewers_required/);
});
