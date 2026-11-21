import {describe,expect,it} from 'vitest';
import {classMap,classRootCauses,computeMastery,diagnoseStudents,levelOf,rootCauses,type CompetencyEvidence,type MasteryLevel} from './competency-mastery';

const ref=new Date('2027-06-30T12:00:00Z');
const base=(rows:CompetencyEvidence['rows'],apps=[{id:'a1',appliedOn:'2027-06-30'}]):CompetencyEvidence=>({scope:'discipline',
 applications:apps.map(a=>({...a,classLabel:'3º',discipline:'Civil',title:'AV',status:'closed'})),
 competencies:[{key:'C1',code:'C1',title:'Contratos',period:3},{key:'C2',code:'C2',title:'Nexo causal',period:2},{key:'C0',code:'C0',title:'Fato jurídico',period:1}],
 relations:[{source:'C2',target:'C1',kind:'prerequisito'},{source:'C0',target:'C2',kind:'prerequisito'}],rows});

describe('domínio por competência',()=>{
 it('faixas e mínimo de questões',()=>{
  expect(levelOf(0.7,2)).toBe('domina');expect(levelOf(0.4,2)).toBe('em_desenvolvimento');
  expect(levelOf(0.39,5)).toBe('nao_demonstrado');expect(levelOf(1,1)).toBe('evidencia_insuficiente');expect(levelOf(null,9)).toBe('evidencia_insuficiente');
 });
 it('decaimento: aplicação de 180 dias atrás pesa metade',()=>{
  // antiga (2027-01-01, 180 dias antes): 0/2 ; recente: 2/2 => (0.5*0 + 1*2)/(0.5*2 + 1*2) = 2/3
  const e=base([
   {studentId:'s1',label:'Ana',applicationId:'old',competency:'C1',score:0,max:2,items:1},
   {studentId:'s1',label:'Ana',applicationId:'new',competency:'C1',score:2,max:2,items:1}],
   [{id:'old',appliedOn:'2027-01-01'},{id:'new',appliedOn:'2027-06-30'}]);
  const [m]=computeMastery(e,ref);
  expect(m.value).toBeCloseTo(2/3,6);
  expect(m).toMatchObject({items:2,applications:2,lastAppliedOn:'2027-06-30',level:'em_desenvolvimento'});
 });
 it('sem decaimento quando tudo é da mesma data e determinístico',()=>{
  const e=base([{studentId:'s1',label:'Ana',applicationId:'a1',competency:'C1',score:3,max:4,items:3}]);
  expect(computeMastery(e,ref)[0].value).toBe(0.75);
  expect(computeMastery(e,ref)).toEqual(computeMastery(e,ref));
 });
 it('folha identificada por código vira aluno próprio',()=>{
  const e=base([{studentId:null,label:'X-01',applicationId:'a1',competency:'C1',score:1,max:1,items:2}]);
  expect(computeMastery(e,ref)[0].studentKey).toBe('label:x-01');
 });
});

describe('mapa da turma',()=>{
 const rows=(vals:number[],comp='C2')=>vals.map((v,i)=>({studentId:'s'+i,label:'Aluno '+i,applicationId:'a1',competency:comp,score:v,max:1,items:2}));
 it('retomar quando 60% ou mais ficam abaixo de 50%',()=>{
  const m=classMap(computeMastery(base(rows([0.2,0.3,0.4,0.9,1])),ref),base([]).competencies);
  expect(m.find(c=>c.competency==='C2')).toMatchObject({evaluated:5,status:'retomar',belowShare:0.6});
 });
 it('consolidada, em desenvolvimento e amostra pequena',()=>{
  const comps=base([]).competencies;
  expect(classMap(computeMastery(base(rows([0.8,0.9,0.7,0.75,1])),ref),comps).find(c=>c.competency==='C2')?.status).toBe('consolidada');
  expect(classMap(computeMastery(base(rows([0.6,0.6,0.55,0.3,0.2])),ref),comps).find(c=>c.competency==='C2')?.status).toBe('em_desenvolvimento');
  expect(classMap(computeMastery(base(rows([0.1,0.1])),ref),comps).find(c=>c.competency==='C2')?.status).toBe('amostra_pequena');
 });
});

describe('causa-raiz pelos pré-requisitos',()=>{
 const rel=base([]).relations;
 const lv=(o:Record<string,MasteryLevel>)=>new Map(Object.entries(o)) as Map<string,MasteryLevel>;
 it('aponta o pré-requisito mais profundo não dominado',()=>{
  expect(rootCauses(lv({C1:'nao_demonstrado',C2:'nao_demonstrado',C0:'em_desenvolvimento'}),rel).find(r=>r.competency==='C1'))
   .toEqual({competency:'C1',roots:['C0'],unverified:[]});
 });
 it('se a base está dominada, a causa é o pré-requisito imediato',()=>{
  expect(rootCauses(lv({C1:'nao_demonstrado',C2:'em_desenvolvimento',C0:'domina'}),rel).find(r=>r.competency==='C1')?.roots).toEqual(['C2']);
 });
 it('pré-requisito sem evidência fica "a verificar", nunca como causa',()=>{
  expect(rootCauses(lv({C1:'nao_demonstrado'}),rel)).toEqual([{competency:'C1',roots:[],unverified:['C2']}]);
 });
 it('pré-requisitos dominados não geram causa; ciclo não trava',()=>{
  expect(rootCauses(lv({C1:'nao_demonstrado',C2:'domina',C0:'domina'}),rel)).toEqual([]);
  const ciclo=[{source:'A',target:'B',kind:'prerequisito' as const},{source:'B',target:'A',kind:'prerequisito' as const}];
  expect(rootCauses(lv({A:'nao_demonstrado',B:'nao_demonstrado'}),ciclo)).toEqual([
   {competency:'A',roots:['B'],unverified:[]},{competency:'B',roots:['A'],unverified:[]}]);
 });
 it('relações que não são pré-requisito são ignoradas',()=>{
  expect(rootCauses(lv({C1:'nao_demonstrado',C2:'nao_demonstrado'}),[{source:'C2',target:'C1',kind:'aprofundamento'}])).toEqual([]);
 });
 it('agregado da turma conta alunos por par dificuldade → origem',()=>{
  const rows=['s1','s2','s3'].flatMap(s=>[
   {studentId:s,label:s,applicationId:'a1',competency:'C1',score:0,max:2,items:2},
   {studentId:s,label:s,applicationId:'a1',competency:'C2',score:s==='s3'?2:0,max:2,items:2}]);
  const e=base(rows);
  const d=diagnoseStudents(computeMastery(e,ref),e.relations);
  expect(classRootCauses(d)).toEqual([{competency:'C1',root:'C2',students:2}]);
 });
});
