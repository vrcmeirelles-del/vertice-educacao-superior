import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pedagogicalRun} from '../../../supabase/functions/_shared/automacao360/pedagogical.mjs';
import {runConfig} from '../../../supabase/functions/_shared/automacao360/executor.mjs';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const I=id(101),J=id(102),C=id(201),D=id(202),E=id(203),G=id(1),H=id(2),U=id(3);
async function as(db,user,query,params=[],role='authenticated',aal='aal2') {
 await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false),set_config('request.jwt.claim.role',$3,false)",[user??'',aal,role]);
 await db.exec(`set role ${role}`);try{return await db.query(query,params)}finally{await db.exec('reset role')}
}
test('Sapiens: revisão humana, isolamento, concorrência, revogação e executor com PostgreSQL sintético',async t=>{
 const db=new PGlite();await db.waitReady;t.after(()=>db.close());
 await db.exec(await read('./fixture.sql'));
 const staff=await read('../../../supabase/migrations/20261122170000_course_staff_functions.sql');
 const start=staff.indexOf('create function vertice_private.course_function(');
 await db.exec(staff.slice(start,staff.indexOf('$$;',start)+3));
 for(const name of ['20261124210000_automacao360_nucleo.sql','20261124210001_automacao360_catalogo.sql','20261125090000_automacao360_executor.sql','20261125110000_automacao360_fontes_pedagogicas.sql'])await db.exec(await read('../../../supabase/migrations/'+name));
 await db.exec(`
 insert into auth.users values('${G}'),('${H}'),('${U}');
 insert into public.vertice_institutions(id,name) values('${I}','IES A'),('${J}','IES B');
 insert into public.vertice_courses(id,institution_id,name) values('${C}','${I}','A'),('${D}','${J}','B'),('${E}','${I}','C');
 insert into public.vertice_memberships values('${G}','${I}','gestor'),('${H}','${I}','gestor'),('${U}','${I}','equipe');
 insert into public.vertice_course_staff_functions values('${I}','${C}','${U}','coordenador',true);
 insert into public.vertice_learning_course_metrics values('${I}','${C}','2026/2','CIV','oab','competencia',50,15,10,now()),('${J}','${D}','2026/2','CIV','oab','competencia',50,15,10,now()),('${I}','${E}','2026/2','CIV','oab','competencia',50,15,10,now());`);
 await db.exec(await read('../../../supabase/migrations/20261125103656_automacao360_sapiens_reviewed_source.sql').catch(()=>read('../../../supabase/migrations_nao_aplicadas/20261125103656_automacao360_sapiens_reviewed_source.sql')));
 const rpc=(u,action,p={})=>as(db,u,'select public.vertice_automation_sapiens_review($1,$2,$3,$4) r',[I,C,action,p]);
 const list=async()=> (await rpc(U,'list')).rows[0].r;
 const source=async()=> (await as(db,null,'select public.vertice_automation_source_sapiens($1,$2) r',[I,C],'service_role')).rows[0].r;
 let row=(await list())[0];const payload=()=>({key:row.key,hash:row.hash,expectedReviewId:row.reviewId,finalGraded:30,finalCorrect:10,finalStudents:5,provisionalExcluded:true,evidenceRef:'ata-homologacao-sintetica',note:'Conferidas somente as respostas definitivas, sem notas provisórias.'});
 const evaluate=src=>pedagogicalRun({scope:{institutionId:I,courseId:C},config:{institutionId:I,courseId:C,enabled:true,approved:true,ruleIds:['sapiens.low'],maxAgeHours:24},source:src,asOf:new Date().toISOString()});
 await t.test('sem revisão não gera alerta nem zero fictício',async()=>{const out=evaluate(await source());assert.equal(out.alerts.length,0);assert.equal(out.issues[0].reason,'not_human_validated')});
 await t.test('MFA e curso atribuído são obrigatórios; acesso direto negado',async()=>{
  await assert.rejects(as(db,U,'select public.vertice_automation_sapiens_review($1,$2,\'list\')',[I,E]),/acesso negado/);
  await assert.rejects(as(db,U,'select public.vertice_automation_sapiens_review($1,$2,\'list\')',[J,D]),/acesso negado/);
  await assert.rejects(as(db,U,'select public.vertice_automation_sapiens_review($1,$2,\'list\')',[I,C],'authenticated','aal1'),/acesso negado/);
  await assert.rejects(as(db,U,'select public.vertice_automation_source_sapiens($1,$2)',[I,C]),/permission denied/);
  await assert.rejects(as(db,null,'select * from vertice_automation.sapiens_review',[],'service_role'),/permission denied/);
  await assert.rejects(as(db,null,'select public.vertice_automation_source_sapiens($1,$2)',[I,D],'service_role'),/curso fora/);
 });
 await t.test('não aceita pré-nota, amostra pequena, contadores forjados ou sem evidência',async()=>{
  for(const bad of [{provisionalExcluded:false},{finalGraded:29},{finalStudents:4},{finalCorrect:31},{finalGraded:51},{finalStudents:11},{finalCorrect:16},{finalCorrect:0,finalGraded:40},{evidenceRef:''},{note:''}])await assert.rejects(rpc(U,'validate',{...payload(),...bad}));
 });
 await t.test('revisão válida congela apenas subconjunto definitivo e identifica autor no servidor',async()=>{
  const p=payload();p.reviewed_by=G;await rpc(U,'validate',p);
  const src=await source();assert.equal(src.groups.length,1);assert.equal(src.groups[0].graded,30);assert.equal(src.groups[0].correct,10);
  assert.equal(evaluate(src).alerts[0].status,'pending_review');
  assert.equal((await db.query('select reviewed_by from vertice_automation.sapiens_review')).rows[0].reviewed_by,U);
  await assert.rejects(rpc(U,'validate',payload()),/concorrente/);
 });
 await t.test('revisão imutável; revogação é outro evento e interrompe elegibilidade',async()=>{
  await assert.rejects(db.exec("update vertice_automation.sapiens_review set final_correct=0"),/imutável/);
  row=(await list())[0];await rpc(U,'revoke',payload());assert.equal(evaluate(await source()).alerts.length,0);
  assert.equal((await db.query('select count(*)::int n from vertice_automation.sapiens_review')).rows[0].n,2);
 });
 await t.test('mudança na fonte invalida revisão sem a apagar; CAS recusa versão antiga',async()=>{
  row=(await list())[0];await rpc(U,'validate',payload());const old=payload();
  await db.exec(`update public.vertice_learning_course_metrics set correct=14 where institution_id='${I}' and course_id='${C}'`);
  assert.equal(evaluate(await source()).alerts.length,0);assert.equal((await list())[0].reviewCurrent,false);
  await assert.rejects(rpc(U,'validate',old),/fonte alterada/);
  row=(await list())[0];await rpc(U,'validate',payload());
 });
 await t.test('configuração requer outra pessoa; executor usa fonte revisada e só registra sombra',async()=>{
  const cfg=(await as(db,G,'select public.vertice_automation_propose_config($1,$2,$3,true,\'shadow\',24,0,\'Ensaio sintético autorizado\') id',[I,C,['sapiens.low']])).rows[0].id;
  await assert.rejects(as(db,G,'select public.vertice_automation_approve_config($1,\'Aprovação sintética\')',[cfg]),/autoaprovação/);
  await as(db,H,'select public.vertice_automation_approve_config($1,\'Aprovação sintética independente\')',[cfg]);
  const allowed=new Set(['vertice_automation_source_pedagogical','vertice_automation_source_sapiens','vertice_automation_record_run']);
  const rpcDB=async(name,args)=>{assert.ok(allowed.has(name));return (await as(db,null,name==='vertice_automation_record_run'?`select public.${name}($1) r`:`select public.${name}($1,$2) r`,name==='vertice_automation_record_run'?[args.p_payload]:[args.p_institution,args.p_course],'service_role')).rows[0].r};
  const result=await runConfig({config:{configId:cfg,institutionId:I,courseId:C,revision:1,ruleIds:['sapiens.low'],maxAgeHours:24,timeZone:'America/Sao_Paulo',mode:'shadow'},rpc:rpcDB});
  assert.equal(result.status,'evaluated');assert.equal(result.alerts,1);
  assert.equal((await db.query('select count(*)::int n from vertice_automation.alert')).rows[0].n,0);
 });
 await t.test('fonte ausente é parcial e não convertida em sucesso',async()=>{
  const out=await runConfig({config:{configId:1,institutionId:I,courseId:C,revision:1,ruleIds:['sapiens.low'],maxAgeHours:24,timeZone:'America/Sao_Paulo',mode:'shadow'},rpc:async(name,a)=>{if(name==='vertice_automation_source_sapiens')throw Error('unavailable');if(name==='vertice_automation_record_run')return {status:'inserted',runId:a.p_payload.runId,digest:a.p_payload.digest};return {institutionId:I,courseId:C,complete:true,groups:[]}}});assert.equal(out.status,'partial');assert.equal(out.alerts,0);
 });
});
