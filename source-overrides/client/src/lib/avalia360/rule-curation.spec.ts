import {describe,it,expect} from 'vitest';
import {curateQuestion} from './rule-curation';
import type {QuestionDraft} from './question-draft';
import type {PedagogicalDraft} from './declared-analysis';
const config:PedagogicalDraft={
 currentPeriod:3,targetDifficulty:3,purpose:'formativa',examFocus:'oab',
 requiredCompetencyIds:['c1'],requiredTopicIds:['t1'],
 competencies:[{id:'c1',title:'Aplicar normas jurídicas',code:'C1',period:3}],
 topics:[{id:'t1',title:'Responsabilidade civil',period:3}],relations:[]
};
const base:QuestionDraft={
 id:'q1',disciplineId:'Direito Civil',kind:'objetiva',statement:'  Em uma situação hipotética, analise as alternativas  ',
 options:[{id:'A',text:'Primeira alternativa'},{id:'B',text:'Segunda alternativa'}],
 correctOptionId:'A',rubric:'',topicIds:['t1'],competencyIds:['c1'],
 purpose:['formativa'],estimatedDifficulty:3,points:2,examTags:['oab'],images:[]
};
describe('curadoria algorítmica da questão',()=>{
 it('sugere apenas normalização tipográfica e preserva o conteúdo',()=>{
  const out=curateQuestion(base,config);
  expect(out.suggestedStatement).toBe('Em uma situação hipotética, analise as alternativas.');
  expect(out.substantiveReview).toBe('not-performed');
  expect(out.needsTeacherReview).toBe(true);
  expect(base.statement).toContain('  Em');
  expect(out.findings.map(f=>f.code)).toContain('WHITESPACE');
 });
 it('aponta alternativas duplicadas sem inventar nova alternativa',()=>{
  const q={...base,options:[{id:'A',text:'Direito Civil'},{id:'B',text:' direito   civil '}],correctOptionId:''};
  const out=curateQuestion(q,config);
  expect(out.findings.map(f=>f.code)).toEqual(expect.arrayContaining(['DUPLICATE_OPTIONS','NO_KEY']));
  expect(out.suggestedStatement).not.toContain('Direito Civil');
 });
 it('não declara competência curricular validada nem corrige o mérito jurídico',()=>{
  const q={...base,competencyIds:[],topicIds:[],examTags:[]};
  const out=curateQuestion(q,config);
  expect(out.findings.map(f=>f.code)).toEqual(expect.arrayContaining(['NO_COMPETENCIES','NO_TOPICS','EXAM_NOT_MAPPED']));
  expect(out.version).toBe('rules-curation-1.0');
 });
 it('sinaliza ausência do padrão de resposta esperado sem inventar resposta-modelo',()=>{
  const result=curateQuestion({...base,kind:'discursiva',rubric:'Fundamentação jurídica e conclusão, dois pontos.',expectedAnswer:''},config);
  expect(result.findings.map(x=>x.code)).toContain('MISSING_EXPECTED_ANSWER');
  expect(result.substantiveReview).toBe('not-performed');
 });
 it('exige rubrica para questão discursiva',()=>{
  const out=curateQuestion({...base,kind:'discursiva',rubric:''},config);
  expect(out.findings.map(f=>f.code)).toContain('MISSING_RUBRIC');
 });
});
