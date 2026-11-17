import {describe,it,expect} from 'vitest';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {ALL_FIELDS,validateAnswers,type Answers} from './schema';
import {buildDossier,sha256} from './pdf';
const answers:Answers=Object.fromEntries(ALL_FIELDS.filter(f=>f.required).map(f=>[f.key,f.type==='number'?'0':'Informação fictícia']));
Object.assign(answers,{title:'Ação de extensão — informação fictícia',email:'docente@example.org',semester:'2026/2',start_date:'2026-11-01',end_date:'2026-11-14',hours:'4'});
describe('formulário e PDF de extensão',()=>{
 it('allows partial drafts and zeros in actual indicators, but blocks incomplete final reports',()=>{
  expect(validateAnswers({title:'Rascunho'},false)).toEqual([]);
  expect(validateAnswers(answers,true)).toEqual([]);
  expect(validateAnswers({...answers,results:''},true)).toContain('Preencha: Resultados alcançados e comparação com os objetivos.');
  expect(validateAnswers({...answers,students_actual:'1.5'},true).join()).toContain('número inteiro');
  expect(validateAnswers({...answers,end_date:'2026-10-01'},true).join()).toContain('data final');
 });
 it('builds real PDF, merges annex pages, preserves accents and refuses changed bytes',async()=>{
  const original=await PDFDocument.create();const f=await original.embedFont(StandardFonts.Helvetica);original.addPage().drawText('COMPROVANTE FICTICIO',{x:40,y:700,font:f});const bytes=await original.save();
  const attachment={id:'annex',path:'private/original.pdf',name:'Presença.pdf',kind:'Lista de presença',mime:'application/pdf',size:bytes.length,sha256:await sha256(bytes)};
  const d={id:'PROTOCOLO-FICTICIO',template:'extensao' as const,answers:{...answers,results:'Reflexão crítica e participação da comunidade. '.repeat(120)},courseName:'Direito',institutionName:'Instituição fictícia',revision:3,author:'docente@example.org',generatedAt:'2026-11-14T12:30:00Z',attachments:[attachment]};
  const output=await buildDossier(d,async()=>bytes);
  expect(new TextDecoder().decode(output.slice(0,5))).toBe('%PDF-');
  const pdf=await PDFDocument.load(output);expect(pdf.getPageCount()).toBeGreaterThan(5);expect(pdf.getAuthor()).toBe('docente@example.org');
  await expect(buildDossier(d,async()=>new Uint8Array([1,2,3]))).rejects.toThrow('Integridade divergente');
 });
});


import { documentSuggestions, fillEmpty, projectAnswers } from './project-data';
it('reuses only equivalent empty fields and preserves zeros and previously typed answers',()=>{
 const base={title:'Parque Cesamar de teste',location:'Local preenchido manualmente',community_planned:'0'};
 const project={id:'project',title:'Parque Cesamar de teste',activity_location:'Local antigo',target_audience_count:25,detailed_program:'Cronograma'};
 const source=projectAnswers(project);
 const filled=fillEmpty(base,source,['location','community_planned','program','community_actual']);
 expect(filled.answers).toEqual({...base,program:'Cronograma'});
 expect(filled.added).toEqual(['program']);
 expect(fillEmpty(filled.answers,source,Object.keys(source)).answers).toBe(filled.answers);
});

it('suggests the exact text from a matching heading and leaves sections without a source empty',()=>{
 const text='1. Objetivo geral\nAmpliar o acesso da comunidade à informação.\n\n2. Resultados esperados: Produzir material acessível.';
 expect(documentSuggestions(text,['general_objective','results','expected_results'])).toEqual([
  {key:'general_objective',excerpt:'Ampliar o acesso da comunidade à informação.'},
  {key:'expected_results',excerpt:'Produzir material acessível.'},
 ]);
});
