import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const root=new URL('../../../',import.meta.url);
const reference=JSON.parse(readFileSync(new URL('docs/enade-360/fontes/iacg2017-reconhecimento-catalog.json',root),'utf8'));
const migration=readFileSync(new URL('supabase/migrations/'+readdirSync(new URL('supabase/migrations/',root)).find(n=>n.endsWith('_enade360_official_reference_catalog.sql')),root),'utf8');
test('received reference seeds exact codes/pages once, preserving other institutions and classifications',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create table vertice_institutions(id uuid primary key default gen_random_uuid(),emec_code text,acronym text);
   insert into vertice_institutions(emec_code,acronym) values('4969','UNITOP'),('9999','OTHER');
   create table classifications(label text);insert into classifications values('preserved');`);
  const original=readFileSync(new URL('supabase/migrations/20261111170000_prevalidation_mirroring.sql',root),'utf8').split('-- 3.')[0];
  await db.exec(original);
  await db.exec(migration);await db.exec(migration);
  const catalogs=(await db.query('select * from vertice_instrument_catalog')).rows;
  assert.equal(catalogs.length,1);assert.equal(catalogs[0].scope,'curso');assert.equal(catalogs[0].instrument_version,'2017');
  assert.deepEqual(catalogs[0].source_provenance,reference.source_provenance);
  assert.equal(catalogs[0].source_provenance.canonical_binary_equality_verified,false);
  const objects=(await db.query('select object_code,dimension,object_label,description,source_pdf_page,criteria from vertice_instrument_objects')).rows;
  assert.equal(objects.length,58);assert.equal(new Set(objects.map(o=>o.object_code)).size,58);
  for(const o of reference.objects){const actual=objects.find(x=>x.object_code===o.object_code);assert.deepEqual(actual,{...o,criteria:null});}
  assert.equal((await db.query('select label from classifications')).rows[0].label,'preserved');
  assert.doesNotMatch(migration,/\b(?:grant|revoke|create policy|alter policy|drop policy|security definer)\b/i);
 }finally{await db.close();}
});
