// Node >=22.18. No credentials or external services. Execute the actual TS handlers in VM modules.
// node --experimental-vm-modules --test scripts/tests/sapiens-providers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {createSapiensEngine, DEFAULT_MODELS} from '../../source-overrides/supabase/functions/_shared/sapiens-llm.ts';

const institution = '00000000-0000-4000-8000-000000000001';
const course = '00000000-0000-4000-8000-000000000002';
const keys = {OPENAI_API_KEY:'synthetic-openai', ANTHROPIC_API_KEY:'synthetic-anthropic'};
const env = config => key => config[key];
const diagnosis = {summary:'A amostra sintética sugere necessidade de reforço pedagógico, sujeita à validação humana.',
  detailed_analysis:{main_findings:['Desempenho baixo'],possible_causes:['Hipótese a validar'],methodology_notes:'Amostra sintética'},
  recommended_actions:[{type:'remedial_practice',title:'Revisão de conteúdo',description:'Prática pedagógica proposta para validação do coordenador.',priority:'high'}]};
const briefing = {summary:'Briefing sintético para análise humana antes de qualquer decisão.', sections:[{title:'Pendências',severity:'high',items:[{text:'Revisar plano proposto.',action_required:true}]}]};
const review = kind => kind === 'diagnosis'
  ? {contradictory_notes:'A conclusão está restrita à amostra; validar as hipóteses com o coordenador.',issues_found:[],divergence:'none',recommendation:'proceed'}
  : {adjustments:'Briefing aprovado sem ressalvas.',issues:[],divergence:'none',recommendation:'proceed'};

function service(kind, config = {}) {
  const calls = [];
  const request = async (url, init) => {
    const provider = url.includes('anthropic') ? 'anthropic' : 'openai';
    const body = JSON.parse(init.body);
    const system = provider === 'openai' ? body.messages[0].content : body.system;
    const stage = system.startsWith('Você é um auditor crítico.') ? 'review' : 'generation';
    const call = {provider,stage,body,init}; calls.push(call);
    const override = config[`${provider}:${stage}`] ?? config[provider];
    if (typeof override === 'function') return override(call);
    if (override instanceof Error) throw override;
    if (typeof override === 'number') return new Response('sensitive-upstream-body', {status:override,headers:{'request-id':'req-synthetic'}});
    const payload = override?.payload ?? (stage === 'review' ? {...review(kind), ...config.review} : kind === 'diagnosis' ? diagnosis : briefing);
    const text = override?.text ?? JSON.stringify(payload);
    const model = config.models?.[provider] ?? (provider === 'openai' ? 'gpt-4o-2024-11-20' : DEFAULT_MODELS.anthropic);
    const response = provider === 'openai'
      ? {model, choices:[{finish_reason:override?.stop ?? 'stop',message:{content:text,...override?.message}}]}
      : {model,stop_reason:override?.stop ?? 'end_turn',content:[{type:'thinking',thinking:'not text'}, {type:'text',text}]};
    return Response.json({...response,...override?.envelope},{headers:{'x-request-id':'req-synthetic'}});
  };
  return {request,calls};
}

for (const kind of ['diagnosis','briefing']) {
  test(`${kind}: two providers, independent review, exact returned models and request IDs`,async()=>{
    const s = service(kind); const result = await createSapiensEngine(env(keys),s.request).run('Generate JSON','Synthetic context',kind);
    assert.deepEqual(s.calls.map(c=>[c.provider,c.stage]),[['openai','generation'],['anthropic','review']]);
    assert.equal(result.review.status,'independent'); assert.equal(result.review.completed,true);
    assert.equal(result.llm_model,'gpt-4o-2024-11-20+claude-sonnet-4-6');
    assert.equal(result.attempts[0].requested_model,'gpt-4o');
    assert.equal(result.attempts[0].resolved_model,'gpt-4o-2024-11-20');
    assert.equal(result.attempts[1].request_id,'req-synthetic');
    assert.equal(s.calls[1].body.model,'claude-sonnet-4-6');
    assert.equal(result.requires_human_review,true);
  });
  for (const provider of ['openai','anthropic']) test(`${kind}: only ${provider}, same-provider review is explicit`,async()=>{
    const config = provider === 'openai' ? {OPENAI_API_KEY:keys.OPENAI_API_KEY} : {ANTHROPIC_API_KEY:keys.ANTHROPIC_API_KEY};
    const s = service(kind);const result = await createSapiensEngine(env(config),s.request).run('Generate JSON','Synthetic',kind);
    assert.equal(result.generated.provider,provider);assert.equal(result.review.status,'same_provider');
    assert.equal(result.review.independent,false);assert.equal(result.requires_human_review,true);
    assert.deepEqual(s.calls.map(c=>c.provider),[provider,provider]);
    assert.ok(result.attempts.some(a=>a.code==='not_configured'));
    assert.match(provider === 'openai' ? s.calls[1].body.messages[0].content : s.calls[1].body.system,/não a apresente como revisão independente/);
  });
  for (const failure of [401,403,404,429,500,503,529,new TypeError('sensitive error'),new DOMException('Timeout','TimeoutError')]) {
    const label = typeof failure === 'number' ? failure : failure.name;
    test(`${kind}: OpenAI generation ${label} falls back and does not repeat failed provider`,async()=>{
      const s=service(kind,{openai:failure});const r=await createSapiensEngine(env(keys),s.request).run('Generate JSON','Synthetic',kind);
      assert.equal(r.generated.provider,'anthropic');assert.equal(r.review.status,'same_provider');
      assert.equal(s.calls.filter(c=>c.provider==='openai').length,1);
      assert.equal(r.attempts[0].status,'failed');assert.ok(r.attempts[0].code);
      assert.doesNotMatch(JSON.stringify(r.attempts),/sensitive/);
    });
    test(`${kind}: Anthropic review ${label} falls back without claiming independence`,async()=>{
      const s=service(kind,{anthropic:failure});const r=await createSapiensEngine(env(keys),s.request).run('Generate JSON','Synthetic',kind);
      assert.equal(r.generated.provider,'openai');assert.equal(r.review.status,'same_provider');
      assert.deepEqual(s.calls.map(c=>c.provider),['openai','anthropic','openai']);
      assert.equal(r.attempts[1].status,'failed');assert.ok(r.attempts[1].code);
    });
  }
  test(`${kind}: missing providers performs no network request`,async()=>{
    const s=service(kind);const r=await createSapiensEngine(env({}),s.request).run('Generate JSON','Synthetic',kind);
    assert.equal(r.generated,null);assert.equal(r.review.divergence,'unknown');assert.equal(s.calls.length,0);
  });
  test(`${kind}: both unavailable remains failed, never false consensus`,async()=>{
    const s=service(kind,{openai:503,anthropic:529});const r=await createSapiensEngine(env(keys),s.request).run('Generate JSON','Synthetic',kind);
    assert.equal(r.generated,null);assert.equal(r.review.completed,false);assert.equal(r.review.divergence,'unknown');
    assert.equal(r.llm_model,'fallback-rule');assert.equal(r.attempts.filter(a=>a.status==='failed').length,2);
  });
  for(const bad of [{text:'not JSON'},{payload:{}},{text:'[]'},{payload:{...review(kind),divergence:'unexpected'}},{payload:{...review(kind),recommendation:undefined}}]) {
    test(`${kind}: invalid review ${JSON.stringify(bad)} cannot be recorded as checked`,async()=>{
      const s=service(kind,{'anthropic:review':bad,'openai:review':bad});const r=await createSapiensEngine(env(keys),s.request).run('Generate JSON','Synthetic',kind);
      assert.equal(r.review.completed,false);assert.equal(r.review.divergence,'unknown');
      assert.equal(r.llm_model,'gpt-4o-2024-11-20');
      assert.equal(r.attempts.filter(a=>a.code==='invalid_output').length,2);
    });
  }
  test(`${kind}: unavailable reviewers preserve valid generation and actual generator model`,async()=>{
    const s=service(kind,{'anthropic:review':503,'openai:review':new DOMException('Timeout','TimeoutError')});
    const r=await createSapiensEngine(env(keys),s.request).run('Generate JSON','Synthetic',kind);
    assert.equal(r.generated.provider,'openai');assert.equal(r.review.status,'unavailable');
    assert.equal(r.review.divergence,'unknown');assert.equal(r.review.reviewer_model,null);
    assert.equal(r.llm_model,'gpt-4o-2024-11-20');
  });
  for (const [divergence,recommendation] of [['major','proceed'],['minor','revise'],['none','reject_for_human_review']]) {
    test(`${kind}: ${divergence}/${recommendation} cannot bypass human review`,async()=>{
      const s=service(kind,{review:{divergence,recommendation}});const r=await createSapiensEngine(env(keys),s.request).run('Generate JSON','Synthetic',kind);
      assert.equal(r.review.divergence,divergence);assert.equal(r.review.recommendation,recommendation);
      assert.equal(r.requires_human_review,true);
    });
  }
  for(const bad of [{text:'invalid JSON'},{payload:{}},{stop:'length'},{envelope:{model:undefined}},{envelope:{choices:[]}}]) {
    test(`${kind}: invalid/incomplete primary generation ${JSON.stringify(bad)} uses alternate`,async()=>{
      const s=service(kind,{'openai:generation':bad});const r=await createSapiensEngine(env(keys),s.request).run('Generate JSON','Synthetic',kind);
      assert.equal(r.generated.provider,'anthropic');assert.equal(r.attempts[0].status,'failed');
    });
  }
}

test('retired Claude override is rejected locally, no request to retired model',async()=>{
  const s=service('diagnosis');const r=await createSapiensEngine(env({...keys,SAPIENS_ANTHROPIC_MODEL:'claude-sonnet-4-20250514'}),s.request).run('Generate JSON','Synthetic','diagnosis');
  assert.ok(r.attempts.some(a=>a.code==='retired_model'));assert.equal(r.review.status,'same_provider');
  assert.ok(s.calls.every(c=>c.provider==='openai'));
});
test('explicit model overrides retained; returned models determine provenance and provider determines review routing',async()=>{
  const s=service('briefing',{models:{openai:'ft:custom-openai-snapshot',anthropic:'claude-sonnet-4-6'}});
  const r=await createSapiensEngine(env({...keys,SAPIENS_OPENAI_MODEL:'gpt-4o-2024-11-20',SAPIENS_ANTHROPIC_MODEL:'claude-sonnet-4-6'}),s.request,{maxTokens:4000}).run('Generate JSON','Synthetic','briefing');
  assert.equal(s.calls[0].body.model,'gpt-4o-2024-11-20');assert.equal(s.calls[0].body.max_tokens,4000);
  assert.equal(s.calls[1].provider,'anthropic');assert.equal(r.llm_model,'ft:custom-openai-snapshot+claude-sonnet-4-6');
});
test('provider timeout aborts the in-flight request then executes the fallback',async()=>{
  const s=service('diagnosis',{'openai:generation':({init})=>new Promise((_,reject)=>{
    init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true});
    // Keep Node alive until the unref'ed AbortSignal timer fires.
    const handle=setTimeout(()=>reject(new Error('abort did not fire')),1000);
    init.signal.addEventListener('abort',()=>clearTimeout(handle),{once:true});
  })});
  const r=await createSapiensEngine(env(keys),s.request,{timeoutMs:5}).run('Generate JSON','Synthetic','diagnosis');
  assert.equal(r.attempts[0].code,'timeout');assert.equal(r.generated.provider,'anthropic');
});
for (const provider of ['openai','anthropic']) {
  for (const [name,override,code] of [
    ['invalid HTTP JSON',()=>new Response('invalid JSON',{status:200}),'invalid_response'],
    ['body timeout',()=>({ok:true,status:200,headers:new Headers(),json:async()=>{throw new DOMException('Timeout','TimeoutError');}}),'timeout'],
    ['truncated output',{stop:'max_tokens'},'incomplete_or_refused'],
    ['refusal',{message:{refusal:'refused'},stop:'refusal'},'incomplete_or_refused'],
  ]) test(`${provider}: ${name} explicitly recorded`,async()=>{
    const config = provider === 'anthropic' ? {ANTHROPIC_API_KEY:keys.ANTHROPIC_API_KEY} : {OPENAI_API_KEY:keys.OPENAI_API_KEY};
    const s=service('diagnosis',{[provider]:override});
    const r=await createSapiensEngine(env(config),s.request).run('Generate JSON','Synthetic','diagnosis');
    assert.equal(r.generated,null);assert.ok(r.attempts.some(a=>a.code===code));
  });
}

async function invoke(kind, config = {}, serviceConfig = {}, fixture = {}) {
  const inserts=[];const calls=[];const s=service(kind,serviceConfig);
  const client={from(table) {
    let inserting;
    const data=()=>{
      if(inserting) return {data:{id:'synthetic-record'},error:null};
      if(table==='vertice_institutions') return {data:{id:institution,name:'IES sintética',tier:'superior'}};
      if(table==='vertice_courses') return {data:[{id:course,name:'Direito sintético'}]};
      if(table==='vertice_learning_course_metrics') return {data:fixture.metrics??[{course_id:course,module:'oab',semester:'2026/2',attempts:100,correct:20,participants:10}]};
      return {data:[]};
    };
    const query={insert(row){inserting=row;inserts.push({table,row});return query;},then(resolve,reject){return Promise.resolve(data()).then(resolve,reject);}};
    for(const method of ['select','eq','in','order','limit','maybeSingle','single'])query[method]=()=>query;
    calls.push(table);return query;
  }};
  let handler;
  const vars={...keys,...config,SUPABASE_URL:'https://synthetic.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'};
  for (const key of Object.keys(vars)) if(vars[key]===null) delete vars[key];
  const context=vm.createContext({Request,Response,URL,AbortSignal,console,Error,TypeError,DOMException,
    fetch:s.request,Deno:{env:{get:env(vars)},serve:fn=>{handler=fn;}}});
  const read = relative => readFileSync(new URL(`../../source-overrides/supabase/functions/${relative}`,import.meta.url),'utf8');
  const compile=(src,id)=>new vm.SourceTextModule(stripTypeScriptTypes(src),{context,identifier:id});
  const shared=compile(read('_shared/sapiens-llm.ts'),'shared');
  const supabase=new vm.SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>client);},{context});
  const module=compile(read(`vertice-sapiens-${kind==='diagnosis'?'analyze':'briefing'}/index.ts`),'handler');
  await module.link(spec=>spec.startsWith('npm:')?supabase:shared);await module.evaluate();
  const response=await handler(new Request('https://synthetic.invalid',{method:'POST',headers:{authorization:'Bearer synthetic-service','Content-Type':'application/json'},body:JSON.stringify({institutionId:institution,briefingType:'morning'})}));
  return {response,body:await response.json(),inserts,calls,providerCalls:s.calls};
}

for (const kind of ['diagnosis','briefing']) {
  for (const config of [{}, {ANTHROPIC_API_KEY:null}, {OPENAI_API_KEY:null}]) {
    test(`${kind} handler: persistence and human gate with ${JSON.stringify(config)}`,async()=>{
      const r=await invoke(kind,config);assert.equal(r.response.status,200);
      const stored=r.inserts.find(x=>x.table===`vertice_sapiens_${kind==='diagnosis'?'diagnoses':'briefings'}`).row;
      const meta=kind==='diagnosis'?stored.detailed_analysis.contradictory_review:stored.sections.find(x=>x.llm_execution).llm_execution;
      assert.equal(meta.requires_human_review,true);assert.equal(meta.completed,true);
      assert.equal(meta.independent,Object.keys(config).length===0);
      assert.equal(stored.llm_model,[meta.generator_model,meta.reviewer_model].join('+'));
      if(kind==='diagnosis'){
        assert.equal(stored.status,'draft');assert.equal(stored.contradictory_checked,true);
        const intervention=r.inserts.find(x=>x.table==='vertice_sapiens_interventions').row;
        assert.equal(intervention.status,'proposed');assert.equal(intervention.reviewed_by,undefined);
        assert.equal(intervention.llm_model,stored.llm_model);
      } else assert.ok(stored.sections.some(x=>x.title==='Validação humana'&&x.items[0].action_required));
      const audit=r.inserts.find(x=>x.table==='vertice_sapiens_audit_trail').row;
      assert.equal(audit.details.llm_model,stored.llm_model);assert.equal(audit.details.requires_human_review,true);
    });
  }
  for(const override of [{divergence:'major'},{divergence:'none',recommendation:'reject_for_human_review'}])test(`${kind} handler: human review required on ${JSON.stringify(override)}`,async()=>{
    const r=await invoke(kind,{}, {review:override});assert.equal(r.response.status,200);
    const stored=r.inserts.find(x=>x.table===`vertice_sapiens_${kind==='diagnosis'?'diagnoses':'briefings'}`).row;
    assert.match(stored.summary,/REVISÃO HUMANA OBRIGATÓRIA/);
  });
  test(`${kind} handler: no valid reviewers does not claim completed review`,async()=>{
    const r=await invoke(kind,{}, {'anthropic:review':503,'openai:review':503});assert.equal(r.response.status,200);
    const stored=r.inserts.find(x=>x.table===`vertice_sapiens_${kind==='diagnosis'?'diagnoses':'briefings'}`).row;
    const meta=kind==='diagnosis'?stored.detailed_analysis.contradictory_review:stored.sections.find(x=>x.llm_execution).llm_execution;
    assert.equal(meta.completed,false);assert.equal(meta.divergence,'unknown');
    assert.equal(stored.llm_model,'gpt-4o-2024-11-20');
    if(kind==='diagnosis')assert.equal(stored.contradictory_checked,false);
  });
  test(`${kind} handler: both services unavailable are explicit and no intervention fabricated`,async()=>{
    const r=await invoke(kind,{}, {openai:503,anthropic:529});
    assert.equal(r.inserts.some(x=>x.table==='vertice_sapiens_interventions'),false);
    if(kind==='diagnosis'){
      assert.equal(r.response.status,200);
      const row=r.inserts.find(x=>x.table==='vertice_sapiens_diagnoses').row;
      assert.equal(row.status,'draft');assert.equal(row.llm_model,'fallback-rule');
      assert.equal(row.contradictory_checked,false);assert.equal(row.detailed_analysis.requires_human_review,true);
      assert.equal(row.detailed_analysis.contradictory_review.attempts.filter(a=>a.status==='failed').length,2);
    } else {
      assert.equal(r.response.status,503);assert.equal(r.body.error,'llm_unavailable');assert.equal(r.inserts.length,0);
      assert.equal(r.body.llm_execution.divergence,'unknown');
    }
  });
}
test('diagnosis handler: prefix cannot exceed database summary limit',async()=>{
  const r=await invoke('diagnosis',{}, {'openai:generation':{payload:{...diagnosis,summary:'a'.repeat(2500)}},review:{divergence:'major'}});
  assert.equal(r.inserts.find(x=>x.table==='vertice_sapiens_diagnoses').row.summary.length,2000);
});
test('diagnosis handler: healthy metrics stay deterministic and make no provider calls',async()=>{
  const r=await invoke('diagnosis',{}, {}, {metrics:[{course_id:course,module:'oab',semester:'2026/2',attempts:100,correct:90,participants:10}]});
  const row=r.inserts.find(x=>x.table==='vertice_sapiens_diagnoses').row;
  assert.equal(row.llm_model,'rule-based');assert.equal(row.contradictory_checked,false);assert.equal(r.providerCalls.length,0);
});
