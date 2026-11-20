import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const dir='supabase/functions/vertice-sapiens-analyze/';
const code=ts.transpile(readFileSync(dir+'diagnosis.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS});
const exportsObj:any={};
vm.runInNewContext(code,{exports:exportsObj,module:{exports:exportsObj},Math,Number,String,Array,Object,JSON});
const {buildDiagnosis}=exportsObj;
const base={courseName:'Direito',module:'oab',competency:'Constitucional',semester:'2026/2',accuracy:0.25,graded:400,attempts:420,studentCount:40};
describe('diagnóstico do Sapiens por algoritmo',()=>{
 it('crítico: resumo com os números e três ações da tabela, tipos válidos',()=>{
  const d=buildDiagnosis({...base,severity:'critical'});
  expect(d.summary).toBe('Direito — OAB · Constitucional: 25,0% de acerto em 400 respostas corrigidas de 40 estudantes (2026/2). Classificação: crítica. Primeiro diagnóstico desta competência.');
  expect(d.recommendedActions.map((a:any)=>a.type)).toEqual(['diagnostic_activity','remedial_practice','content_review']);
  expect(d.recommendedActions[1].description).toContain('1ª fase da OAB');
  for(const a of d.recommendedActions){expect(a.title.length).toBeGreaterThanOrEqual(5);expect(a.description.length).toBeGreaterThanOrEqual(10);}
  expect(d.detailedAnalysis.requires_human_review).toBe(false);
 });
 it('alerta com ciclo anterior: tendência em pontos percentuais e duas ações',()=>{
  const d=buildDiagnosis({...base,module:'enamed',competency:null,severity:'warning',accuracy:0.42,previousAccuracy:0.35,previousCycle:2});
  expect(d.summary).toContain('ENAMED: 42,0%');
  expect(d.summary).toContain('No ciclo anterior (#2): 35,0% (melhora, +7,0 p.p.)');
  expect(d.recommendedActions.map((a:any)=>a.type)).toEqual(['remedial_practice','content_review']);
  expect(d.recommendedActions[0].description).toContain('casos clínicos');
 });
 it('amostra pequena exige revisão humana; competência adequada não gera ação',()=>{
  const small=buildDiagnosis({...base,severity:'critical',studentCount:8});
  expect(small.summary).toContain('Amostra pequena');
  expect(small.detailedAnalysis.requires_human_review).toBe(true);
  expect(small.detailedAnalysis.methodology_notes[0]).toContain('8 estudantes');
  expect(buildDiagnosis({...base,severity:'adequate',accuracy:0.8}).recommendedActions).toEqual([]);
 });
 it('o diagnóstico por competência não chama mais IA',()=>{
  const index=readFileSync(dir+'index.ts','utf8');
  expect(index).not.toMatch(/generateDiagnosis|reviewContradictory/);
  expect(index).toContain('buildDiagnosis({');
 });
});
