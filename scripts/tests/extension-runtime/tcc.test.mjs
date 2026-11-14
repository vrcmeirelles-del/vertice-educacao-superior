import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const root=new URL('../../../',import.meta.url);
const models=JSON.parse(readFileSync(new URL('source-overrides/client/src/lib/tcc-forms/templates.json',root),'utf8'));
async function setup(){const db=new PGlite();
 await db.exec(readFileSync(new URL('./fixture.sql',import.meta.url),'utf8'));
 await db.exec('create table public.vertice_tcc_works(id uuid primary key,institution_id uuid,course_id uuid,title text,academic_term text,created_by uuid,stage text);create table public.vertice_tcc_participants(work_id uuid,institution_id uuid,person_email text,role text,valid_until timestamptz);');
 await db.exec(readFileSync(new URL('supabase/migrations/20261114142308_tcc_electronic_forms.sql',root),'utf8'));
 await db.exec(readFileSync(new URL('supabase/migrations/20261114143311_tcc_form_required_identity.sql',root),'utf8'));
 const defs=(await db.query('select code,definition from vertice_tcc_form_templates')).rows;for(const d of defs)assert.deepEqual(d.definition,models[d.code]);
 const guard=readFileSync(new URL('supabase/migrations/20261031112756_repository_classification.sql',root),'utf8');const start=guard.indexOf('create or replace function vertice_private.check_repository_file()');await db.exec(guard.slice(start,guard.indexOf('$$;',start)+3));await db.exec('create trigger repository_file_guard before insert on public.vertice_repository_files for each row execute function vertice_private.check_repository_file()');
 await db.exec(`insert into auth.users values ${[1,2,3,4,5,6,7].map(n=>`('${id(n)}','u${n}@example.org')`).join(',')};insert into vertice_institutions values('${id(11)}','IES fictícia'),('${id(12)}','Outra IES');insert into vertice_courses values('${id(21)}','${id(11)}','Direito'),('${id(22)}','${id(12)}','Outro curso');insert into vertice_memberships values ${[1,2,3,4,5,6].map(n=>`('${id(n)}','${id(11)}','${n===4?'gestor':n===6?'leitor':'equipe'}')`).join(',')};insert into vertice_tcc_works values('${id(31)}','${id(11)}','${id(21)}','TCC FICTÍCIO','2026/2','${id(4)}','draft'),('${id(32)}','${id(12)}','${id(22)}','OUTRO TCC','2026/2','${id(4)}','draft');insert into vertice_tcc_participants values('${id(31)}','${id(11)}','u1@example.org','author',null),('${id(31)}','${id(11)}','u2@example.org','advisor',null),('${id(31)}','${id(11)}','u3@example.org','examiner',null);`);
 return db;
}
async function claims(db,n,aal='aal2'){await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[id(n),aal]);}
const answers=t=>({...Object.fromEntries(models[t].fields.map(f=>[f.key,f.type==='number'?'0':f.type==='date'?'2026-11-14':f.type==='select'?f.options[0]:'DADO FICTÍCIO'])),title:'TCC FICTÍCIO',semester:'2026/2',grade2:'',grade3:'',examiner2:'',examiner3:''});
const save=async(db,{form=41,template='convite',a=answers(template),revision=0,attachments=[],pdf=null,work=31,inst=11}={})=>(await db.query('select * from public.vertice_tcc_form_save($1,$2,$3,$4,$5,$6,$7,$8)',[id(form),id(inst),id(work),template,a,attachments,revision,pdf])).rows[0];
test('TCC roles, MFA, stale revisions, canonical scope and direct-table write denial',async()=>{const db=await setup();
 await claims(db,6);await assert.rejects(save(db),/não autorizada/);
 await claims(db,1,'aal1');await assert.rejects(save(db),/não autorizada/);
 await claims(db,1);await assert.rejects(save(db,{template:'aprovacao'}),/vínculo/);await assert.rejects(save(db,{template:'aceite'}),/vínculo/);
 await assert.rejects(save(db,{work:32}),/nesta instituição/);await assert.rejects(save(db,{revision:null}),/Revisão inválida/);
 const f=await save(db,{a:{title:'TÍTULO FORJADO',authors:'Autor fictício',secret:'NÃO ARQUIVAR'}});assert.equal(f.answers.title,'TCC FICTÍCIO');assert.equal(f.answers.secret,undefined);
 await assert.rejects(save(db),/outra sessão/);
 await claims(db,5);await assert.rejects(save(db,{revision:1}),/vínculo/);
 await claims(db,2);await save(db,{form:42,template:'aceite'});await assert.rejects(save(db,{form:43,template:'ata'}),/vínculo/);
 await claims(db,3);await save(db,{form:44,template:'ata'});
 await db.exec('set role authenticated');await assert.rejects(db.exec("update vertice_tcc_forms set answers='{}'"),/permission denied/);await db.exec('reset role');await claims(db,7);await db.exec('set role authenticated');assert.equal((await db.query('select count(*)::int n from vertice_tcc_forms')).rows[0].n,0);await db.close();
});
test('all templates emit once, preserve academic stage, reject invalid grades, missing originals and implicit consent',async()=>{const db=await setup();await claims(db,4);let n=100;
 for(const template of Object.keys(models)){
  const form=n++;const a=answers(template);let f=await save(db,{form,template,a});
  const path=`${id(11)}/tcc/${id(form)}/generated.pdf`,repo=`${id(11)}/${f.repository_request_id}/${id(form+1000)}.pdf`;
  const pdf={path,repository_path:repo,repository_file_id:id(form+1000),size:200,sha256:'a'.repeat(64)};
  await db.query('insert into storage.objects(bucket_id,name,metadata,owner_id) values($1,$2,$3,$4),($5,$6,$3,$4)',['vertice-documents',path,{size:200,mimetype:'application/pdf'},id(4),'vertice-repositorios',repo]);
  if(template==='publicacao'){
   f=await save(db,{form,template,a:{...a,permission:''},revision:f.revision});
   await assert.rejects(save(db,{form,template,a:f.answers,revision:f.revision,pdf}),/Campo obrigatório/);
   f=await save(db,{form,template,a,revision:f.revision});
  }
  if(template==='ata')await assert.rejects(save(db,{form,template,a:{...a,grade1:'11'},revision:f.revision}),/fora do intervalo/);
  let attachments=[];
  if(['final','dossie'].includes(template)){
   await assert.rejects(save(db,{form,template,a,revision:f.revision,pdf}),/original/);
   const original=`${id(11)}/tcc/${id(form)}/original.pdf`;
   attachments=[{id:id(form+2000),path:original,mime:'application/pdf',name:'original-ficticio.pdf',kind:'Documento assinado',size:100,sha256:'b'.repeat(64)}];
   await db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['vertice-documents',original,{size:100,mimetype:'application/pdf'}]);f=await save(db,{form,template,a,revision:f.revision,attachments});
  }
  const done=await save(db,{form,template,a:f.answers,revision:f.revision,attachments,pdf});assert.equal(done.status,'gerado');assert.ok(done.repository_file_id);
  await save(db,{form,template,a:f.answers,revision:f.revision,attachments,pdf});
  await assert.rejects(save(db,{form,template,a:f.answers,revision:f.revision}),/preservado/);
 }
 assert.equal((await db.query('select count(*)::int n from vertice_repository_files')).rows[0].n,Object.keys(models).length);
 assert.equal((await db.query('select stage from vertice_tcc_works where id=$1',[id(31)])).rows[0].stage,'draft');await db.close();
});
