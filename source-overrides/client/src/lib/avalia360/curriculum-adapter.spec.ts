import {describe,expect,it} from 'vitest';
import {adaptCurriculum,type AdapterInput} from './curriculum-adapter';
import {analyzeAssessment} from './longitudinal-engine';

const input: AdapterInput = {
  institutionId:'ies-A',courseId:'direito',
  build:{id:'build-v2',institution_id:'ies-A',course_id:'direito',version:2,status:'published'},
  competencies:[
    {id:'c1',build_id:'build-v2',code:'C1',title:'Fundamentos',sort_order:0},
    {id:'c7',build_id:'build-v2',code:'C7',title:'Aplicacao integrada',sort_order:1}],
  links:[{id:'l1',competency_id:'c1',discipline_name:'Introducao ao Direito',category:'basica',sort_order:0},
    {id:'l2',competency_id:'c7',discipline_name:'Processo Civil',category:'profissional',sort_order:0}],
  periods:[{competencyId:'c1',period:1,status:'validated'},{competencyId:'c7',period:7,status:'validated'}],
  relations:[{sourceCompetencyId:'c1',targetCompetencyId:'c7',kind:'prerequisito',status:'validated'}],
  topics:[{id:'t1',disciplineId:'processo',period:7,status:'validated'}]
};
describe('adaptador curricular Vértice Avalia 360°',()=>{
  it('aproveita matriz publicada sem supor periodos ou modificar a fonte',()=>{
    const copy=structuredClone(input);
    const result=adaptCurriculum(input);
    expect(result.ready).toBe(true);
    expect(result.source).toMatchObject({version:2,status:'published',institutionId:'ies-A'});
    expect(result.catalog.competencies[0]).toMatchObject({id:'c1',period:1,relations:[{to:'c7',kind:'prerequisito'}]});
    expect(result.disciplines[0].name).toBe('Introducao ao Direito');
    expect(input).toEqual(copy);
  });
  it('rejeita fonte de outra instituicao e versao nao publicada',()=>{
    const out=adaptCurriculum({...input,institutionId:'ies-B',build:{...input.build,status:'draft'}});
    expect(out.ready).toBe(false);
    expect(out.diagnostics.map(d=>d.code)).toEqual(expect.arrayContaining(['SCOPE_MISMATCH','UNPUBLISHED_BUILD']));
  });
  it('nao inventa periodos, temas ou relacoes',()=>{
    const out=adaptCurriculum({...input,periods:[],relations:[],topics:[]});
    expect(out.ready).toBe(false);
    expect(out.catalog.competencies).toEqual([]);
    expect(out.catalog.topics).toEqual([]);
    expect(out.diagnostics.filter(d=>d.code==='PERIOD_UNMAPPED')).toHaveLength(2);
  });
  it('ignora sugestoes ainda nao validadas',()=>{
    const out=adaptCurriculum({...input,relations:[{...input.relations![0],status:'proposed'}],
      topics:[{...input.topics![0],status:'proposed'}]});
    expect(out.catalog.competencies[0].relations).toEqual([]);
    expect(out.catalog.topics).toEqual([]);
  });
  it('fornece catalogo para o motor sem ler semanticamente questoes',()=>{
    const catalog=adaptCurriculum(input).catalog;
    const out=analyzeAssessment({catalog,assessment:{
      id:'av1',institutionId:'ies-A',courseId:'direito',period:7,disciplineId:'processo',
      purpose:['formativa'],targetDifficulty:4,requiredCompetencyIds:['c1','c7'],
      requiredTopicIds:['t1'],items:[{id:'q1',disciplineId:'processo',topicIds:['t1'],
      competencyIds:['c1','c7'],estimatedDifficulty:4,purpose:['formativa'],
      points:10,evidence:'validada'}]
    }});
    expect(out.status).toBe('valid');
    expect(out.longitudinal[0].prior).toEqual(['c1']);
    expect(out.longitudinal[0].links).toContain('prerequisito');
  });
});
