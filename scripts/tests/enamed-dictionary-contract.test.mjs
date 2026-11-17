import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../../",import.meta.url);
const read=path=>readFileSync(new URL(path,root),"utf8");
const dictionary=JSON.parse(read("docs/enamed/DICIONARIO_COMPETENCIAS_478_2025_DRAFT.json"));
const queue=read("docs/enamed/FILA_REVISAO_483_ENAMED_2026.csv").trim().split("\n");

test("draft contains all official dimension slots, without claiming approval",()=>{
 assert.equal(dictionary.areas.length,7);
 assert.equal(dictionary.competencies.length,15);
 assert.equal(dictionary.contexts.length,6);
 assert.equal(dictionary.content_codes.length,21);
 assert.equal(dictionary.status,"review_required");
 assert.deepEqual(dictionary.competencies.map(x=>x.code),["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV"]);
 assert.match(dictionary.competencies[5].summary,/procedimentos médicos/);
 assert.match(dictionary.competencies[6].summary,/intervenção coletiva/);
 assert.ok(dictionary.content_codes.every(x=>x.label&&x.status==="pending_clinical_approval"));
});
test("queue preserves 483 identifiers, excludes personal and full clinical text",()=>{
 assert.equal(queue.length-2,483);
 assert.match(queue[1],/item_id/);
 assert.match(queue[1],/review_state/);
 assert.doesNotMatch(queue[1],/student|cpf|stem|answer_key|alternatives/);
 const ids=queue.slice(2).map(line=>line.match(/^"((?:[^"]|"")*)"/)?.[1]);
 assert.equal(new Set(ids).size,483);
 assert.ok(queue.slice(2).every(line=>line.includes("REQUIRES_SOURCE_AND_MEDICAL_REVIEW")));
});
