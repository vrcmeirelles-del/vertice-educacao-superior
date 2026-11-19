import { describe, expect, it } from 'vitest';
import { analyzeAssessment, type AnalysisInput } from './longitudinal-engine';

const data: AnalysisInput = {
  assessment: { id:'av1', institutionId:'ies',courseId:'direito',period:7,disciplineId:'proc',
    purpose:['formativa'],examFocus:'oab',targetDifficulty:4,
    requiredCompetencyIds:['c1','c7'],requiredTopicIds:['t1','t2'],
    items:[
      {id:'q1',disciplineId:'proc',topicIds:['t1'],competencyIds:['c1','c7'],
        estimatedDifficulty:2,purpose:['formativa'],points:5,evidence:'validada',examTags:['oab']},
      {id:'q2',disciplineId:'proc',topicIds:['t1'],competencyIds:['c7'],
        estimatedDifficulty:2,purpose:['formativa'],points:5,evidence:'declarada'}
    ] },
  catalog: {competencies:[{id:'c1',code:'C1',period:1,relations:[{to:'c7',kind:'prerequisito'}]},
    {id:'c7',code:'C7',period:7}],
    topics:[{id:'t1',disciplineId:'proc',period:7},{id:'t2',disciplineId:'proc',period:7}]}
};
describe('Avalia 360 longitudinal core',()=>{
  it('detecta lacuna por tema, dificuldade e evidência não validada',()=>{
    const out=analyzeAssessment(data);
    expect(out.status).toBe('valid');
    expect(out.totals.meanEstimatedDifficulty).toBe(2);
    expect(out.coverage.topics.find(x=>x.id==='t2')?.items).toBe(0);
    expect(out.findings.map(x=>x.code)).toEqual(expect.arrayContaining([
      'TOPIC_GAP','DIFFICULTY_MISMATCH','DECLARED_ONLY','EXAM_TAG_MISSING']));
  });
  it('reconhece competência anterior e vínculo explícito',()=>{
    const out=analyzeAssessment(data);
    expect(out.longitudinal[0].prior).toEqual(['c1']);
    expect(out.longitudinal[0].links).toEqual(['prerequisito']);
    expect(out.coverage.competencies.find(x=>x.id==='c1')?.verifiedItems).toBe(1);
  });
  it('não inventa estatística e identifica amostra reduzida',()=>{
    const out=analyzeAssessment({...data,results:[{itemId:'q1',graded:4,correct:2}]});
    expect(out.performance[0]).toMatchObject({accuracy:0.5,status:'amostra_reduzida'});
    expect(out.performance[1].accuracy).toBeNull();
  });
  it('bloqueia dados inválidos sem produzir conclusões falsas',()=>{
    const out=analyzeAssessment({...data,assessment:{...data.assessment,items:[
      {...data.assessment.items[0],competencyIds:['inexistente'],points:-2},
      {...data.assessment.items[1],id:'q1'}
    ]},results:[{itemId:'q1',graded:2,correct:4}]});
    expect(out.status).toBe('incomplete');
    expect(out.findings.map(x=>x.code)).toEqual(expect.arrayContaining([
      'INVALID_POINTS','DUPLICATE_ITEM_ID','UNKNOWN_COMPETENCY','INVALID_RESULT']));
    expect(out.performance[0].accuracy).toBeNull();
  });
});
