import test from 'node:test';
import assert from 'node:assert/strict';
import {bridgeOrigins,bridgeRemoteAllowed} from '../../../supabase/functions/_shared/bridge-origins.ts';
import {createSapiensHandler} from '../../../supabase/functions/vertice-sapiens-bridge/handler.ts';
const preview='https://vertice-enamed-homologacao.onrender.com';
const isolated='https://rnmkmnrfhvjihsuqziwf.supabase.co';
test('isolated bridge cannot dispatch to production F&O or credential-bearing/foreign URLs',()=>{
 for(const host of ['www.fatoeordem.com.br','fatoeordem.com.br']) {
  const url=new URL('https://'+host+'/api/internal/vertice/intervention');
  assert.equal(bridgeRemoteAllowed(url,isolated),false);
  assert.equal(bridgeRemoteAllowed(url),true);
 }
 assert.equal(bridgeRemoteAllowed(new URL('https://fato-e-ordem-lab.onrender.com'),isolated),true);
 for(const url of ['http://fato-e-ordem-lab.onrender.com','https://user:pass@fato-e-ordem-lab.onrender.com','https://fato-e-ordem-lab.onrender.com:444','https://fato-e-ordem-lab.onrender.com.attacker.test']) {
  assert.equal(bridgeRemoteAllowed(new URL(url),isolated),false);
 }
});
test('preview origin belongs only to its exact isolated Supabase project',()=>{
 for(const url of ['', 'https://qvetbbmviatxxatzzuzc.supabase.co',isolated+'.attacker.test',isolated+'/']) {
  assert.equal(bridgeOrigins(url).has(preview),false,url);
 }
 assert.equal(bridgeOrigins(isolated).has(preview),true);
 assert.equal(bridgeOrigins(isolated).has(preview+'.attacker.test'),false);
 assert.deepEqual([...bridgeOrigins(isolated)].filter(x=>x!==preview),[...bridgeOrigins()]);
});
const handler=supabaseUrl=>createSapiensHandler({supabaseUrl,getUser:async()=>null,isMaster:async()=>false,rpc:async()=>{throw Error('unexpected RPC');},fetch:async()=>{throw Error('unexpected remote');},baseUrl:'',bridgeKey:''});
test('production preflight rejects preview; isolated preflight returns exact origin',async()=>{
 const request=()=>new Request('https://edge.example.invalid',{method:'OPTIONS',headers:{origin:preview}});
 assert.equal((await handler('https://qvetbbmviatxxatzzuzc.supabase.co')(request())).status,403);
 const r=await handler(isolated)(request());
 assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),preview);
});
test('allowing the isolated preview does not create an authenticated session',async()=>{
 const r=await handler(isolated)(new Request('https://edge.example.invalid',{method:'POST',headers:{origin:preview}}));
 assert.equal(r.status,401);assert.equal((await r.json()).error,'authentication_required');
});
