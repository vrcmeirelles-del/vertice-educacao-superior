import {describe,expect,it} from 'vitest';
import {projectInstitutionalCatalog, type CatalogInput} from './institutional-catalog';
const context={institutionId:'ies-a',courseId:'direito',buildId:'build-1',buildVersion:1};
const base:CatalogInput={
  context,knownCompetencyIds:['c1','c7'],
  placements:[{...context,competencyId:'c1',period:1,state:'validated'},{...context,competencyId:'c7',period:7,state:'validated'}],
  topics:[{...context,id:'civil',disciplineId:'dc',period:3,title:'Direito Civil',state:'validated'},
    {...context,id:'responsabilidade',parentId:'civil',disciplineId:'dc',period:4,title:'Responsabilidade',state:'validated'}],
  edges:[{...context,id:'edge-1',fromId:'c1',toId:'c7',kind:'prerequisito',state:'validated'}]
};
describe('Catálogo institucional Vértice Avalia 360°',()=>{
  it('projeta temas e competências validados sem inventar semântica',()=>{
    const copy=structuredClone(base);
    const out=projectInstitutionalCatalog(base);
    expect(out.ready).toBe(true);
    expect(out.catalog.competencies).toHaveLength(2);
    expect(out.catalog.topics).toHaveLength(2);
    expect(out.topicParents).toContainEqual({id:'responsabilidade',parentId:'civil'});
    expect(base).toEqual(copy);
  });
  it('rejeita vínculos com outra instituição, sem misturar dados',()=>{
    const out=projectInstitutionalCatalog({...base,topics:[{...base.topics[0],institutionId:'ies-b'}]});
    expect(out.ready).toBe(false);
    expect(out.catalog.topics).toHaveLength(0);
    expect(out.issues.map(i=>i.code)).toContain('CROSS_SCOPE_TOPIC');
  });
  it('não promove propostas a relações validadas',()=>{
    const out=projectInstitutionalCatalog({...base,edges:[{...base.edges[0],state:'proposed'}],
      topics:[{...base.topics[0],state:'proposed'}]});
    expect(out.catalog.competencies[0].relations).toEqual([]);
    expect(out.catalog.topics).toEqual([]);
    expect(out.ready).toBe(true);
  });
  it('identifica hierarquia circular de subtemas',()=>{
    const out=projectInstitutionalCatalog({...base,topics:[
      {...base.topics[0],parentId:'responsabilidade'},base.topics[1]]});
    expect(out.ready).toBe(false);
    expect(out.issues.map(i=>i.code)).toContain('TOPIC_CYCLE');
  });
  it('detecta ciclos de pré-requisitos',()=>{
    const out=projectInstitutionalCatalog({...base,edges:[
      ...base.edges,{...base.edges[0],id:'edge-2',fromId:'c7',toId:'c1'}]});
    expect(out.ready).toBe(false);
    expect(out.issues.map(i=>i.code)).toContain('PREREQUISITE_CYCLE');
  });
  it('recusa período inferido e versão curricular inválida',()=>{
    const out=projectInstitutionalCatalog({...base,context:{...context,buildVersion:0},
      placements:base.placements.slice(0,1)});
    expect(out.ready).toBe(false);
    expect(out.issues.map(i=>i.code)).toEqual(expect.arrayContaining(['INVALID_CONTEXT','MISSING_PLACEMENT']));
  });
});
