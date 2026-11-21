import {describe,expect,it} from 'vitest';
import {mapCurriculumToAssessment} from './curriculum-import';
const input={
 institutionId:'ies-1',courseId:'curso-1',disciplineName:'Direito Civil',
 build:{id:'matriz-4',institution_id:'ies-1',course_id:'curso-1',status:'published',version:4},
 competencies:[
  {id:'c1',build_id:'matriz-4',code:'C1',title:'Competência civil',origin_period:2,period_status:'validated' as const},
  {id:'c2',build_id:'matriz-4',code:'C2',title:'Competência transversal',origin_period:3,period_status:'proposed' as const},
  {id:'c3',build_id:'matriz-4',code:'C3',title:'Competência sem período',origin_period:null,period_status:'proposed' as const}
 ],
 links:[
  {competency_id:'c1',discipline_name:' Direito   Civil '},
  {competency_id:'c2',discipline_name:'Direito Civil'},
  {competency_id:'c3',discipline_name:'Direito Civil'}
 ]
};
describe('importação de referências da Construção Curricular',()=>{
 it('preserva IDs e versão da matriz, distinguindo período homologado de proposto',()=>{
  const result=mapCurriculumToAssessment(input);
  expect(result.buildId).toBe('matriz-4');
  expect(result.buildVersion).toBe(4);
  expect(result.competencies.map(x=>x.id)).toEqual(['c1','c2']);
  expect(result.ready).toBe(false);
  expect(result.missingPeriods).toEqual(['C3']);
  expect(result.warnings.join(' ')).toMatch(/não homologados/);
 });
 it('recusa matriz de outro curso/IES e matriz não publicada',()=>{
  expect(()=>mapCurriculumToAssessment({...input,courseId:'outro'})).toThrow(/outra instituição ou curso/);
  expect(()=>mapCurriculumToAssessment({...input,build:{...input.build,status:'draft'}})).toThrow(/não está publicada/);
 });
 it('não fabrica competência quando não há vínculo com a disciplina',()=>{
  const r=mapCurriculumToAssessment({...input,disciplineName:'Direito Penal'});
  expect(r.competencies).toHaveLength(0);
  expect(r.warnings.join(' ')).toMatch(/Nenhuma competência/);
 });
 it('aceita como pronta somente matriz publicada com períodos homologados e válidos',()=>{
  const r=mapCurriculumToAssessment({...input,competencies:input.competencies.slice(0,1),links:input.links.slice(0,1)});
  expect(r.ready).toBe(true);
  expect(r.competencies).toEqual([{id:'c1',code:'C1',title:'Competência civil',period:2}]);
 });
});
