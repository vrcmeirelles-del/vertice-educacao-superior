import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEnadeMirror } from '../../../source-overrides/client/src/components/area/enade-mirror.ts';
function client(mapping, pages) {
 const queries=[];
 return {queries,from(table){let filter,offset=0;const q={select(){return q;},eq(k,v){filter=[k,v];return q;},order(){return q;},range(from){offset=from;return q;},then(resolve){queries.push({table,filter,offset});return Promise.resolve(resolve(table==='vertice_eorbit_institution_map'?mapping:pages[filter[1]]?.[offset]??{data:[],error:null}));}};return q;}};
}
test('persisted IES mapping determines query; UUID namespaces never conflated',async()=>{
 const c=client({data:[{eorbit_instituicao_id:'source-id'}],error:null},{'source-id':{0:{data:[{id:1}],error:null}}});
 const r=await loadEnadeMirror(c,'vertice-id');assert.equal(r.rows.length,1);assert.deepEqual(c.queries[1].filter,['instituicao_id','source-id']);
});
test('missing or RLS-hidden mapping does not become zero records',async()=>{
 const c=client({data:[],error:null},{});const r=await loadEnadeMirror(c,'vertice-id');assert.match(r.notice,/indisponível/);assert.equal(c.queries.length,1);
});
test('mapping error remains explicit',async()=>{const r=await loadEnadeMirror(client({data:null,error:{message:'denied'}},{}),'id');assert.match(r.notice,/indisponível/);});
test('source failure discards partial results',async()=>{const r=await loadEnadeMirror(client({data:[{eorbit_instituicao_id:'id'}],error:null},{id:{0:{data:null,error:{message:'denied'}}}}),'ies');assert.match(r.notice,/indisponível/);assert.deepEqual(r.rows,[]);});
test('empty query does not assert true absence under RLS',async()=>{const r=await loadEnadeMirror(client({data:[{eorbit_instituicao_id:'id'}],error:null},{}),'ies');assert.match(r.notice,/restrição de acesso/);});
test('ordered pagination and duplicate institutional mappings',async()=>{
 const rows=Array.from({length:1000},(_,id)=>({id}));const c=client({data:[{eorbit_instituicao_id:'id'},{eorbit_instituicao_id:'id'}],error:null},{id:{0:{data:rows,error:null},1000:{data:[{id:1001}],error:null}}});
 const r=await loadEnadeMirror(c,'ies');assert.equal(r.rows.length,1001);assert.equal(c.queries.length,3);
});
