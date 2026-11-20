import {describe,it,expect} from 'vitest';
import {PDFDocument} from 'pdf-lib';
import {buildIndividualizedPdf,prepareIssues,validatePrintAssessment} from './individualized-pdf';
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
 it('não permite PDF com gabarito ausente, alternativas duplicadas ou figuras omitidas',async()=>{
  const info={institutionName:'Vértice',courseName:'Direito',discipline:'Civil',
   title:'AV1',semester:'2027/1',classLabel:'2A',
   questions:[{...q,correctOptionId:'',options:[{id:'A',text:'Igual'},{id:'B',text:' igual '}]}]};
  const problems=validatePrintAssessment(info);
  expect(problems).toEqual(expect.arrayContaining([
   'Questão 1: gabarito não selecionado.','Questão 1: alternativas duplicadas.'
  ]));
  const batch=prepareIssues([{id:'s1',name:'Aluno Exemplo',selected:true}],'batch');
  await expect(buildIndividualizedPdf(info,batch)).rejects.toThrow(/gabarito não selecionado/);
 });
 it('não inclui o padrão de resposta esperado no PDF e exige preenchimento para emitir discursiva',async()=>{
  const required={...q,kind:'discursiva' as const,rubric:'Critérios de correção de fundamentação e conclusão.',expectedAnswer:'Resposta-modelo sigilosa do professor.'};
  const ctx={institutionName:'Vértice',courseName:'Direito',discipline:'Civil',title:'AV1',semester:'2027/1',classLabel:'2A',questions:[required]};
  expect(validatePrintAssessment({...ctx,questions:[{...required,expectedAnswer:''}]})).toContain('Questão 1: padrão de resposta esperado ausente.');
  const bytes=await buildIndividualizedPdf(ctx,prepareIssues([{id:'s1',name:'Aluno Exemplo',selected:true}],'batch'));
  const text=new TextDecoder('latin1').decode(bytes);
  expect(text).not.toContain('Resposta-modelo sigilosa');
  expect(bytes.byteLength).toBeGreaterThan(1000);
 });
 it('impede duplicidade de identificador e emissão sem alunos',()=>{
  expect(()=>prepareIssues([], 'batch-demo')).toThrow();
  expect(()=>prepareIssues([
   {id:'id-repetido',name:'Ana',selected:true},
   {id:'id-repetido',name:'Bruno',selected:true}
  ],'batch-demo')).toThrow(/duplicado/);
 });
});
