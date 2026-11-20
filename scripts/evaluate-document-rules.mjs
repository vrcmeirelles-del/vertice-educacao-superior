// Offline evaluation of HUMAN-labelled documents. No network, provider, DB or approval writes.
// Input: {catalogs,objects,documents:[{id,kind,reviewed_by:[reviewerA,reviewerB],
// extraction:{text,pages,partial},fileName,expected:["instrument/version/object"]}]}.
import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
import {analyzeByRules} from '../supabase/functions/vertice-doc-prevalidate/rule-analysis.mjs';
export function evaluate(input){
 if(!Array.isArray(input.documents)||!input.documents.length)throw Error('empty_sample');
 const seen=new Set(),groups={};let tp=0,fp=0,fn=0,abstained=0;
 for(const d of input.documents){
  if(!d.id||seen.has(d.id))throw Error('duplicate_or_missing_id');seen.add(d.id);
  if(new Set((d.reviewed_by||[]).filter(x=>typeof x==='string'&&x.trim())).size<2)throw Error('two_human_reviewers_required');
  if(!['digital','scanned','photographed'].includes(d.kind)||!Array.isArray(d.expected))throw Error('invalid_gold_record');
  if(d.expected.some(x=>!input.objects.some(o=>{const c=input.catalogs.find(c=>c.id===o.catalog_id);return c&&x===`${c.instrument_code}/${c.instrument_version}/${o.object_code}`;})))throw Error('unknown_gold_indicator');
  const r=analyzeByRules({...d,objects:input.objects,catalogs:input.catalogs});
  const predicted=new Set(r.indicator_links.map(l=>`${l.instrument_code}/${l.instrument_version}/${l.object_code}`)),gold=new Set(d.expected);
  let a=0,b=0,c=0;for(const x of predicted)gold.has(x)?a++:b++;for(const x of gold)if(!predicted.has(x))c++;
  tp+=a;fp+=b;fn+=c;if(!predicted.size)abstained++;
  const g=groups[d.kind]??={documents:0,tp:0,fp:0,fn:0};g.documents++;g.tp+=a;g.fp+=b;g.fn+=c;
 }
 const metrics=({tp,fp,fn})=>({precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null});
 return {documents:seen.size,tp,fp,fn,...metrics({tp,fp,fn}),abstained,groups:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{...v,...metrics(v)}])),provider_transmission:false,production_validation:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(evaluate(JSON.parse(readFileSync(process.argv[2],'utf8'))),null,2));
