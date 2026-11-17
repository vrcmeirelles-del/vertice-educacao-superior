import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../../",import.meta.url);
const ledger=JSON.parse(readFileSync(new URL("docs/enamed/ENAMED_360_REGISTRO_GATES_PUBLICACAO.json",root),"utf8"));
const gates=Object.entries(ledger.conditions);
test("preliminary audit completion never automatically releases the product",()=>{
  assert.equal(ledger.preliminary_audit.status,"COMPLETE");
  assert.ok(gates.length>=6);
  const allApproved=gates.every(([name,gate])=>{
    assert.equal(typeof gate.approved,"boolean",name);
    if(!gate.approved){
      assert.ok(typeof gate.reason==="string"&&gate.reason.length>=15,name+" requires blocker explanation");
      return false;
    }
    assert.ok(Array.isArray(gate.evidence)&&gate.evidence.length>0,name+" requires verifiable evidence");
    assert.ok(gate.evidence.every(x=>typeof x==="string"&&x.length>=12),name+" evidence links invalid");
    assert.ok(typeof gate.reviewer==="string"&&gate.reviewer.trim().length>=3,name+" requires actual reviewer");
    assert.ok(/^\d{4}-\d{2}-\d{2}/.test(gate.approved_at||""),name+" requires approval timestamp");
    return true;
  });
  if(allApproved) assert.equal(ledger.release_status,"APPROVED");
  else assert.equal(ledger.release_status,"BLOCKED");
});
test("production-affecting operations stay forbidden while any release gate is unapproved",()=>{
  const allApproved=gates.every(([,gate])=>gate.approved);
  if(allApproved)return;
  for(const action of ["bulk_taxonomy_update","question_merge_or_delete","merge_pr_168","deploy_to_production"]){
    assert.ok(ledger.prohibited_until_approval.includes(action));
  }
});
