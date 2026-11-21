import {describe,expect,it} from 'vitest';
import {classErrorMap,noteKey,studentMisconceptions,type ErrorEvidence} from './error-map';
import {buildRecoveryPlan,nextDue,recoveryCsv,scheduleItems} from './recovery';
import {toAssemblyItems} from './exam-assembly';
import {competencyKeyOf} from './competency-key';
import type {Mastery} from './competency-mastery';
import type {BankQuestion} from './question-bank';

const ev=(errors:ErrorEvidence['errors'],students=5):ErrorEvidence=>({scope:'application',applications:[],objectiveAnswers:[],answeredBank:[],
 students:Array.from({length:students},(_,i)=>({studentId:'s'+i,label:'Aluno '+i,applications:1})),errors});
const err=(s:number,q:string,note:string|null)=>({studentId:'s'+s,label:'Aluno '+s,applicationId:'a1',questionId:q,statement:'Enunciado '+q,optionId:'B',note,competencies:['cmp:c2|prescrição']});

describe('mapa de erros conceituais',()=>{
 it('normaliza a descrição para somar o mesmo erro',()=>{
  expect(noteKey(' Confunde  Prescrição com decadência. ')).toBe('confunde prescricao com decadencia');
 });
 it('agrupa por erro, conta alunos e marca o recorrente (≥ 30% com ≥ 5 alunos)',()=>{
  const m=classErrorMap(ev([err(0,'q1','Confunde prescrição com decadência'),err(1,'q2','confunde prescricao com decadencia.'),
   err(1,'q1','Confunde prescrição com decadência'),err(2,'q3','Ignora a anterioridade'),err(3,'q3',null),err(4,'q3',null)]));
  expect(m.totalStudents).toBe(5);
  expect(m.misconceptions[0]).toMatchObject({note:'Confunde prescrição com decadência',students:2,occurrences:3,questions:2,share:0.4,recurrent:true});
  expect(m.misconceptions[1]).toMatchObject({students:1,recurrent:false});
  expect(m.unmapped).toEqual([{applicationId:'a1',questionId:'q3',statement:'Enunciado q3',wrong:2}]);
 });
 it('turma pequena não marca recorrência',()=>{
  expect(classErrorMap(ev([err(0,'q1','x'),err(1,'q1','x')],3)).misconceptions[0].recurrent).toBe(false);
 });
 it('erros de um aluno, do mais frequente',()=>{
  const e=ev([err(1,'q1','A'),err(1,'q2','B'),err(1,'q3','b'),err(2,'q1','A')]);
  expect(studentMisconceptions(e,{studentId:'s1',label:'Aluno 1'})).toEqual([{note:'B',count:2},{note:'A',count:1}]);
 });
});

const C2={id:'k2',code:'C2',title:'Prescrição',period:2},C3={id:'k3',code:'C3',title:'Lançamento',period:3};
const K2=competencyKeyOf(C2),K3=competencyKeyOf(C3);
const rec=(bankId:string,comp:typeof C2,d:1|2|3|4|5=3):BankQuestion=>({bankId,revision:1,institutionId:'i',courseId:'c',discipline:'Trib',createdAt:'2026-11-01T00:00:00Z',status:'rascunho',
 competencies:[comp],question:{id:bankId,disciplineId:'Trib',kind:'objetiva',statement:'Item '+bankId,options:[],correctOptionId:'',rubric:'',topicIds:[],competencyIds:[comp.id],purpose:['formativa'],estimatedDifficulty:d,points:1,examTags:[],images:[]}});
const m=(competency:string,level:Mastery['level'],value:number):Mastery=>({studentKey:'s1',studentId:'s1',label:'Ana',competency,value,items:3,applications:1,lastAppliedOn:'2027-06-01',level});

describe('plano de recuperação',()=>{
 const bank=[rec('a',C2),rec('b',C2),rec('c',C2),rec('d',C2),rec('e',C2,2),rec('f',C3,5),rec('g',C3,2)];
 const cal={a:{applications:1,n:20,p:0.9,discrimination:0.3},b:{applications:1,n:20,p:0.6,discrimination:0.2},
  c:{applications:1,n:20,p:0.7,discrimination:0.5},d:{applications:1,n:20,p:0.66,discrimination:0.1}};
 it('itens na zona 50–80%, mais perto de 65%, sem repetir o já respondido; reserva declarada sinalizada',()=>{
  const p=buildRecoveryPlan({masteries:[m(K2,'nao_demonstrado',0.2),m(K3,'em_desenvolvimento',0.5)],items:toAssemblyItems(bank,cal,{}),calibration:cal,answered:new Set(['d'])});
  expect(p.competencies).toEqual([K2,K3]);
  // b (60%) e c (70%) equidistantes de 65%: desempata a maior discriminação (c). a (90%) fora da zona; d já respondido.
  expect(p.items.filter(i=>i.competency===K2).map(i=>i.bankId)).toEqual(['c','b','e']);
  expect(p.items.find(i=>i.bankId==='e')).toMatchObject({source:'declarada',expected:null});
  expect(p.items.filter(i=>i.competency===K3).map(i=>i.bankId)).toEqual(['g']);
  expect(p.gaps).toEqual([]);
 });
 it('competência dominada fica fora; sem itens adequados vira lacuna',()=>{
  const p=buildRecoveryPlan({masteries:[m(K2,'domina',0.9),m(K3,'nao_demonstrado',0.1)],items:toAssemblyItems([rec('f',C3,5)],{},{}),calibration:{},answered:new Set()});
  expect(p.competencies).toEqual([K3]);expect(p.items).toEqual([]);expect(p.gaps).toEqual([K3]);
 });
});

describe('repetição espaçada (Leitner 1–3–7–15)',()=>{
 it('acerto avança, erro volta, acerto na última caixa consolida',()=>{
  const items=[{bankId:'b'},{bankId:'c'}];
  expect(scheduleItems(items,'2027-07-01',[])[0]).toMatchObject({box:0,due:'2027-07-02',status:'em_revisao'});
  const s=scheduleItems(items,'2027-07-01',[
   {bankId:'b',on:'2027-07-02',correct:true},{bankId:'b',on:'2027-07-05',correct:true},
   {bankId:'c',on:'2027-07-02',correct:false},
   {bankId:'b',on:'2027-07-12',correct:true},{bankId:'b',on:'2027-07-27',correct:true}]);
  expect(s.find(x=>x.bankId==='b')).toMatchObject({status:'consolidado',due:null,reviews:4});
  expect(s.find(x=>x.bankId==='c')).toMatchObject({box:0,due:'2027-07-03',lastResult:false});
  expect(nextDue(s)).toBe('2027-07-03');
 });
 it('ordem dos registros pela data, determinística',()=>{
  const a=scheduleItems([{bankId:'b'}],'2027-07-01',[{bankId:'b',on:'2027-07-05',correct:false},{bankId:'b',on:'2027-07-02',correct:true}]);
  expect(a[0]).toMatchObject({box:0,due:'2027-07-06'});
 });
 it('exporta CSV com ; e aspas',()=>{
  expect(recoveryCsv([{student:'Ana',competency:'C2',statement:'Item; "x"',due:'2027-07-02',status:'em revisão',reviews:0}]).split('\n')[1])
   .toBe('Ana;C2;"Item; ""x""";2027-07-02;em revisão;0');
 });
});

describe('empate exato apesar do ponto flutuante',()=>{
 it('60% e 70% empatam e decide a discriminação',()=>{
  const items=toAssemblyItems([rec('x',C2),rec('y',C2)],{x:{applications:1,n:20,p:0.7,discrimination:0.1},y:{applications:1,n:20,p:0.6,discrimination:0.4}},{});
  const p=buildRecoveryPlan({masteries:[m(K2,'nao_demonstrado',0.1)],items,calibration:{x:{applications:1,n:20,p:0.7,discrimination:0.1},y:{applications:1,n:20,p:0.6,discrimination:0.4}},answered:new Set()});
  expect(p.items.map(i=>i.bankId)).toEqual(['y','x']);
 });
});
