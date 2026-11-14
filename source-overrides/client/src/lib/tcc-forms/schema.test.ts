import {it,expect} from 'vitest';
import {PDFDocument} from 'pdf-lib';
import {TEMPLATES,sectionsFor,validateAnswers,meanGrade,type Answers,type Template} from './schema';
import {buildDossier} from '../extension-forms/pdf';
const fill=(t:Template):Answers=>Object.fromEntries(TEMPLATES[t].fields.map(f=>[f.key,f.type==='date'?'2026-11-14':f.type==='number'?'0':f.type==='select'?f.options![0]:'DADO FICTÍCIO']));
it('all model definitions require only their own fields and explicit choices',()=>{
 for(const key of Object.keys(TEMPLATES) as Template[]){const a=fill(key);a.semester='2026/2';if(key==='ata'){a.grade2='';a.grade3='';a.examiner2='';a.examiner3='';}expect(validateAnswers(a,true,key)).toEqual([]);expect(sectionsFor(key).flatMap(s=>s.fields).length).toBe(TEMPLATES[key].fields.length);}
 const a=fill('publicacao');a.semester='2026/2';a.permission='';expect(validateAnswers(a,true,'publicacao').join()).toContain('Manifestação');a.permission='Autoriza após embargo';a.embargo='';expect(validateAnswers(a,true,'publicacao').join()).toContain('embargo');
});
it('grade zero is a valid entered grade; blank grade is never counted as zero',()=>{
 expect(meanGrade({grade1:'0',grade2:'8',grade3:''})).toBe('4.00');expect(meanGrade({grade1:'8',grade2:'',grade3:''})).toBe('8.00');expect(meanGrade({grade1:'11'})).toBe('');
});
it('renders TCC custom sections and labels using shared PDF engine without requiring extension keys',async()=>{
 const bytes=await buildDossier({id:'FICTICIO',template:'ata',answers:{title:'TCC FICTÍCIO',advisor:'Orientador fictício',grade1:'0'},institutionName:'IES FICTÍCIA',courseName:'Direito',revision:1,author:'teste@example.org',generatedAt:'2026-11-14T14:00:00Z',attachments:[]},async()=>new Uint8Array(),{brand:'VÉRTICE | TCC 360',heading:'MINUTA DOCUMENTAL DE TCC',templateLabel:TEMPLATES.ata.label,notice:'Assinatura e validação pendentes.',sections:sectionsFor('ata'),subject:'Ata de TCC'});
 const pdf=await PDFDocument.load(bytes);expect(pdf.getSubject()).toBe('Ata de TCC');expect(pdf.getPageCount()).toBeGreaterThan(0);
});
