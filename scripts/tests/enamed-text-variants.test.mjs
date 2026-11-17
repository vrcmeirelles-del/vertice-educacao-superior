import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../../",import.meta.url);
const read=(path)=>JSON.parse(readFileSync(new URL(path,root),"utf8"));
const triage=read("docs/enamed/ENAMED_2026_TRIAGEM_22_VARIANTES_TEXTUAIS_C2.json");
const pages=read("docs/enamed/ENAMED_2026_LOCALIZADOR_PAGINAS_400_QUESTOES.json").pages_by_booklet;
const permutations=read("docs/enamed/ENAMED_2026_MAPA_PERMUTACOES_CADERNOS_DRAFT.json").maps;
test("22 priority issues have accurate official-page and equivalent-booklet anchors",()=>{
  assert.equal(triage.records.length,22);
  assert.equal(new Set(triage.records.map(x=>x.question_number)).size,22);
  for(const row of triage.records){
    assert.ok(row.question_number>=1&&row.question_number<=100);
    assert.equal(row.equivalent_regular_caderno_1_number,permutations.regular_c2_to_c1[row.question_number-1]);
    assert.equal(row.official_caderno_2_pdf_page,pages["REG-C2"][row.question_number-1]);
    assert.equal(row.database_update_allowed,false);
    assert.equal(row.clinical_judgment_status,"NOT_PERFORMED");
    assert.equal(row.existing_ids.length,2);
  }
});
test("image-dependent examples cannot be approved by textual prefix or preliminary gabarito",()=>{
  for(const n of [12,81,82]){
    const record=triage.records.find(r=>r.question_number===n);
    assert.ok(record);
    assert.match(record.review_priority,/IMAGE|EVIDENCE/);
    assert.equal(record.official_text_comparison_status,"PRELIMINARY_PAGE_INSPECTION_NOT_FULL_ITEM_HOMOLOGATION");
  }
});
