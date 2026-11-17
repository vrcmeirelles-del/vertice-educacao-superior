import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../../",import.meta.url);
const ledger=JSON.parse(readFileSync(new URL("docs/enamed/ENAMED_360_REGISTRO_GATES_PUBLICACAO.json",root),"utf8"));
test("preliminary audit completion does not silently grant release approval",()=>{
 assert.equal(ledger.preliminary_audit.status,"COMPLETE");
 assert.equal(ledger.release_status,"BLOCKED");
 assert.ok(Object.keys(ledger.conditions).length>=6);
 for(const [name,gate] of Object.entries(ledger.conditions)){
   assert.equal(gate.approved,false,name+" cannot be approved without evidence");
   assert.ok(typeof gate.reason==="string"&&gate.reason.length>=15);
 }
});
test("all production-affecting actions remain explicitly blocked",()=>{
 for(const action of ["bulk_taxonomy_update","question_merge_or_delete","merge_pr_168","deploy_to_production"]){
   assert.ok(ledger.prohibited_until_approval.includes(action));
 }
});
