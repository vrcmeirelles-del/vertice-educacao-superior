// Offline evaluation of HUMAN-labelled documents. No network, provider, DB or approval writes.
// Input: {catalogs,objects,documents:[{id,kind,reviewed_by:[reviewerA,reviewerB],
// extraction:{text,pages,partial},fileName,expected:["instrument/version/object"]}]}.
import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
import {analyzeByRules} from '../supabase/functions/vertice-doc-prevalidate/rule-analysis.mjs';
import {evaluateFields} from '../supabase/functions/vertice-doc-prevalidate/document-quality.mjs';
const median=values=>{const s=[...values].sort((a,b)=>a-b);return s.length?(s[Math.floor((s.length-1)/2)]+s[Math.ceil((s.length-1)/2)])/2:null;};
const sameSet=(a,b)=>a.length===b.length&&[...a].sort().every((v,i)=>v===[...b].sort()[i]);
export function evaluate(input,{requireCorpus=false}={}){
 if(!Array.isArray(input.documents)||!input.documents.length)throw Error('empty_sample');
 if(requireCorpus && (input.documents.length<100 || input.provenance!=='real_documents'))throw Error('real_corpus_of_100_required');
 const seen=new Set(),hashes=new Set(),groups={},times=[];let tp=0,fp=0,fn=0,abstained=0,critical=0,fieldCount=0,fieldErrors=0,reviewPairs=0,agreed=0;
 for(const d of input.documents){
  if(!d.id||seen.has(d.id))throw Error('duplicate_or_missing_id');seen.add(d.id);
  if(new Set((d.reviewed_by||[]).filter(x=>typeof x==='string'&&x.trim())).size<2)throw Error('two_human_reviewers_required');
  if(!['digital','scanned','photographed'].includes(d.kind)||!Array.isArray(d.expected))throw Error('invalid_gold_record');
  const reviews=d.reviews;
  if(requireCorpus && (!/^[a-f0-9]{64}$/.test(d.source_sha256||'') || hashes.has(d.source_sha256)))throw Error('unique_source_hash_required');
  hashes.add(d.source_sha256);
  if(reviews){
   if(reviews.length!==2 || reviews.some(r=>!d.reviewed_by.includes(r.reviewer_id)||!Array.isArray(r.expected)||!Number.isFinite(Date.parse(r.reviewed_at))) || reviews[0].reviewer_id===reviews[1].reviewer_id)throw Error('independent_reviews_required');
   reviewPairs++;if(sameSet(reviews[0].expected,reviews[1].expected))agreed++;
   const agreement=sameSet(reviews[0].expected,reviews[1].expected);
   if(agreement ? !sameSet(d.expected,reviews[0].expected) : !d.adjudication?.reviewer_id || !d.adjudication?.reason?.trim() || !Number.isFinite(Date.parse(d.adjudication?.reviewed_at)) || !Array.isArray(d.adjudication?.expected) || !sameSet(d.expected,d.adjudication.expected))throw Error('gold_adjudication_required');
  }else if(requireCorpus)throw Error('independent_reviews_required');
  if(requireCorpus && (!d.kind_confirmed_by || !d.reviewed_by.includes(d.kind_confirmed_by) || !Array.isArray(d.fields)||!d.fields.some(f=>f.severity==='critical') || d.extraction.sha256!==d.source_sha256))throw Error('source_kind_and_critical_fields_required');
  const fields=evaluateFields(d.fields??[]);critical+=fields.critical_errors;fieldCount+=fields.fields;fieldErrors+=fields.errors.filter(e=>e.severity!=='benign').length;
  if(d.review_duration_ms!=null){if(!Number.isFinite(d.review_duration_ms)||d.review_duration_ms<0)throw Error('invalid_review_duration');times.push(d.review_duration_ms);}
  if(d.expected.some(x=>!input.objects.some(o=>{const c=input.catalogs.find(c=>c.id===o.catalog_id);return c&&x===`${c.instrument_code}/${c.instrument_version}/${o.object_code}`;})))throw Error('unknown_gold_indicator');
  const r=analyzeByRules({...d,objects:input.objects,catalogs:input.catalogs});
  const predicted=new Set(r.indicator_links.map(l=>`${l.instrument_code}/${l.instrument_version}/${l.object_code}`)),gold=new Set(d.expected);
  let a=0,b=0,c=0;for(const x of predicted)gold.has(x)?a++:b++;for(const x of gold)if(!predicted.has(x))c++;
  tp+=a;fp+=b;fn+=c;if(!predicted.size)abstained++;
  const g=groups[d.kind]??={documents:0,tp:0,fp:0,fn:0,abstained:0,critical_errors:0};g.documents++;g.tp+=a;g.fp+=b;g.fn+=c;g.abstained+=!predicted.size?1:0;g.critical_errors+=fields.critical_errors;
 }
 const metrics=({tp,fp,fn})=>({precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null});
 if(requireCorpus&&['digital','scanned','photographed'].some(k=>!groups[k]?.documents))throw Error('all_three_source_kinds_required');
 return {documents:seen.size,tp,fp,fn,...metrics({tp,fp,fn}),abstained,abstention_rate:abstained/seen.size,
  fields_evaluated:fieldCount,field_errors:fieldErrors,critical_errors:critical,
  exact_indicator_agreement:reviewPairs?agreed/reviewPairs:null,review_pairs:reviewPairs,
  review_time:{observed:times.length,median_ms:median(times)},corpus_requirements_met:requireCorpus,
  groups:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{...v,...metrics(v),abstention_rate:v.abstained/v.documents}])),provider_transmission:false,production_validation:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const input=JSON.parse(readFileSync(process.argv[2],'utf8'));
 console.log(JSON.stringify(evaluate(input,{requireCorpus:process.argv.includes('--require-corpus')}),null,2));
}
