import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,unzipSync,strToU8} from 'fflate';
import {extractDocument} from '../../../supabase/functions/vertice-doc-prevalidate/document-text.mjs';
import {assessDocumentQuality,evaluateFields,rulesJobVersion,sourceBaseline} from '../../../supabase/functions/vertice-doc-prevalidate/document-quality.mjs';
import {analyzeByRules} from '../../../supabase/functions/vertice-doc-prevalidate/rule-analysis.mjs';
import {evaluate} from '../../evaluate-document-rules.mjs';

const text='Ata da reunião do Núcleo Docente Estruturante para revisão curricular do curso de Direito em 2026/2.';
const extraction={text,pages:[{page:1,text}],partial:false,sha256:'a'.repeat(64)};
const catalogs=[{id:'c',instrument_code:'reconhecimento_curso',instrument_version:'2017'}];
const objects=[{catalog_id:'c',object_code:'2.1',object_label:'Núcleo Docente Estruturante – NDE'}];
const analyze=(changes={},source={})=>analyzeByRules({extraction:{...extraction,...changes},source,fileName:'ata.docx',catalogs,objects});

test('substitution invalidates cached jobs and index then analyze retains the original revision warning',()=>{
 assert.notEqual(rulesJobVersion('regras-1',null),rulesJobVersion('regras-1','successor'));
 const oldHash='b'.repeat(64),newHash=extraction.sha256;
 const indexed={source_sha256:newHash,extraction_metadata:{previous_sha256:oldHash,quality:assessDocumentQuality(extraction,{previous_sha256:oldHash})}};
 assert.equal(sourceBaseline(indexed),oldHash);
 assert.equal(analyze({}, {previous_sha256:sourceBaseline(indexed)}).indicator_links.length,0);
});

test('partial, superseded, revised, tracked and annotated sources withhold suggestions while clean sources retain them',()=>{
 assert.ok(analyze().indicator_links.length);
 for(const [changes,source] of [[{partial:true},{}],[{pagesWithoutText:[2]},{}],[{reviewSignals:['tracked_changes']},{}],[{reviewSignals:['comments']},{}],[{text:text+' Versões divergentes.'},{}],[{}, {superseded_by:'new-version'}],[{}, {previous_sha256:'b'.repeat(64)}]]){
  const result=analyze(changes,source);
  assert.equal(result.indicator_links.length,0);
  assert.equal(result.period_detected,undefined);
  assert.equal(result.quality.suggestions_withheld,true);
  assert.equal(result.quality.fidelity_score,null);
 }
 assert.ok(analyze({}, {previous_sha256:extraction.sha256}).indicator_links.length);
 assert.equal(assessDocumentQuality(extraction).visual_annotation_detection,'not_performed');
});

test('DOCX revisions and comments are observable, comments do not become evidence, original hash retained',async()=>{
 const comments='Conteúdo particular do revisor que não faz parte da ata.';
 const bytes=zipSync({'word/document.xml':strToU8(`<w:document><w:p><w:t>${text}</w:t><w:del w:id="1"><w:delText>2025</w:delText></w:del><w:ins w:id="2"><w:t>2026</w:t></w:ins></w:p></w:document>`),'word/comments.xml':strToU8(`<w:comments><w:comment><w:t>${comments}</w:t></w:comment></w:comments>`)});
 const parsed=await extractDocument(bytes,'ata.docx',{unzip:unzipSync});
 assert.deepEqual([...parsed.reviewSignals].sort(),['comments','tracked_changes']);
 assert.ok(!parsed.text.includes(comments));
 assert.equal(analyzeByRules({extraction:parsed,fileName:'ata.docx',catalogs,objects}).indicator_links.length,0);
 const expected=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
 assert.equal(parsed.sha256,expected);
});

test('a critical digit/date/name/table-cell change cannot hide behind 99 correct fields',()=>{
 for(const [expected,actual] of [['12/11/2026','21/11/2026'],['Prof. Ana','Prof. André'],['1.250','1.350'],['2017/2.1','2026/2.1']]){
  const fields=Array.from({length:99},(_,i)=>({id:String(i),expected:'igual',actual:'igual',severity:'minor'}));
  const result=evaluateFields([...fields,{id:'critical',expected,actual,severity:'critical'}]);
  assert.equal(result.score,50);assert.equal(result.critical_errors,1);
 }
 assert.equal(evaluateFields([{id:'space',expected:'Carga horária  80h',actual:'Carga\nhorária 80h',severity:'critical'}]).score,100);
 assert.equal(evaluateFields([{id:'format',expected:'**Ata**',actual:'Ata',severity:'benign'}]).critical_errors,0);
 assert.equal(evaluateFields([]).score,null);
});

const key='reconhecimento_curso/2017/2.1';
const doc=(i,kind='digital')=>({id:String(i),kind,kind_confirmed_by:'A',source_sha256:i.toString(16).padStart(64,'0'),
 reviewed_by:['A','B'],expected:[key],reviews:['A','B'].map(reviewer_id=>({reviewer_id,expected:[key],reviewed_at:'2026-11-27T12:00:00Z'})),
 fileName:'ata.docx',extraction:{...extraction,sha256:i.toString(16).padStart(64,'0')},
 fields:[{id:'date',expected:'2026/2',actual:'2026/2',severity:'critical'}]});

test('corpus gate requires 100 unique sources, two reviews, confirmed capture kinds and critical fields',()=>{
 const input={catalogs,objects,provenance:'real_documents',documents:Array.from({length:100},(_,i)=>doc(i,['digital','scanned','photographed'][i%3]))};
 const report=evaluate(input,{requireCorpus:true});
 assert.equal(report.corpus_requirements_met,true);assert.equal(report.production_validation,false);
 assert.equal(report.exact_indicator_agreement,1);assert.equal(report.critical_errors,0);
 assert.equal(report.review_time.median_ms,null);
 for(const mutate of [x=>x.documents.pop(),x=>x.provenance='synthetic',x=>x.documents[1].source_sha256=x.documents[0].source_sha256,
  x=>delete x.documents[0].reviews,x=>x.documents[0].reviews[1].reviewer_id='A',x=>x.documents.forEach(d=>d.kind='digital'),
  x=>x.documents[0].kind_confirmed_by=null,x=>x.documents[0].fields=[],x=>x.documents[0].extraction.sha256='b'.repeat(64)]){
  const copy=structuredClone(input);mutate(copy);assert.throws(()=>evaluate(copy,{requireCorpus:true}));
 }
});

test('independent disagreements need documented adjudication and remain in agreement metric',()=>{
 const d=doc(1);d.reviews[1].expected=[];
 const input={catalogs,objects,documents:[d]};
 assert.throws(()=>evaluate(input),/gold_adjudication_required/);
 d.adjudication={reviewer_id:'C',reason:'Conferido no original, página 1.',reviewed_at:'2026-11-27T13:00:00Z',expected:[key]};
 const result=evaluate(input);assert.equal(result.exact_indicator_agreement,0);
 d.review_duration_ms=1000;
 assert.equal(evaluate(input).review_time.median_ms,1000);
});
