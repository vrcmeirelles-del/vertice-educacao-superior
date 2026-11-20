import {describe,it,expect} from 'vitest';
import {composeTeacherQuestion} from './question-construction';
describe('composição orientada pelo professor',()=>{
 it('apenas estrutura o conteúdo que o professor forneceu',()=>{
  const r=composeTeacherQuestion({structure:'caso',context:'João colidiu com o veículo de Maria em via urbana.',task:'Fundamente juridicamente a resposta conforme a legislação.'});
  expect(r.ok).toBe(true);
  if(!r.ok)return;
  expect(r.statement).toContain('João colidiu');
  expect(r.statement).toContain('Fundamente juridicamente');
  expect(r.statement).not.toContain('Código Civil');
  expect(r.requiresTeacherReview).toBe(true);
  expect(r.source).toBe('teacher-authored-template');
 });
 it('bloqueia preenchimento insuficiente e comparações sem objeto',()=>{
  const r=composeTeacherQuestion({structure:'comparacao',context:'Este é o contexto elaborado por um docente.',task:'Compare as características dos institutos.',comparisonObject:''});
  expect(r.ok).toBe(false);
  if(r.ok)return;
  expect(r.issues).toContain('Informe o segundo elemento da comparação.');
 });
});
