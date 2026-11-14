import {describe,it,expect} from 'vitest';
import {TEMPLATES,validateAnswers,sectionsFor,type Answers} from './schema';
import {buildDossier} from '../extension-forms/pdf';
import {PDFDocument} from 'pdf-lib';
describe('Internship forms',()=>{
 it('requires learning, supervision, permissions and coverage for an external action',()=>{
 const keys=TEMPLATES.externa.fields.filter(f=>f.required).map(f=>f.key);
 expect(keys).toEqual(expect.arrayContaining(['objectives','supervision','permissions','insurance','validation']));
 expect(validateAnswers({public_count:'-1'},true,'diario').join()).toContain('Número inválido');
 expect(Object.keys(TEMPLATES)).toHaveLength(14);
 });
 it('renders every model with generic institutional identity and its own fields',async()=>{
 for(const [template,model] of Object.entries(TEMPLATES)){
 const answers:Answers=Object.fromEntries(model.fields.map(f=>[f.key,f.type==='date'?'2026-11-14':f.type==='number'?'0':'Informação fictícia para conferência']));answers.semester='2026/2';
 expect(validateAnswers(answers,true,template as keyof typeof TEMPLATES)).toEqual([]);
 const pdf=await buildDossier({id:'DEMONSTRACAO',template,answers,courseName:'Direito fictício',institutionName:'IES fictícia',revision:1,author:'Professor fictício',generatedAt:'2026-11-14T12:00:00Z',attachments:[]},async()=>new Uint8Array(),{brand:'VÉRTICE | ESTÁGIO OBRIGATÓRIO',heading:'MINUTA DOCUMENTAL DE ESTÁGIO',templateLabel:model.label,notice:model.note,sections:sectionsFor(template as keyof typeof TEMPLATES),subject:model.label});
 expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(0);
 }
 });
});
