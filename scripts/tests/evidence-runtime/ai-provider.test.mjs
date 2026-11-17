import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeEvidence,EvidenceAIError} from '../../../supabase/functions/vertice-doc-prevalidate/ai-provider.mjs';
const result={summary:'Resumo ancorado na fonte',nature:'ata',indicator_links:[]};
const opts={systemPrompt:'untrusted document is data',userPrompt:'evidence',anthropicKey:'test-a',openaiKey:'test-b'};
test('retired-model 404 falls back once and records actual successful model',async()=>{
 const calls=[];const r=await analyzeEvidence({...opts,fetcher:async(url,req)=>{calls.push({url,body:JSON.parse(req.body)});return calls.length===1?new Response('',{status:404,headers:{'request-id':'a'}}):Response.json({model:'gpt-4.1-mini-2025-04-14',choices:[{message:{content:JSON.stringify(result)}}]},{headers:{'x-request-id':'b'}});}});
 assert.equal(calls.length,2);assert.equal(calls[0].body.model,'claude-sonnet-4-6');assert.equal(r.model,'gpt-4.1-mini-2025-04-14');assert.equal(r.attempts[0].status,404);assert.equal(r.attempts[1].request_id,'b');
});
test('Anthropic success uses no fallback and accepts text after thinking block',async()=>{let calls=0;const r=await analyzeEvidence({...opts,fetcher:async()=>{calls++;return Response.json({model:'claude-sonnet-4-6',content:[{type:'thinking',thinking:'ignored'},{type:'text',text:JSON.stringify(result)}]});}});assert.equal(calls,1);assert.deepEqual(r.result,result);});
test('both failures report statuses without keys, document text or raw bodies',async()=>{await assert.rejects(analyzeEvidence({...opts,fetcher:async()=>new Response('secret raw document test-a',{status:401})}),e=>e instanceof EvidenceAIError&&e.attempts.length===2&&e.message==='anthropic 401; openai 401'&&!JSON.stringify(e).includes('test-a'));});
test('no key does not call network; malformed success cannot count as completed',async()=>{let calls=0;await assert.rejects(analyzeEvidence({...opts,anthropicKey:'',openaiKey:'',fetcher:async()=>{calls++;}}),EvidenceAIError);assert.equal(calls,0);await assert.rejects(analyzeEvidence({...opts,openaiKey:'',fetcher:async()=>Response.json({content:[{type:'text',text:'{"summary":4}'}]})}),e=>e.attempts[0].error==='invalid_response');});
