import {describe,expect,it} from 'vitest';
import {analyzeDeclaredDraft,type PedagogicalDraft} from './declared-analysis';
import type {QuestionDraft} from './question-draft';
const question:QuestionDraft={
 id:'q1',disciplineId:'civil',kind:'objetiva',statement:'Questão jurídica de demonstração',
 options:[{id:'A',text:'Sim'},{id:'B',text:'Não'}],correctOptionId:'A',rubric:'',
 topicIds:['t1'],competencyIds:['c1','c2'],purpose:['formativa'],
 estimatedDifficulty:3,points:2,examTags:['oab'],images:[]
};
const config:PedagogicalDraft={
 currentPeriod:4,targetDifficulty:3,purpose:'formativa',examFocus:'oab',
 requiredCompetencyIds:['c1','c2','c3'],requiredTopicIds:['t1','t2'],
 competencies:[
  {id:'c1',code:'C1',title:'Competência inicial',period:2},
  {id:'c2',code:'C2',title:'Competência atual',period:4},
  {id:'c3',code:'C3',title:'Competência futura',period:5}
 ],
 topics:[{id:'t1',title:'Tema coberto',period:4},{id:'t2',title:'Tema não coberto',period:4}],
 relations:[{sourceCompetencyId:'c1',targetCompetencyId:'c2',kind:'aprofundamento'}]
};
describe('pré-análise longitudinal com informações docentes declaradas',()=>{
 it('calcula cobertura e lacunas mas nunca declara PPC verificado',()=>{
  const r=analyzeDeclaredDraft({institutionId:'ies',courseId:'dir',disciplineId:'civil',questions:[question],config});
  expect(r.verified).toBe(false);
  expect(r.analysis.totals.points).toBe(2);
  expect(r.analysis.coverage.competencies.find(x=>x.id==='c3')?.items).toBe(0);
  expect(r.analysis.coverage.competencies.every(x=>x.verifiedItems===0)).toBe(true);
  expect(r.analysis.findings.map(x=>x.code)).toContain('COMPETENCY_GAP');
  expect(r.analysis.findings.map(x=>x.code)).toContain('TOPIC_GAP');
 });
 it('não substitui julgamento pedagógico do conteúdo',()=>{
  const r=analyzeDeclaredDraft({institutionId:'ies',courseId:'dir',disciplineId:'civil',questions:[question],config});
  expect(r.notice).toMatch(/não comprova aderência ao PPC/);
  expect(r.analysis.findings.map(x=>x.code)).toContain('DECLARED_ONLY');
 });
});
