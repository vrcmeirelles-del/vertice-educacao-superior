import {describe,it,expect} from 'vitest';
import {demoInstitutionCourses} from '../client/src/lib/demo-showroom';
import {premiumRows,premiumSummary} from '../client/src/components/bi/PremiumBI';

describe('BI Premium demonstrativo Vértice',()=>{
 it('suporta 6, 12 e 18 cursos sem dados de produção',()=>{
  for(const [mode,count] of [['faculdade',6],['centro',12],['universidade',18]] as const){
   const courses=demoInstitutionCourses(mode),rows=premiumRows(courses,'2026/2');
   expect(rows).toHaveLength(count);
   expect(rows.every(r=>r.students>=0&&r.note>=0&&r.absence>=0&&r.risk>=0)).toBe(true);
   expect(premiumSummary(rows).students).toBe(rows.reduce((s,c)=>s+c.students,0));
  }
 });
 it('respeita semestre e comparações sem usar base acadêmica real',()=>{
  const courses=demoInstitutionCourses('faculdade');
  const old=premiumRows(courses,'2025/2'),now=premiumRows(courses,'2026/2');
  expect(premiumSummary(now).students).toBeGreaterThan(premiumSummary(old).students);
  expect(premiumSummary([]).students).toBe(0);
  expect(premiumSummary(now).note).toBeGreaterThan(0);
 });
 it('mantém os indicadores limitados a números sintéticos do curso',()=>{
  const rows=premiumRows(demoInstitutionCourses('centro'),'2026/1');
  const target=rows.find(r=>r.id==='direito');
  expect(target?.name).toBe('Direito');
  expect(target?.students).toBeGreaterThan(0);
  expect(target?.score).toBeLessThanOrEqual(100);
  expect(target?.risk).toBeLessThanOrEqual(100);
 });
});
