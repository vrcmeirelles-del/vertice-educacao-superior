import {describe,it,expect} from 'vitest';
import {PDFDict,PDFDocument,PDFName} from 'pdf-lib';
import {buildIndividualizedPdf,buildReviewPdf,prepareIssues,validatePrintAssessment} from './individualized-pdf';
import type {QuestionDraft} from './question-draft';

const q:QuestionDraft={id:'q1',disciplineId:'civil',kind:'objetiva',statement:'Qual alternativa é correta no caso apresentado?',
 options:[{id:'A',text:'Primeira possibilidade'},{id:'B',text:'Segunda possibilidade'}],
 correctOptionId:'A',answerJustification:'Justificativa docente: alternativa correta A.',rubric:'',topicIds:[],competencyIds:[],purpose:['formativa'],
 estimatedDifficulty:3,points:2,examTags:[],images:[]};

describe('impressão individualizada de prova',()=>{
 it('gera a prévia de revisão com caderno e cartão sem pedir turma ou incorporar QR',async()=>{
  const bytes=await buildReviewPdf({institutionName:'Vértice',courseName:'Direito',
   discipline:'Civil',title:'AV1',semester:'2027/1',questions:[q]});
  const pdf=await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getPages().every(page=>{
   const images=page.node.Resources()?.lookupMaybe(PDFName.of('XObject'),PDFDict);
   return !images?.keys().length;
  })).toBe(true);
 });
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
  expect(pdf.getPageCount()).toBe(4);
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
 it('incorpora imagem PNG validada ao PDF, em vez de barrar a geração',async()=>{
  // PNG sintético: nenhum dado pessoal ou imagem da produção entra no teste.
  const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU9kAAAAASUVORK5CYII=','base64'));
  const file=Object.assign(new Blob([png],{type:'image/png'}),{name:'figura-teste.png'}) as File;
  const question={...q,images:[{localId:'fig1',file,altText:'Figura demonstrativa',
    caption:'Imagem de teste',placement:'enunciado' as const,rightsStatus:'autoral' as const}]};
  const ctx={institutionName:'Vértice',courseName:'Direito',discipline:'Civil',
   title:'AV1',semester:'2027/1',classLabel:'2A',questions:[question]};
  expect(validatePrintAssessment(ctx)).toEqual([]);
  const bytes=await buildIndividualizedPdf(ctx,prepareIssues([{id:'s1',name:'Aluno Exemplo',selected:true}],'batch'));
  const pdf=await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  expect(bytes.byteLength).toBeGreaterThan(3000);
 });
 it('impede imprimir imagem sem descrição ou direito de uso',()=>{
  const file=Object.assign(new Blob([new Uint8Array([1,2,3])],{type:'image/png'}),{name:'teste.png'}) as File;
  const item={...q,images:[{localId:'f',file,altText:'',caption:'',
   placement:'enunciado' as const,rightsStatus:'nao_informado' as const}]};
  const problems=validatePrintAssessment({institutionName:'Vértice',courseName:'Direito',discipline:'Civil',
    title:'AV1',semester:'2027/1',classLabel:'2A',questions:[item]});
  expect(problems).toEqual(expect.arrayContaining([
    'Questão 1: descrição acessível da imagem 1 ausente.',
    'Questão 1: direito de uso da imagem 1 não confirmado.'
  ]));
 });
 it('emite cartão exclusivo por estudante com variantes distintas no mesmo lote',async()=>{
  const issues=prepareIssues([
   {id:'s1',name:'Aluno Exemplo 1',selected:true},
   {id:'s2',name:'Aluno Exemplo 2',selected:true}
  ],'batch2');
  const info={institutionName:'Vértice',courseName:'Direito',discipline:'Civil',
   title:'AV2',semester:'2027/1',classLabel:'2A',questions:[q],
   variantCount:2,shuffleMode:'alternativas' as const};
  const bytes=await buildIndividualizedPdf(info,issues);
  const doc=await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(4);
  expect(issues[0].token).not.toBe(issues[1].token);
 });
 it('respeita quantidade de linhas discursivas e rejeita valores fora dos limites',async()=>{
  const disc={...q,kind:'discursiva' as const,expectedAnswer:'Fundamentação de referência sigilosa.',
   rubric:'Identificação do instituto e argumentação, com pontuação.',
   answerLines:18};
  const ctx={institutionName:'Vértice',courseName:'Direito',discipline:'Civil',
   title:'AV2',semester:'2027/1',classLabel:'2A',questions:[disc]};
  expect(validatePrintAssessment(ctx)).toEqual([]);
  expect(validatePrintAssessment({...ctx,questions:[{...disc,answerLines:61}]}))
   .toContain('Questão 1: informe de 3 a 60 linhas na discursiva.');
  const doc=await PDFDocument.load(await buildIndividualizedPdf(ctx,prepareIssues([
   {id:'student',name:'Aluno Exemplo',selected:true}
  ],'batch3')));
  expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
 });
 it('começa cada caderno em página ímpar após um conjunto de tamanho ímpar',async()=>{
  const disc={...q,kind:'discursiva' as const,expectedAnswer:'Fundamentação de referência.',
   rubric:'Identificação do instituto e argumentação.',answerLines:42};
  const info={institutionName:'UNITOP',courseName:'Direito',discipline:'Civil',
   title:'AV2',semester:'2026/2',classLabel:'2A',questions:[disc]};
  const students=[
   {id:'a',name:'Estudante A',selected:true},
   {id:'b',name:'Estudante B',selected:true}
  ];
  const issues=prepareIssues(students,'batch-duplex');
  const pdf=await PDFDocument.load(await buildIndividualizedPdf(info,issues));
  expect(pdf.getPageCount()).toBe(7);
  expect(pdf.getPage(3).node.Contents()).toBeUndefined();
  expect(pdf.getPage(4).node.Contents()).toBeDefined();
  expect(pdf.getPage(6).node.Contents()).toBeDefined();
 });
 it('impede duplicidade de identificador e emissão sem alunos',()=>{
  expect(()=>prepareIssues([], 'batch-demo')).toThrow();
  expect(()=>prepareIssues([
   {id:'id-repetido',name:'Ana',selected:true},
   {id:'id-repetido',name:'Bruno',selected:true}
  ],'batch-demo')).toThrow(/duplicado/);
 });
});
