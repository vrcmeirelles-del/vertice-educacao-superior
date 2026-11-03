import {describe,it,expect,vi} from 'vitest';
vi.mock('../client/src/lib/supabase',()=>({supabase:{}}));
import {parseActionDraft,validateActionLinks,integratedSummary,documentActionSuggestions,mergeActionSuggestions,changeActionScope,type PortalData} from '../client/src/lib/portal-integration';
import {courseTotals,institutionEnrollmentSummary} from '../client/src/lib/enrollment-summary';
import {acquisitionSummary} from '../client/public/aquisicoes-app/management-summary.js';

const empty=():PortalData=>({courses:[],goals:[],measurements:[],diagnosis:[],actions:[],requests:[],files:[]});
describe('vínculos e consolidação institucional',()=>{
 it('não recupera rascunho de outra instituição, legado ou corrompido',()=>{
  expect(parseActionDraft('{','i1')).toEqual({});
  expect(parseActionDraft(JSON.stringify({what:'legado'}),'i1')).toEqual({});
  expect(parseActionDraft(JSON.stringify({institutionId:'i2',values:{what:'restrito'}}),'i1')).toEqual({});
  expect(parseActionDraft(JSON.stringify({institutionId:'i1',values:{what:'corrigir'}}),'i1')).toEqual({what:'corrigir'});
 });
 it('infere o curso da meta e rejeita vínculos incompatíveis ou indisponíveis',()=>{
  const data={courses:[{id:'c1'},{id:'c2'}],goals:[{id:'g1',course_id:'c1'}],diagnosis:[{id:'f2',course_id:'c2'}]};
  expect(validateActionLinks({goal_id:'g1'},data).course_id).toBe('c1');
  expect(()=>validateActionLinks({goal_id:'g1',course_id:'c2'},data)).toThrow('mesmo curso');
  expect(()=>validateActionLinks({goal_id:'g1',finding_id:'f2'},data)).toThrow('mesmo curso');
  expect(()=>validateActionLinks({goal_id:'externa'},data)).toThrow('não está disponível');
 });
 it('troca o curso sem manter metas incompatíveis e preserva o texto da ação',()=>{
  const data={goals:[{id:'g1',course_id:'c1'},{id:'g2',course_id:'c2'}],diagnosis:[{id:'f1',course_id:'c1'}]};
  expect(changeActionScope({what:'Preservar',course_id:'c2',goal_id:'g1',finding_id:'f1'},'course_id',data)).toEqual({what:'Preservar',course_id:'c2',goal_id:'',finding_id:''});
  expect(changeActionScope({course_id:'',goal_id:'g2'},'goal_id',data).course_id).toBe('c2');
 });
 it('uma ação concluída não esconde um achado ainda aberto',()=>{
  const data=empty();data.diagnosis=[{id:'f1',status:'aberto',course_id:'c1'}];data.actions=[{id:'a1',finding_id:'f1',course_id:'c1',status:'concluida'}];
  expect(integratedSummary(data,'c1').uncovered).toBe(1);
  data.actions[0].status='em_andamento';expect(integratedSummary(data,'c1').uncovered).toBe(0);
  expect(integratedSummary(data,'c1').signal).toBe('amber');
  expect(integratedSummary(data,'c2').signal).toBe('gray');
 });
 it('agrupa documentos por curso/meta, exclui NSA e usa a versão atual',()=>{
  const data=empty();data.courses=[{id:'c1',name:'Direito'},{id:'c2',name:'Enfermagem'}];
  data.requests=[{id:'r1',course_id:'c1'},{id:'r2',course_id:'c1',not_applicable:true},{id:'r3',course_id:'c2'},{id:'r4',course_id:'c1',active:false}];
  data.files=[{id:'f1',request_id:'r1',status:'validado',created_at:'2026-01-01'},{id:'f2',request_id:'r1',status:'devolvido',created_at:'2026-02-01'}];
  const result=documentActionSuggestions(data,'c1');expect(result).toHaveLength(1);expect(result[0].why).toContain('1 exigência(s)');expect(result[0].why).toContain('1 devolvida');
  data.actions=[{id:'a1',status:'em_andamento',what:result[0].title,course_id:'c1',why:result[0].why}];expect(documentActionSuggestions(data,'c1')).toHaveLength(0);
  data.actions[0].status='concluida';expect(documentActionSuggestions(data,'c1')).toHaveLength(1);
 });
 it('consolida uma meta e suas evidências em uma única sugestão sem misturar cursos',()=>{
  const primary={key:'g',title:'Meta',goal_id:'g1',course_id:'c1',why:'Prazo',how:'Etapas',evidence:'Medição'};
  const docs={...primary,key:'d',why:'Documento pendente',how:'Conferir arquivo',evidence:'Validação'};
  const merged=mergeActionSuggestions([primary],[docs]);expect(merged).toHaveLength(1);expect(merged[0].why).toContain('Documento pendente');expect(merged[0].evidence).toContain('Medição Validação');
  expect(mergeActionSuggestions([primary],[{...docs,course_id:'c2'}])).toHaveLength(2);
 });
});
describe('referências de matrícula',()=>{
 const row=(extra={})=>({course_id:'c1',semester:'2026.1',student_status:'MATRICULADO',class_label:'A',enrolled:10,reported_total:null,...extra});
 it('não soma uma linha total outra vez ao detalhamento das turmas',()=>{
  expect(courseTotals([row(),row({class_label:'B',enrolled:20}),row({class_label:'__TOTAL_CURSO__',enrolled:30})]).value).toBe(30);
  expect(courseTotals([row({class_label:'__TOTAL_CURSO__',enrolled:30})]).value).toBe(30);
  expect(courseTotals([row({reported_total:0})]).value).toBe(0);
 });
 it('usa o período da própria instituição e distingue falta de base de zero',()=>{
  const courses=[{id:'c1',institution_id:'i1'},{id:'c2',institution_id:'i2'}];
  const rows=[row(),row({course_id:'c2',semester:'2026.2',enrolled:0})];
  expect(institutionEnrollmentSummary('i1',courses,rows)).toMatchObject({semester:'2026.1',enrolled:10});
  expect(institutionEnrollmentSummary('i2',courses,rows)?.enrolled).toBe(0);
  expect(institutionEnrollmentSummary('i3',courses,rows)).toBeUndefined();
 });
});
describe('visão gerencial de aquisições',()=>{
 const workflow=()=>({states:[{id:'s1',requirement_id:'r1',answer:'preenchido'},{id:'s2',requirement_id:'r2',answer:''}],requirements:[{id:'r1',front:'ACA'},{id:'r2',front:'FIN'}],effective:[{state_id:'s1',valid:false,previous_review:{body:{decision:'verified'}}},{state_id:'s2',valid:true,review:{body:{decision:'not_applicable'}}}],events:[{id:'e1',body:{risk:'red',resolved:false,requirement_ids:['r1','r2'],due_date:'2026-11-02',closing_block:true}},{id:'e2',body:{risk:'red',resolved:true,requirement_ids:['r1'],due_date:'2026-01-01'}}],documents:[{id:'d1'},{id:'d2'}],links:[{id:'l1',document_id:'d1',state_id:'s1'},{id:'l2',document_id:'d1',state_id:'s2'}],checks:[{link_id:'l1',body:{result:'sufficient'}},{link_id:'missing',body:{result:'sufficient'}}]});
 it('não converte preenchimento, análise vencida ou NSA em conformidade',()=>{
  const s=acquisitionSummary(workflow(),{ACA:'Acadêmica',FIN:'Financeira'},'2026-11-03');
  expect(s.filled).toBe(1);expect(s.reviewed).toBe(1);expect(s.stale).toBe(1);expect(s.rows[0].counts.verified).toBe(0);expect(s.rows[1].counts.not_applicable).toBe(1);
  const w=workflow();w.events=[];expect(acquisitionSummary(w,{ACA:'Acadêmica',FIN:'Financeira'}).rows.map(r=>r.signal)).toEqual(['gray','gray']);
 });
 it('conta eventos distintos no total e respeita vínculos documentais acessíveis',()=>{
  const s=acquisitionSummary(workflow(),{ACA:'Acadêmica',FIN:'Financeira'},'2026-11-03');
  expect(s.events).toHaveLength(1);expect(s.rows.map(r=>r.open)).toEqual([1,1]);expect(s.red).toBe(1);expect(s.late).toBe(1);expect(s.blocked).toBe(1);expect(s.unlinked).toBe(1);expect(s.checked).toBe(1);
 });
});
