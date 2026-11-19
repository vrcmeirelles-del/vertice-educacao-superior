import { describe, expect, it } from 'vitest';
import { preflightAndAnalyze, type PreflightInput } from './assessment-preflight';
import { projectInstitutionalCatalog } from './institutional-catalog';
import { adaptCurriculum } from './curriculum-adapter';

const scope = {institutionId:'ies-a',courseId:'direito',buildId:'build-1',buildVersion:1,authorizedBy:'backend' as const};
const source = adaptCurriculum({
  institutionId:'ies-a',courseId:'direito',
  build:{id:'build-1',institution_id:'ies-a',course_id:'direito',version:1,status:'published'},
  competencies:[{id:'c1',build_id:'build-1',code:'C1',title:'Competência 1',sort_order:0}],
  links:[],
  periods:[{competencyId:'c1',period:1,status:'validated'}],
  topics:[{id:'t1',disciplineId:'dc',period:1,status:'validated'}]
});
const projectedCatalog = projectInstitutionalCatalog({
  context:{institutionId:'ies-a',courseId:'direito',buildId:'build-1',buildVersion:1},
  knownCompetencyIds:['c1'],
  topics:[{id:'t1',institutionId:'ies-a',courseId:'direito',buildId:'build-1',
    disciplineId:'dc',period:1,title:'Civil',state:'validated'}],
  placements:[{competencyId:'c1',institutionId:'ies-a',courseId:'direito',buildId:'build-1',
    period:1,state:'validated'}],edges:[]
});
const fixture: PreflightInput = {
  scope,source,projectedCatalog,
  input:{catalog:projectedCatalog.catalog,assessment:{
    id:'av1',institutionId:'ies-a',courseId:'direito',period:1,disciplineId:'dc',
    purpose:['formativa'],targetDifficulty:3,requiredCompetencyIds:['c1'],
    requiredTopicIds:['t1'],items:[{id:'q1',disciplineId:'dc',topicIds:['t1'],
      competencyIds:['c1'],estimatedDifficulty:3,purpose:['formativa'],
      points:10,evidence:'validada'}]}}
};
describe('preflight do Avalia 360°',()=>{
  it('autoriza parecer somente com catálogo curricular validado',()=>{
    expect(source.ready).toBe(true);
    expect(projectedCatalog.ready).toBe(true);
    const out=preflightAndAnalyze(fixture);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.analysis.coverage.topics[0].items).toBe(1);
  });
  it('recusa prova de instituição diferente',()=>{
    const out=preflightAndAnalyze({...fixture,input:{...fixture.input,assessment:{
      ...fixture.input.assessment,institutionId:'ies-b'}}});
    expect(out).toMatchObject({ok:false,reasons:['ASSESSMENT_SCOPE_MISMATCH']});
  });
  it('recusa competência fabricada na prova',()=>{
    const out=preflightAndAnalyze({...fixture,input:{...fixture.input,assessment:{
      ...fixture.input.assessment,items:[{...fixture.input.assessment.items[0],competencyIds:['falsa']}]}}});
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reasons).toContain('UNVALIDATED_COMPETENCY');
  });
  it('recusa matriz em rascunho e versão divergente',()=>{
    const out=preflightAndAnalyze({...fixture,scope:{...scope,buildVersion:2},
      source:{...source,ready:false}});
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reasons).toEqual(expect.arrayContaining(['CURRICULUM_SCOPE_MISMATCH','CURRICULUM_NOT_READY']));
  });
  it('não utiliza catálogo de competências enviado isoladamente pelo cliente',()=>{
    const out=preflightAndAnalyze({...fixture,input:{...fixture.input,catalog:{
      ...fixture.input.catalog,competencies:[]}}});
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reasons).toContain('CATALOG_PAYLOAD_MISMATCH');
  });
  it('recusa conflito entre períodos validados do adaptador e do catálogo',()=>{
    const altered={...source,catalog:{...source.catalog,
      competencies:source.catalog.competencies.map(c=>({...c,period:5}))}};
    const out=preflightAndAnalyze({...fixture,source:altered});
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reasons).toContain('CATALOG_CURRICULUM_MISMATCH');
  });
  it('não aprova avaliação com duas questões de mesmo identificador',()=>{
    const item=fixture.input.assessment.items[0];
    const out=preflightAndAnalyze({...fixture,input:{...fixture.input,assessment:{
      ...fixture.input.assessment,items:[item,{...item}]}}});
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reasons).toContain('DUPLICATE_ITEM_ID');
  });
});
