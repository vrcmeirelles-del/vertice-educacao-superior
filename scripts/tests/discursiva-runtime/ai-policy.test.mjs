import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runAction} from '../../../supabase/functions/vertice-discursiva/handler.ts';

// Extrai a política declarada no cabeçalho da função e a avalia com ambientes sintéticos.
const src=readFileSync(new URL('../../../supabase/functions/vertice-discursiva/index.ts',import.meta.url),'utf8');
const def=src.match(/const AI_FEATURES_DEFAULT="[^"]*";/)[0];
const pol=src.match(/const aiPolicy=\(get:\(k:string\)=>string\|undefined\)=>(.*);\n/)[1];
const aiPolicy=new Function(def.replace('const ','var ')+';return get=>'+pol.replace(/^\(feature:string\)/,'(feature)'))();
const env=o=>k=>o[k];

test('IA suspensa: nenhuma função usa IA, nem as aprovadas',()=>{
 const p=aiPolicy(env({}));
 for(const f of ['discursiva.transcribe','discursiva.generate','discursiva.second_opinion','cpa.analysis','doc.analyze'])assert.equal(p(f),false,f);
});
test('IA religada: só transcrição e geração de questão nova; correção e CPA seguem no algoritmo',()=>{
 const p=aiPolicy(env({AI_SUSPENDED:'false'}));
 for(const f of ['discursiva.transcribe','discursiva.generate'])assert.equal(p(f),true,f);
 for(const f of ['discursiva.second_opinion','cpa.analysis','doc.analyze','impacto.analyze','sapiens.analyze','base.assistant','demo.chat','course.review','doc.prevalidate'])assert.equal(p(f),false,f);
});
test('AI_FEATURES restringe ou amplia explicitamente a lista',()=>{
 const p=aiPolicy(env({AI_SUSPENDED:'false',AI_FEATURES:' discursiva.transcribe '}));
 assert.equal(p('discursiva.transcribe'),true);assert.equal(p('discursiva.generate'),false);
 assert.equal(aiPolicy(env({AI_SUSPENDED:'false',AI_FEATURES:''}))('discursiva.transcribe'),false,'lista vazia desliga tudo');
});
const q={case:'Caso clínico sintético com dados suficientes.',command:'Indique a conduta.',expectedAnswer:'Conduta adequada e justificada.',competency:'Raciocínio',referenceIds:['source:1'],rubric:[{criterion:'Indica conduta adequada',points:10}]};
const base=(ai,calls)=>({ai:f=>ai.includes(f),authorize:async()=>{},image:async()=>({base64:'x',mime:'image/png'}),sources:async()=>[{source_table:'source',source_id:'1',excerpt:'Excerto com texto suficiente para gerar.',text_status:'ready'}],
 call:async p=>{calls.push(p);throw Error('provedor não deveria ser chamado');},rpc:async a=>a==='get_submission'?{submission:{id:'s',version:1,answer:'Conduta adequada.'},question:{content:q}}:{}});
test('funções de IA desligadas recusam antes de chamar provedor; segunda opinião por IA não existe mais; correção por algoritmo segue',async()=>{
 const calls=[];const d=base([],calls);
 await assert.rejects(runAction({action:'transcribe',path:'p'},d),/ai_feature_disabled/);
 await assert.rejects(runAction({action:'generate',discipline:'Teste',query:'',difficulty:'medium',sourceIds:['source:1']},d),/ai_feature_disabled/);
 await assert.rejects(runAction({action:'grade',submissionId:'s',secondOpinion:true},d),/second_opinion_removed/);
 const r=await runAction({action:'grade',submissionId:'s'},d);
 assert.equal(r.assessments[0].provider,'regras');assert.equal(r.secondOpinion,undefined);assert.equal(calls.length,0);
 assert.deepEqual(await runAction({action:'status'},d),{ai:{transcribe:false,generate:false}});
 assert.deepEqual((await runAction({action:'status'},base(['discursiva.transcribe'],[]))).ai.transcribe,true);
});

test('segunda opinião por IA foi retirada: recusa mesmo com todas as funções liberadas, sem chamar provedor', async () => {
 const calls=[];const d=base(['discursiva.transcribe','discursiva.generate','discursiva.second_opinion'],calls);
 await assert.rejects(runAction({action:'grade',submissionId:'s',secondOpinion:true},d),/second_opinion_removed/);
 assert.equal(calls.length,0);
 const r=await runAction({action:'grade',submissionId:'s'},d);assert.equal(r.assessments[0].provider,'regras');assert.equal(r.secondOpinion,undefined);
});
