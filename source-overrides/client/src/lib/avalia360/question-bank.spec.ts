import {describe,it,expect} from 'vitest';
import {filterBankQuestions,prepareBankQuestion,reuseBankQuestion} from './question-bank';
import type {QuestionDraft} from './question-draft';
const q:QuestionDraft={
 id:'questao-1',disciplineId:'Direito Civil',kind:'objetiva',
 statement:'Em caso hipotético, qual das alternativas corresponde ao enunciado?',
 options:[{id:'A',text:'Alternativa primeira'},{id:'B',text:'Alternativa segunda'}],
 correctOptionId:'A',rubric:'',topicIds:['tema-a'],competencyIds:['c1'],
 purpose:['formativa'],estimatedDifficulty:3,points:1,examTags:['oab'],images:[]
};
const mk=(institutionId='ies',courseId='dir',discipline='Direito Civil')=>
 prepareBankQuestion({institutionId,courseId,discipline,question:q,bankId:crypto.randomUUID(),
 createdAt:'2026-11-20T16:00:00.000Z'});
describe('banco de questões Avalia 360°',()=>{
 it('preserva revisão, enunciado, tags e gabarito do original ao reutilizar com novo ID',()=>{
  const bank=mk();
  const reuse=reuseBankQuestion(bank,'nova-questao','Direito Civil');
  expect(reuse.statement).toBe(q.statement);
  expect(reuse.correctOptionId).toBe('A');
  expect(reuse.topicIds).toEqual(['tema-a']);
  expect(reuse.competencyIds).toEqual(['c1']);
  expect(reuse.id).toBe('nova-questao');
  reuse.options[0].text='Texto editado apenas na prova';
  reuse.topicIds.push('tema-b');
  expect(bank.question.options[0].text).toBe('Alternativa primeira');
  expect(bank.question.topicIds).toEqual(['tema-a']);
  expect(bank.status).toBe('rascunho');
  expect(bank.revision).toBe(1);
 });
 it('filtra por IES, curso, disciplina e busca textual',()=>{
  const records=[mk('ies','dir'),mk('ies2','dir'),mk('ies','ped'),mk('ies','dir','Direito Penal')];
  expect(filterBankQuestions(records,{institutionId:'ies',courseId:'dir',discipline:'  DIREITO CIVIL ',query:'alternativas'})).toHaveLength(1);
  expect(filterBankQuestions(records,{institutionId:'ies',courseId:'dir',discipline:'Direito Civil',query:'inexistente'})).toHaveLength(0);
 });
 it('bloqueia itens inválidos, anexos sem Storage e cópia na disciplina errada',()=>{
  expect(()=>prepareBankQuestion({institutionId:'ies',courseId:'dir',discipline:'Civil',
   question:{...q,correctOptionId:''},bankId:'item',createdAt:'2026-11-20T16:00:00Z'})).toThrow(/gabarito/);
  const fakeFile={} as File;
  expect(()=>prepareBankQuestion({institutionId:'ies',courseId:'dir',discipline:'Civil',
   question:{...q,images:[{file:fakeFile} as QuestionDraft['images'][number]]},
   bankId:'item',createdAt:'2026-11-20T16:00:00Z'})).toThrow(/imagens/);
  expect(()=>reuseBankQuestion(mk(),'outro','Direito Penal')).toThrow(/incompatível/);
 });
});
