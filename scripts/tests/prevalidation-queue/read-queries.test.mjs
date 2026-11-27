import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listPrevalidationAttempts, readPrevalidationBatches } from '../../../source-overrides/client/src/lib/prevalidation-queue-data.ts';
function database(tables, failure) {
 const calls=[];
 return {calls,from(table){const call={table,orders:[]};calls.push(call);
  const q={select(columns){call.columns=columns;return q},eq(column,value){call.scope=[column,value];return q},in(column,ids){call.ids=[column,ids];return q},order(column,options){call.orders.push([column,options]);return q},async range(start,end){
   call.range=[start,end];if(failure?.(call))return {data:null,error:new Error('source lookup failed')};
   let data=(tables[table]??[]).filter(r=>r[call.scope[0]]===call.scope[1]);
   if(call.ids)data=data.filter(r=>call.ids[1].includes(r[call.ids[0]]));
   for(const [key,options] of [...call.orders].reverse())data.sort((a,b)=>String(a[key]).localeCompare(String(b[key]))*(options?.ascending===false?-1:1));
   return {data:data.slice(start,end+1).map(r=>Object.fromEntries(call.columns.split(',').map(c=>[c,r[c]]))),error:null};
  }};return q;
 }};
}
const id=n=>String(n).padStart(5,'0');
test('all 1,051 attempts are loaded, with stable ties and metadata only',async()=>{
 const rows=Array.from({length:1051},(_,n)=>({id:id(n),institution_id:'A',created_at:'2026-11-27',extracted_text:'private source'}));
 const db=database({vertice_doc_prevalidation:rows});const result=await listPrevalidationAttempts(db,'A','id,created_at');
 assert.equal(result.length,1051);assert.equal(result[0].id,'01050');assert.equal(result[1050].id,'00000');assert.equal(db.calls.length,2);assert(!result.some(r=>'extracted_text'in r));
});
test('772 filenames remain identifiable within bounded URLs and institution scope',async()=>{
 const files=Array.from({length:772},(_,n)=>({id:id(n),institution_id:'A',file_name:'evidence '+n}));
 const db=database({vertice_repository_files:[...files,{id:'other',institution_id:'B',file_name:'private B'}]});
 const result=await readPrevalidationBatches(db,'A','vertice_repository_files','id',[...files.map(f=>f.id),'other',files[0].id],'id,file_name');
 assert.equal(result.length,772);assert.equal(new Set(result.map(f=>f.id)).size,772);assert(db.calls.every(c=>c.ids[1].length<=50&&c.scope[1]==='A'));assert(!result.some(f=>f.file_name==='private B'));
});
test('multiple links per source are not silently truncated at 1,000',async()=>{
 const links=Array.from({length:51*25},(_,n)=>({id:id(n),institution_id:'A',prevalidation_id:id(Math.floor(n/25)),status:'sugerido'}));
 const db=database({vertice_doc_indicator_links:links});const result=await readPrevalidationBatches(db,'A','vertice_doc_indicator_links','prevalidation_id',Array.from({length:51},(_,n)=>id(n)),'id,prevalidation_id,status');
 assert.equal(result.length,1275);assert.equal(db.calls.length,3);assert(result.every(r=>r.status==='sugerido'));
});
test('a filename lookup failure is raised rather than represented as unknown documents',async()=>{
 const db=database({},c=>c.table==='vertice_repository_files');await assert.rejects(readPrevalidationBatches(db,'A','vertice_repository_files','id',['1'],'id,file_name'),/source lookup failed/);
});
test('document titles use the document schema and empty IDs perform no query',async()=>{
 const db=database({vertice_documents:[{id:'1',institution_id:'A',title:'Document title'}]});
 assert.deepEqual(await readPrevalidationBatches(db,'A','vertice_documents','id',['1'],'id,title'),[{id:'1',title:'Document title'}]);
 const count=db.calls.length;assert.deepEqual(await readPrevalidationBatches(db,'A','vertice_documents','id',[],'id,title'),[]);assert.equal(db.calls.length,count);
});
