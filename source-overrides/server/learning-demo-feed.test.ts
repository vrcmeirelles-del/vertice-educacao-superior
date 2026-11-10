import {describe,it,expect} from 'vitest';
import {validateLearningDemoFeed} from '../client/src/lib/learning-demo-feed';
import {demoInstitutionCourses} from '../client/src/lib/demo-showroom';
const courses=demoInstitutionCourses('faculdade');
const payload=()=>({origin:'fato-e-ordem',kind:'synthetic_demo',synthetic:true,mode:'faculdade',period:'2026/2',summary:{students:courses.reduce((s,c)=>s+c.students,0),courses:courses.length,exam:58,engagement:71},courses:courses.map(c=>({id:c.id,name:c.name,students:c.students,exam:60,engagement:70,journey:'ENADE'}))});
describe('contrato público da integração Fato & Ordem',()=>{
 it('aceita o cenário sintético completo e remove campos não previstos',()=>{
  const raw={...payload(),cpf:'não pode passar',secret:'não pode passar'};
  const feed=validateLearningDemoFeed(raw,'faculdade');expect(feed?.summary.students).toBe(1300);expect(feed).not.toHaveProperty('cpf');expect(feed).not.toHaveProperty('secret');
 });
 it('preserva os quantitativos da fonte sem substituí-los pelo cenário Vértice',()=>{const d=payload();d.courses[0].students+=1;d.summary.students+=1;expect(validateLearningDemoFeed(d,'faculdade')?.summary.students).toBe(1301);});
 it('recusa dados operacionais, origens estranhas e perfis trocados',()=>{
  for(const patch of [{synthetic:false},{kind:'operational'},{origin:'outro'},{mode:'universidade'}])expect(validateLearningDemoFeed({...payload(),...patch},'faculdade')).toBeNull();
 });
 it('recusa totais divergentes, cursos duplicados e percentuais inválidos',()=>{
  const d=payload();expect(validateLearningDemoFeed({...d,summary:{...d.summary,students:9999}},'faculdade')).toBeNull();
  expect(validateLearningDemoFeed({...d,courses:d.courses.map((c,i)=>i===1?d.courses[0]:c)},'faculdade')).toBeNull();
  expect(validateLearningDemoFeed({...d,summary:{...d.summary,exam:Infinity}},'faculdade')).toBeNull();
 });
});
