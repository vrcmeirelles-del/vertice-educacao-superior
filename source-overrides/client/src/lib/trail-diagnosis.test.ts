import {describe,expect,it} from 'vitest';
import {diagnoseCourse,diagnoseTrail,TRAIL_DIAGNOSIS_RULES} from './trail-diagnosis';

const T={id:'t1',code:'T1',name:'Direito Civil'};
const q=(year:number,number:number,nat:number,ies:number,trail='t1')=>({trail_id:trail,enade_year:year,question_number:number,national_correct_pct:nat,ies_correct_pct:ies});

describe('diagnóstico das trilhas por regras',()=>{
 it('sem questões: sem evidência e prioridade zero',()=>{
  const f=diagnoseTrail(T,[]);
  expect(f.evidence).toBe('sem_evidencia');expect(f.priority).toBe(0);expect(f.status).toBeNull();
 });
 it('menos de 3 questões: insuficiente, sem prioridade, mas com discrepância calculada',()=>{
  const f=diagnoseTrail(T,[q(2022,1,60,40),q(2022,2,50,45)]);
  expect(f.evidence).toBe('insuficiente');expect(f.meanGap).toBe(-12.5);expect(f.priority).toBe(0);
  expect(f.recommendations[0]).toMatch(/insuficiente/);
 });
 it('crítico sistêmico com lacuna de base: prioridade com fator',()=>{
  // gaps: 2018: -8,-10 ; 2022: -14,-16 → média -12; desvio < 10 → sistêmico
  const f=diagnoseTrail(T,[q(2018,1,70,62),q(2018,2,50,40),q(2022,3,65,51),q(2022,4,45,29)]);
  expect(f.meanGap).toBe(-12);expect(f.status).toBe('critico');expect(f.pattern).toBe('sistemico');
  // inclinação: (−9 → −15 em 4 anos) = −1,5 pp/ano → estável (limiar 2)
  expect(f.slope).toBe(-1.5);expect(f.trend).toBe('estavel');
  // lacuna de base: só 2022 Q3 (nacional 65%, IES −14 pp); 2018 Q1 fica em −8 pp
  expect(f.basicGapItems).toBe(1);
  expect(f.priority).toBeCloseTo(12*2*TRAIL_DIAGNOSIS_RULES.basicGapFactor,2);
 });
 it('piora acentuada aplica fator e recomenda verificar mudanças',()=>{
  const f=diagnoseTrail(T,[q(2018,1,50,50),q(2018,2,50,48),q(2021,3,50,38),q(2024,4,50,26)]);
  expect(f.trend).toBe('piorando');
  const base=Math.max(0,-f.meanGap!)*Math.sqrt(4);
  expect(f.priority).toBeCloseTo(base*TRAIL_DIAGNOSIS_RULES.worseningFactor,1);
  expect(f.recommendations.join(' ')).toMatch(/piorando/);
 });
 it('padrão pontual quando o desvio é alto',()=>{
  const f=diagnoseTrail(T,[q(2022,1,50,52),q(2022,2,50,49),q(2022,3,50,20)]);
  expect(f.pattern).toBe('pontual');expect(f.worst[0]).toEqual({year:2022,number:3,gap:-30});
  expect(f.recommendations.join(' ')).toMatch(/questões de maior lacuna/);
 });
 it('trilha forte recomenda registrar práticas',()=>{
  const f=diagnoseTrail(T,[q(2022,1,40,48),q(2022,2,50,55),q(2022,3,30,36)]);
  expect(f.status).toBe('forte');expect(f.priority).toBe(0);expect(f.recommendations.join(' ')).toMatch(/referência/);
 });
 it('curso: ordena por prioridade, conta situações e é determinístico',()=>{
  const trails=[T,{id:'t2',code:'T2',name:'Penal'},{id:'t3',code:'T3',name:'Vazia'}];
  const qs=[q(2022,1,60,40),q(2022,2,60,42),q(2022,3,60,44),q(2022,4,50,49,'t2'),q(2022,5,50,51,'t2'),q(2022,6,50,50,'t2')];
  const a=diagnoseCourse(trails,qs),b=diagnoseCourse([...trails].reverse(),[...qs].reverse());
  expect(a.findings.map(f=>f.code)).toEqual(['T1','T2','T3']);
  expect(a.counts).toEqual({critico:1,atencao:0,estavel:1,forte:0,insuficiente:1});
  expect(a.weightedGap).toBe(-9);
  expect(a.text).toBe(b.text);
  expect(a.text).toContain('Prioridades: 1º T1 — Direito Civil');
 });
});
