import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { reviewThematic, validateThematic, parseThematic, thematicDecision, precheckThematic } from "./thematic.ts";
const input = () => ({module:"carreiras",sourceKey:"test-only",sourceVersion:"v1",stem:"Julgue a assertiva sobre responsabilidade civil das empresas estatais.",answer:"E",format:"CERTO_ERRADO",flags:[],references:[],proposed:{discipline:"Direito Administrativo",theme:"Empresas estatais",subtheme:"Distinção dos regimes de responsabilidade civil"}});
const vote = () => ({approve:true,confidence:0.95,specific:true,commandAligned:true,answerRespected:true,temporalContextValid:true,evidence:["responsabilidade civil das empresas estatais"],referenceIds:[],issues:[],reason:"O descritor nomeia a distinção e não converte a assertiva errada em regra."});
test("dois provedores recebem o mesmo snapshot, sem a resposta alheia; não há publicação", async()=>{
 const i=input(),before=JSON.stringify(i),seen:string[]=[];
 const call=async(_s:string,p:string)=>{seen.push(p);return {model:"fixture",content:JSON.stringify(vote())};};
 const r=await reviewThematic(i,call,call);
 assert.equal(r.decision.status,"dual_review_approved_proposal_only");
 assert.deepEqual(r.reviews.map(x=>x.provider),["openai","anthropic"]);
 assert.deepEqual(seen,[before,before]);assert.equal(JSON.stringify(i),before);
 assert.equal(r.sourceWrites,0);assert.equal(r.publicationAllowed,false);assert.match(r.snapshotHash,/^[a-f0-9]{64}$/);
});
test("falha do segundo provedor não recebe fallback para o primeiro",async()=>{
 let calls=0;const a=async()=>{calls++;return {model:"a",content:JSON.stringify(vote())};};
 const r=await reviewThematic(input(),a,async()=>null);
 assert.equal(calls,1);assert.equal(r.independentProviders,false);assert.equal(r.decision.status,"blocked");
 assert.ok(r.decision.reasons.includes("independent_provider_review_missing"));
});
test("evidência inventada impede aprovação mesmo com confiança elevada",async()=>{
 const bad={...vote(),evidence:["Esta frase foi inventada e não consta da questão"]};
 const r=await reviewThematic(input(),async()=>({model:"a",content:JSON.stringify(bad)}),async()=>({model:"b",content:JSON.stringify(vote())}));
 assert.equal(r.reviews[0].error,"nonliteral_or_missing_evidence");assert.equal(r.decision.status,"blocked");
});
test("concordância não supera anulação, trava docente ou item experimental",()=>{
 for(const flag of ["annulled","human_locked","experimental","missing_media"]){const i={...input(),flags:[flag]};assert.equal(thematicDecision(i,vote(),vote()).status,"blocked");}
 assert.ok(thematicDecision({...input(),answer:"ANULADA"},vote(),vote()).reasons.includes("annulled"));
});
test("gabarito ausente e mídia substituída por marcador bloqueiam",()=>{
 assert.ok(thematicDecision({...input(),answer:null},vote(),vote()).reasons.includes("missing_answer"));
 assert.ok(thematicDecision({...input(),stem:"[Imagem: bem do patrimônio cultural]"},vote(),vote()).reasons.includes("media_not_confirmed"));
 assert.equal(thematicDecision({...input(),mediaRequired:true,mediaComplete:true},vote(),vote()).status,"blocked");
});
test("o endpoint real exige usuário Master com MFA antes da revisão e não exige instituição fictícia",async()=>{
 const source=readFileSync(new URL("./index.ts",import.meta.url),"utf8").replace(/^import .*;\s*$/gm,"");
 const code=stripTypeScriptTypes(source);let handler:any,calls=0,master=true,valid=true;
 const admin={auth:{getUser:async()=>({data:{user:valid?{id:"actor"}:null},error:null})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:master?{user_id:"actor"}:null,error:null})})})})};
 const fakeEnv={SUPABASE_URL:"https://example.invalid",SUPABASE_SERVICE_ROLE_KEY:"test-fixture-only",AI_SUSPENDED:"false",AI_FEATURES:"sapiens.analyze",OPENAI_API_KEY:"test-fixture-only",ANTHROPIC_API_KEY:"test-fixture-only"};
 new Function("createClient","analyzePlanning","reviewThematic","Deno",code)(()=>admin,()=>{},async()=>{calls++;return {sourceWrites:0};},{env:{get:(k:string)=>(fakeEnv as any)[k]},serve:(fn:any)=>handler=fn});
 const token=(aal:string)=>"header."+btoa(JSON.stringify({aal}))+".signature";
 const req=(t:string)=>new Request("https://example.invalid",{method:"POST",headers:{authorization:"Bearer "+t},body:JSON.stringify({action:"thematic_review",question:input()})});
 assert.equal((await handler(req("test-fixture-only"))).status,403);
 assert.equal((await handler(req(token("aal1")))).status,403);
 master=false;assert.equal((await handler(req(token("aal2")))).status,403);
 assert.equal(calls,0);master=true;valid=false;assert.equal((await handler(req(token("aal2")))).status,401);
 valid=true;assert.equal((await handler(req(token("aal2")))).status,200);assert.equal(calls,1);
});
test("medicina e recorte normativo temporal exigem data e referência dos dois revisores",()=>{
 for(const module of ["residencia","enamed","carreiras"]){const i={...input(),module,temporalReferenceRequired:true};assert.ok(thematicDecision(i,vote(),vote()).reasons.includes("temporal_reference_required"));}
});
test("recorte errado, falso gabarito, confiança baixa ou ressalva bloqueiam",()=>{
 for(const changed of [{answerRespected:false},{temporalContextValid:false},{commandAligned:false},{specific:false},{approve:false},{confidence:0.89},{issues:["Rótulo genérico"]}])assert.equal(thematicDecision(input(),{...vote(),...changed},vote()).status,"blocked");
});
test("tipos enganosos e referências inventadas são rejeitados",()=>{
 assert.throws(()=>parseThematic(JSON.stringify({...vote(),approve:"true"}),input()));
 assert.throws(()=>parseThematic(JSON.stringify({...vote(),referenceIds:["fabricated"]}),input()));
 assert.throws(()=>validateThematic({...input(),references:[{url:"javascript:alert(1)"}]}));
 assert.throws(()=>validateThematic({...input(),module:"unknown"}));
 assert.throws(()=>validateThematic({...input(),stem:"x".repeat(24001)}));
});
test("referência rastreável permanece excerto fornecido, sem alegação de consulta externa",async()=>{
 const i={...input(),temporalReferenceRequired:true,examDate:"2021-05-23",references:[{id:"law",url:"https://www.gov.br/example",locator:"art. 1",excerpt:"Excerto sintético para teste",version:"2021-05",retrievedAt:"2026-11-16T00:00:00Z"}]};
 const v={...vote(),referenceIds:["law"]};const call=async()=>({model:"fixture",content:JSON.stringify(v)});
 const r=await reviewThematic(i,call,call);assert.equal(r.decision.status,"dual_review_approved_proposal_only");
 assert.equal(r.referencesVerification,"provided_excerpts_not_independently_fetched");
});
test("V14: com a IA suspensa, pré-checagem por regras nunca aprova nem publica",async()=>{
 const ok=await precheckThematic(input());
 assert.equal(ok.decision.status,"awaiting_ai_review");assert.deepEqual(ok.decision.reasons,[]);
 assert.equal(ok.publicationAllowed,false);assert.equal(ok.sourceWrites,0);assert.deepEqual(ok.reviews,[]);
 const annulled=await precheckThematic({...input(),answer:"ANULADA"});
 assert.equal(annulled.decision.status,"blocked");assert.ok(annulled.decision.reasons.includes("annulled"));
 const media=await precheckThematic({...input(),stem:"Observe a figura abaixo e julgue a assertiva sobre responsabilidade civil."});
 assert.ok(media.decision.reasons.includes("media_not_confirmed"));
});
