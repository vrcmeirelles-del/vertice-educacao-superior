import {describe,expect,it} from 'vitest';
import {createExamVariants,maxDistinctVariants,teacherAnswerRows,versioningNotice} from './exam-variants';
import type {QuestionDraft} from './question-draft';
const q:QuestionDraft={
 id:'q1',disciplineId:'civil',kind:'objetiva',
 statement:'Analise o caso proposto e selecione a alternativa fundamentada.',
 options:['A','B','C','D','E'].map(id=>({id,text:'Alternativa '+id})),
 correctOptionId:'C',answerJustification:'O fundamento do caso confirma a alternativa C.',
 rubric:'',expectedAnswer:'',answerLines:8,topicIds:['t1'],competencyIds:['c1'],
 purpose:['formativa'],estimatedDifficulty:2,points:1,examTags:['oab'],images:[]
};
describe('motor de versões distintas',()=>{
 it('cria 12 versões diferentes sem alterar a questão nem o gabarito mestre',()=>{
  const variants=createExamVariants([q],12,'alternativas');
  const signatures=variants.map(v=>v.items[0].options.map(o=>o.sourceOptionId).join(','));
  expect(new Set(signatures).size).toBe(12);
  for(const v of variants){
   const item=v.items[0];
   expect(item.options.find(x=>x.label===item.correctLabel)?.sourceOptionId).toBe('C');
  }
  expect(q.options.map(x=>x.id)).toEqual(['A','B','C','D','E']);
  expect(q.correctOptionId).toBe('C');
 });
 it('mantém o mesmo resultado quando os parâmetros são os mesmos',()=>{
  expect(createExamVariants([q],4,'ambos').map(v=>v.items[0].correctLabel))
   .toEqual(createExamVariants([q],4,'ambos').map(v=>v.items[0].correctLabel));
 });
 it('exporta gabarito por variante e justificativa somente ao docente',()=>{
  const rows=teacherAnswerRows(createExamVariants([q],3,'ambos'));
  expect(rows).toHaveLength(3);
  expect(rows.every(r=>r.sourceId==='q1')).toBe(true);
  expect(rows.every(r=>r.justification===q.answerJustification)).toBe(true);
 });
 it('recusa solicitar mais variantes do que o conjunto de permutações suporta',()=>{
  const two={...q,options:q.options.slice(0,2),correctOptionId:'A'};
  expect(maxDistinctVariants([two],'alternativas')).toBe(2);
  expect(versioningNotice([two],3,'alternativas')).toMatch(/somente 2/);
  expect(()=>createExamVariants([two],3,'alternativas')).toThrow(/máximo 2/);
 });
 it('não chama de versões distintas uma única questão discursiva sem opções',()=>{
  const disc={...q,kind:'discursiva' as const,options:[],correctOptionId:'',expectedAnswer:'Modelo',rubric:'Critérios'};
  expect(versioningNotice([disc],2,'ambos')).toMatch(/uma discursiva/);
 });
});
