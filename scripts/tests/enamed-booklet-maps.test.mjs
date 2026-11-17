import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../../",import.meta.url);
const read=(name)=>JSON.parse(readFileSync(new URL(name,root),"utf8"));
const maps=read("docs/enamed/ENAMED_2026_MAPA_PERMUTACOES_CADERNOS_DRAFT.json");
const pages=read("docs/enamed/ENAMED_2026_LOCALIZADOR_PAGINAS_400_QUESTOES.json");

test("regular and reapplication permutations are bijections of 1..100",()=>{
  for(const type of ["regular_c2_to_c1","reaplicacao_c2_to_c1"]){
    const p=maps.maps[type];
    assert.equal(p.length,100);
    assert.deepEqual([...p].sort((a,b)=>a-b),Array.from({length:100},(_,i)=>i+1));
  }
  assert.equal(maps.type,"EDITORIAL_CANDIDATE_NEEDS_FULL_BODY_AND_ALTERNATIVES_VALIDATION");
});
test("all four official booklets have 100 physical PDF page anchors",()=>{
  for(const id of ["REG-C1","REG-C2","REAP-C1","REAP-C2"]){
    const a=pages.pages_by_booklet[id];
    assert.equal(a.length,100);
    assert.ok(a.every(n=>Number.isInteger(n)&&n>=3&&n<=26));
    assert.ok(a.every((n,i)=>i===0||n>=a[i-1]));
  }
  assert.match(pages.status,/EXTRACTED_PAGE_START_ONLY/);
});
