import {describe,expect,it} from 'vitest';
import {answerKeyByVariant,buildVariantMap,discursivePositions,objectivePositions,parseAnswerString,parseCsv,parseResponseRows,readerQuestions,type SnapshotQuestion} from './answer-entry';
import {createExamVariants} from './exam-variants';
import type {QuestionDraft} from './question-draft';

const qs:SnapshotQuestion[]=[
 {id:'q1',kind:'objetiva',points:2,statement:'a',correctOptionId:'B',options:[{id:'A',text:'x1'},{id:'B',text:'x2'},{id:'C',text:'x3'}]},
 {id:'q2',kind:'discursiva',points:3,statement:'b',correctOptionId:'',options:[]},
 {id:'q3',kind:'objetiva',points:1,statement:'c',correctOptionId:'A',options:[{id:'A',text:'y1'},{id:'B',text:'y2'}]},
];
describe('lançamento de respostas',()=>{
 it('o mapa reproduz exatamente as versões da impressão',()=>{
  const map=buildVariantMap(qs,3,'ambos');
  const printed=createExamVariants(qs.map(q=>({...q,disciplineId:'',rubric:'',topicIds:[],competencyIds:[],purpose:[],estimatedDifficulty:3,examTags:[],images:[]})) as unknown as QuestionDraft[],3,'ambos');
  for(const v of printed)expect(map[v.code]).toEqual(v.items.map(i=>({q:i.sourceId,o:i.options.map(o=>o.sourceOptionId)})));
  expect(buildVariantMap(qs,3,'ambos')).toEqual(map);
 });
 it('cada versão é permutação do caderno',()=>{
  const map=buildVariantMap(qs,2,'ambos');
  for(const items of Object.values(map)){
   expect(items.map(i=>i.q).sort()).toEqual(['q1','q2','q3']);
   expect([...items.find(i=>i.q==='q1')!.o].sort()).toEqual(['A','B','C']);
  }
 });
 it('gabarito por versão segue a ordem impressa',()=>{
  expect(answerKeyByVariant({A:[{q:'q1',o:['A','B','C']},{q:'q2',o:[]},{q:'q3',o:['A','B']}],B:[{q:'q3',o:['B','A']},{q:'q2',o:[]},{q:'q1',o:['C','B','A']}]},qs))
   .toEqual({A:'BA',B:'BB'});
 });
 it('posições impressas de objetivas e discursivas',()=>{
  const map={B:[{q:'q3',o:['B','A']},{q:'q2',o:[]},{q:'q1',o:['C','B','A']}]};
  expect(objectivePositions(map,qs,'B')).toEqual([1,3]);
  expect(discursivePositions(map,qs,'B')).toEqual([{n:2,questionId:'q2'}]);
 });
 it('sequência digitada: brancos, dupla marcação e erros',()=>{
  expect(parseAnswerString('a c',[1,3])).toEqual({answers:{'1':'A','3':'C'}});
  expect(parseAnswerString('B',[1,3]).answers).toEqual({'1':'B','3':'-'});
  expect(parseAnswerString('*-',[1,3]).answers).toEqual({'1':'*','3':'-'});
  expect(parseAnswerString('ABC',[1,3]).error).toMatch(/3 respostas para 2/);
  expect(parseAnswerString('A1',[1,3]).error).toMatch(/inválido/);
 });
 it('planilha com sequência, colunas Q/D, vínculo à turma e erros por linha',()=>{
  const map={A:[{q:'q1',o:['A','B','C']},{q:'q2',o:[]},{q:'q3',o:['A','B']}]};
  const out=parseResponseRows([
   ['Aluno','Versão','Respostas','D2'],
   ['Ana Souza','A','BA','2,5'],
   ['X-07','','C-',''],
   ['Bia','A','BA','9'],
   ['Ana Souza','A','AA',''],
  ],map,qs,[{id:'s1',name:'ana souza'}]);
  expect(out.sheets[0]).toEqual({label:'Ana Souza',studentId:'s1',variant:'A',objective:{'1':'B','3':'A'},discursive:{q2:2.5}});
  expect(out.sheets[1]).toMatchObject({label:'X-07',variant:'A',objective:{'1':'C','3':'-'}});
  expect(out.errors.join(' ')).toMatch(/Linha 4: nota de D2 deve ficar entre 0 e 3/);
  expect(out.errors.join(' ')).toMatch(/Aluno repetido/);
  const q=parseResponseRows([['Código','Q1','Q3'],['T1','b','']],map,qs);
  expect(q.sheets[0].objective).toEqual({'1':'B','3':'-'});
 });
 it('CSV com ; e aspas',()=>{
  expect(parseCsv('Aluno;Respostas\n"Silva; Ana";AB\r\nX;C\n')).toEqual([['Aluno','Respostas'],['Silva; Ana','AB'],['X','C']]);
 });
 it('modo leitura: questões do detalhe, sem gabarito, posicionam as respostas como o caderno', ()=>{
  const map=buildVariantMap(qs,2,'ambos');
  const rq=readerQuestions({questions:qs.map(q=>({id:q.id,kind:q.kind,points:q.points,statement:q.statement}))});
  expect(rq.every(q=>q.correctOptionId===''&&q.options.length===0)).toBe(true);
  for(const v of Object.keys(map)){
   expect(objectivePositions(map,rq,v)).toEqual(objectivePositions(map,qs,v));
   expect(discursivePositions(map,rq,v)).toEqual(discursivePositions(map,qs,v));
  }
 });
});
