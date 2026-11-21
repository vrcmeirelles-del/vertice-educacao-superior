import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { reviewThematic, validateThematic, thematicDecision } from "./thematic.ts";
const input = () => ({module:"carreiras",sourceKey:"test-only",sourceVersion:"v1",stem:"Julgue a assertiva sobre responsabilidade civil das empresas estatais.",answer:"E",format:"CERTO_ERRADO",flags:[] as string[],
 proposed:{area:"Direito",discipline:"Direito Administrativo",theme:"Responsabilidade civil do Estado",subtheme:"Empresas estatais prestadoras de serviço público"},references:[] as any[]});
test("revisão por regras: sem IA, sem escrita e sem publicação; snapshot preservado",async()=>{
 const i=input(),before=JSON.stringify(i);
 const r=await reviewThematic(i);
 assert.equal(r.method,"regras");assert.equal(r.decision.status,"rules_passed_proposal_only");assert.deepEqual(r.decision.reasons,[]);
 assert.equal(JSON.stringify(i),before);assert.equal(r.sourceWrites,0);assert.equal(r.publicationAllowed,false);
 assert.equal(r.decision.publicationAllowed,false);assert.match(r.snapshotHash,/^[a-f0-9]{64}$/);
});
test("mesma entrada, mesmo resultado",async()=>{
 assert.deepEqual(await reviewThematic(input()),await reviewThematic(input()));
});
test("anulação, trava docente, item experimental e mídia bloqueiam",()=>{
 for(const flag of ["annulled","human_locked","experimental","missing_media"])assert.equal(thematicDecision({...input(),flags:[flag]}).status,"blocked");
 assert.ok(thematicDecision({...input(),answer:"ANULADA"}).reasons.includes("annulled"));
});
test("gabarito ausente e mídia substituída por marcador bloqueiam",()=>{
 assert.ok(thematicDecision({...input(),answer:null}).reasons.includes("missing_answer"));
 assert.ok(thematicDecision({...input(),stem:"[Imagem: bem do patrimônio cultural]"}).reasons.includes("media_not_confirmed"));
 assert.ok(thematicDecision({...input(),stem:"Observe a figura abaixo e julgue a assertiva sobre responsabilidade civil."}).reasons.includes("media_not_confirmed"));
 assert.equal(thematicDecision({...input(),mediaRequired:true}).status,"blocked");
});
test("medicina e recorte normativo temporal exigem data e referência",()=>{
 for(const module of ["residencia","enamed","carreiras"])assert.ok(thematicDecision({...input(),module,temporalReferenceRequired:true}).reasons.includes("temporal_reference_required"));
 const ok={...input(),temporalReferenceRequired:true,examDate:"2021-05-23",references:[{id:"law",url:"https://www.gov.br/example",locator:"art. 1",excerpt:"Excerto",version:"2021-01",retrievedAt:"2026-11-01"}]};
 assert.deepEqual(thematicDecision(ok).reasons,[]);
});
test("snapshot inválido, rótulo genérico e referência sem rastreio são rejeitados",()=>{
 assert.throws(()=>validateThematic({...input(),references:[{url:"javascript:alert(1)"}]}));
 assert.throws(()=>validateThematic({...input(),module:"unknown"}));
 assert.throws(()=>validateThematic({...input(),stem:"x".repeat(24001)}));
 assert.throws(()=>validateThematic({...input(),proposed:{...input().proposed,theme:"Geral"}}));
});
test("o endpoint real exige usuário Master com MFA e responde por regras, sem chaves de IA",async()=>{
 const source=readFileSync(new URL("./index.ts",import.meta.url),"utf8");
 assert.doesNotMatch(source,/api\.openai\.com|api\.anthropic\.com|OPENAI_API_KEY|ANTHROPIC_API_KEY/);
 const code=stripTypeScriptTypes(source.replace(/^import .*;\s*$/gm,""));let handler:any,calls=0,master=true,valid=true;
 const admin={auth:{getUser:async()=>({data:{user:valid?{id:"actor"}:null},error:null})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:master?{user_id:"actor"}:null,error:null})})})})};
 const fakeEnv={SUPABASE_URL:"https://example.invalid",SUPABASE_SERVICE_ROLE_KEY:"test-fixture-only"};
 new Function("createClient","analyzePlanning","reviewThematic","buildDiagnosis","Deno",code)(()=>admin,()=>{},async()=>{calls++;return {sourceWrites:0};},()=>({}),{env:{get:(k:string)=>(fakeEnv as any)[k]},serve:(fn:any)=>handler=fn});
 const token=(aal:string)=>"header."+btoa(JSON.stringify({aal}))+".signature";
 const req=(t:string)=>new Request("https://example.invalid",{method:"POST",headers:{authorization:"Bearer "+t},body:JSON.stringify({action:"thematic_review",question:input()})});
 assert.equal((await handler(req("test-fixture-only"))).status,403);
 assert.equal((await handler(req(token("aal1")))).status,403);
 master=false;assert.equal((await handler(req(token("aal2")))).status,403);
 assert.equal(calls,0);master=true;valid=false;assert.equal((await handler(req(token("aal2")))).status,401);
 valid=true;assert.equal((await handler(req(token("aal2")))).status,200);assert.equal(calls,1);
});
