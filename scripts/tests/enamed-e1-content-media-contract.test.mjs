import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../../",import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),"utf8"));
const variants=read("docs/enamed/E1_22_VARIANTES_COMPARACAO_INTEGRAL_ENTRE_COPIAS.json");
const media=read("docs/enamed/E1_ENAMED_22_MIDIAS_PDF_HASH_E_PAGINA.json");
const maps=read("docs/enamed/ENAMED_2026_MAPA_PERMUTACOES_CADERNOS_DRAFT.json").maps;
const pages=read("docs/enamed/ENAMED_2026_LOCALIZADOR_PAGINAS_400_QUESTOES.json").pages_by_booklet;
test("every one of 22 full stored-stem comparison records remains blocked",()=>{
 assert.equal(variants.records.length,22);
 assert.equal(new Set(variants.records.map(r=>r.item_number)).size,22);
 assert.equal(variants.numeric_differences,variants.records.filter(r=>r.numeric_difference_detected).length);
 assert.equal(variants.numeric_differences,8);
 for(const r of variants.records){
  assert.equal(r.production_write_permitted,false);
  assert.equal(r.approval_status,"NOT_HOMOLOGATED");
  assert.equal(r.alternatives_equal_after_whitespace,true);
  assert.equal(r.official_pdf_page,pages["REG-C2"][r.item_number-1]);
 }
});
test("six actual embedded PDF images have hashes, xrefs and exact source page mapping",()=>{
 assert.equal(media.records.length,6);
 assert.deepEqual(media.records.map(r=>r.question_number).sort((a,b)=>a-b),[12,68,81,82,89,97]);
 for(const r of media.records){
   assert.match(r.source_asset_sha256,/^[0-9a-f]{64}$/);
   assert.ok(r.source_asset_bytes>1000&&r.pdf_image_xref>0);
   assert.equal(r.physical_page,pages["REG-C2"][r.question_number-1]);
   assert.equal(r.source_asset_sha256.length,64);
   assert.equal(r.binary_embedded_in_repo,false);
   assert.equal(r.approval,"REQUIRES_SOURCE_CROP_CONTENT_VALIDATION_AND_LICENSE_REVIEW");
   assert.ok(maps.regular_c2_to_c1[r.question_number-1]>=1);
 }
});
test("source media and full comparison cannot be mistaken for clinical publication approvals",()=>{
 assert.match(media.source_status,/NOT_LINKED_TO_STUDENT_QUESTION/);
 assert.ok(media.not_a_claim.includes("not prove absence"));
 assert.ok(variants.records.every(x=>x.mandatory_review.includes("FULL_PDF")));
});
