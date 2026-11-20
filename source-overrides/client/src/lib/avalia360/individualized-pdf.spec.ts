import {describe,it,expect} from 'vitest';
import {PDFDocument} from 'pdf-lib';
import {buildIndividualizedPdf,prepareIssues} from './individualized-pdf';
import type {QuestionDraft} from './question-draft';

const q:QuestionDraft={id:'q1',disciplineId:'civil',kind:'objetiva',statement:'Qual alternativa é correta no caso apresentado?',
 options:[{id:'A',text:'Primeira possibilidade'},{id:'B',text:'Segunda possibilidade'}],
 correctOptionId:'A',rubric:'',topicIds:[],competencyIds:[],purpose:['formativa'],
 estimatedDifficulty:3,points:2,examTags:[],images:[]};

describe('impressão individualizada de prova',()=>{
 it('emite uma página por aluno sem dados de matrícula no token QR',async()=>{
  const issues=prepareIssues([
   {id:'A',name:'Ana Exemplo',registration:'DEMO-01',selected:true},
   {id:'B',name:'Bruno Exemplo',registration:'DEMO-02',selected:true},
   {id:'C',name:'Aluno Não Selecionado',selected:false}
  ],'batch-demo');
  expect(issues).toHaveLength(2);
  expect(issues[0].token).not.toBe(issues[1].token);
  expect(issues[0].token).not.toContain('DEMO-01');
  const bytes=await buildIndividualizedPdf({
   institutionName:'Vértice - Demonstração',courseName:'Direito',
   discipline:'Direito Civil',title:'AV1',semester:'2027/1',
   classLabel:'2A',questions:[q]
  },issues);
  expect(bytes.byteLength).toBeGreaterThan(3000);
  const pdf=await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(2);
 });
 it('impede duplicidade de identificador e emissão sem alunos',()=>{
  expect(()=>prepareIssues([], 'batch-demo')).toThrow();
  expect(()=>prepareIssues([
   {id:'id-repetido',name:'Ana',selected:true},
   {id:'id-repetido',name:'Bruno',selected:true}
  ],'batch-demo')).toThrow(/duplicado/);
 });
});
