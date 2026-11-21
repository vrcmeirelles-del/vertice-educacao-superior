import {describe,expect,it} from 'vitest';
import {classReadiness,ENADE_TEMPLATE,studentReadiness,type ExamMatrix} from './readiness';
import {evaluateRisk,slopePer90} from './academic-risk';
import type {Mastery} from './competency-mastery';

const m=(competency:string,value:number,level:Mastery['level']='em_desenvolvimento'):Mastery=>({studentKey:'s1',studentId:'s1',label:'Ana',competency,value,items:3,applications:1,lastAppliedOn:'2027-06-01',level});
const matrix:ExamMatrix={id:'x',exam:'enade',label:'ENADE',edition:'2027',sourceRef:'Portaria',status:'validated',areas:[
 {key:'fg',label:'Formação Geral',weight:25,competencies:['cmp:fg1','cmp:fg2']},
 {key:'ce',label:'Componente Específico',weight:75,competencies:['cmp:c1','cmp:c2']}]};

describe('índice de prontidão',()=>{
 it('média ponderada pelas áreas com evidência',()=>{
  // FG = (0,8+0,6)/2 = 0,7 ; CE = (0,9+0,5)/2 = 0,7 ; índice = 0,7
  const r=studentReadiness([m('cmp:fg1',0.8),m('cmp:fg2',0.6),m('cmp:c1',0.9),m('cmp:c2',0.5)],matrix);
  expect(r.index).toBeCloseTo(0.7,9);expect(r.coverage).toBe(1);expect(r.level).toBe('pronto');
  expect(r.weakest).toEqual([]);
 });
 it('pesos importam e só competências com evidência entram',()=>{
  const r=studentReadiness([m('cmp:fg1',1),m('cmp:c1',0.4),m('cmp:c2',0.2,'evidencia_insuficiente')],matrix);
  // FG = 1 (peso 25); CE = 0,4 (só c1; peso 75) => (25 + 30)/100 = 0,55
  expect(r.index).toBeCloseTo(0.55,9);expect(r.level).toBe('em_desenvolvimento');
  expect(r.weakest).toEqual(['ce']);
 });
 it('cobertura abaixo de 50% não gera leitura',()=>{
  const r=studentReadiness([m('cmp:fg1',0.9)],matrix);
  expect(r.coverage).toBe(0.25);expect(r.level).toBe('evidencia_insuficiente');
 });
 it('agregado da turma e modelo do ENADE',()=>{
  const a=studentReadiness([m('cmp:fg1',0.8),m('cmp:c1',0.9)],matrix);
  const b=studentReadiness([m('cmp:fg1',0.3),m('cmp:c1',0.3)],matrix);
  const c=classReadiness([a,b],matrix);
  expect(c.counts).toMatchObject({pronto:1,risco:1});
  expect(c.meanIndex).toBeCloseTo((0.875+0.3)/2,9);
  expect(ENADE_TEMPLATE.map(x=>x.weight)).toEqual([25,75]);
 });
});

describe('sinal de risco acadêmico',()=>{
 it('inclinação por mínimos quadrados (conferida com numpy.polyfit)',()=>{
  // x = 0, 45, 90, 135 dias; y = 0,8; 0,7; 0,65; 0,5 -> b = -0,0021111/dia -> -0,19 por 90 dias
  expect(slopePer90([{x:0,y:0.8},{x:45,y:0.7},{x:90,y:0.65},{x:135,y:0.5}])).toBeCloseTo(-0.19,9);
  expect(slopePer90([{x:0,y:1},{x:0,y:0.5}])).toBeNull();
 });
 const s=(pairs:Array<[string,number]>)=>pairs.map(([d,v])=>({appliedOn:d,discipline:'Civil',total:v,max:1}));
 it('queda forte é alto risco, com motivo explícito',()=>{
  const r=evaluateRisk(s([['2027-01-01',0.8],['2027-02-15',0.7],['2027-04-01',0.65],['2027-05-16',0.5]]),[]);
  expect(r.level).toBe('alto');expect(r.reasons[0]).toMatch(/Queda de 19 p\.p\. a cada 90 dias/);
 });
 it('competências críticas e notas baixas',()=>{
  expect(evaluateRisk(s([['2027-01-01',0.9]]),[m('a',0.1,'nao_demonstrado'),m('b',0.2,'nao_demonstrado'),m('c',0.3,'nao_demonstrado')]).level).toBe('alto');
  expect(evaluateRisk(s([['2027-01-01',0.35],['2027-02-01',0.3]]),[]).reasons).toContain('As duas últimas notas abaixo de 40%');
  expect(evaluateRisk(s([['2027-01-01',0.45]]),[]).level).toBe('atencao');
  expect(evaluateRisk(s([['2027-01-01',0.8],['2027-03-01',0.85]]),[m('a',0.8,'domina')])).toMatchObject({level:null,reasons:[]});
 });
 it('tendência exige 3 provas',()=>{
  expect(evaluateRisk(s([['2027-01-01',0.9],['2027-04-01',0.6]]),[]).slope90).toBeNull();
 });
});
