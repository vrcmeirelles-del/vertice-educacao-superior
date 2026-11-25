// Instrumentos, passo 4 (migração 20261125180000): acervos do Recredenciamento 2017 e do Novo Instrumento 2026
// no fluxo documental. PostgreSQL real (PGlite). A linha de base são as funções vigentes (migrações de origem):
// para o Reconhecimento e para vertice_documents nada pode mudar, inclusive a revisão de cache.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const root = new URL('../../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const mig = (name) => read((existsSync(new URL('supabase/migrations/' + name, root)) ? 'supabase/migrations/' : 'supabase/migrations_nao_aplicadas/') + name);
const I = '10000000-0000-4000-8000-000000000001', OTHER = '10000000-0000-4000-8000-000000000002';
const U = '40000000-0000-4000-8000-000000000001';
const R_REC = '50000000-0000-4000-8000-000000000001', R_R17 = '50000000-0000-4000-8000-000000000002', R_NI = '50000000-0000-4000-8000-000000000003';
const F_REC = '60000000-0000-4000-8000-000000000001', DOC = '60000000-0000-4000-8000-000000000009';
const fid = (n) => `60000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const text = 'Plano de Desenvolvimento Institucional com metas, indicadores e avaliação institucional do ciclo.';

async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;create schema vertice_private;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('role', coalesce(nullif(current_setting('test.role', true), ''), 'authenticated'), 'aal', 'aal2') $$;
  create table auth.users(id uuid primary key, email text); insert into auth.users values('${U}','gestor@exemplo.invalid');
  create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text, metadata jsonb, updated_at timestamptz default now());
  create table vertice_institutions(id uuid primary key, emec_code text, acronym text);
  insert into vertice_institutions values('${I}','4969','UNITOP'),('${OTHER}','9999','OTHER');
  create table vertice_admins(user_id uuid);
  create function vertice_private.has_role(target uuid, roles text[]) returns boolean language sql stable as $$ select true $$;
  create table vertice_documents(id uuid, institution_id uuid, storage_path text, file_name text);
  insert into vertice_documents values('${DOC}','${I}','doc.pdf','doc.pdf');
  insert into storage.objects(bucket_id,name,owner_id,metadata) values('vertice-documents','doc.pdf','${U}','{"size":10}');
  create table vertice_repository_requests(id uuid primary key, institution_id uuid not null, course_id uuid, title text, indicator text, repository_section text, active boolean default true, not_applicable boolean default false);
  insert into vertice_repository_requests(id,institution_id,title,indicator,repository_section) values
   ('${R_REC}','${I}','PPC','1.1','instrumento'),('${R_R17}','${I}','PDI','1.1','recredenciamento_2017'),('${R_NI}','${I}','PDI 2026','E1.1','novo_instrumento_2026_institucional');
  create table vertice_repository_files(id uuid primary key, institution_id uuid not null, request_id uuid not null, storage_path text, file_name text, size_bytes bigint, mime_type text,
   uploaded_by uuid, uploaded_email text, status text, review_note text, reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz, reference text, upload_note text,
   document_category text default 'nao_classificado', instrument_indicators text[] default '{}', classification_note text, classified_by uuid, classified_at timestamptz);`);
  const base = read('supabase/migrations/20261111170000_prevalidation_mirroring.sql');
  await db.exec(base.slice(0, base.indexOf('-- 5.')) + base.slice(base.indexOf('-- 6.'), base.indexOf('-- 7.')));
  await db.exec(read('supabase/migrations/20261117153003_enade360_official_reference_catalog.sql'));
  await db.exec(`create function vertice_private.can_read_institution(p uuid) returns boolean language sql stable as $$ select true $$;`);
  await db.exec(mig('20261125150000_instrumentos_catalogos.sql'));
  await db.exec(read('supabase/migrations/20261117113047_enade360_evidence_text_index.sql').split('create index')[0]);
  await db.exec(read('supabase/migrations/20261120154403_documentary_rules_reliability.sql'));
  // Arquivo do Reconhecimento já existente (antes da migração), como em produção.
  await db.exec(`insert into storage.objects(bucket_id,name,owner_id,metadata) values('vertice-repositorios','${I}/${R_REC}/${F_REC}.pdf','${U}','{"size":10}');
   insert into vertice_repository_files(id,institution_id,request_id,storage_path,file_name,size_bytes,status,document_category,instrument_indicators)
   values('${F_REC}','${I}','${R_REC}','${I}/${R_REC}/${F_REC}.pdf','ppc.pdf',10,'enviado','instrumento','{1.1}');`);
  return db;
}
const rev = async (db, table, id) => (await db.query(`select vertice_doc_rules_revision($1,$2,$3) r`, [I, table, id])).rows[0].r;
async function migrate(db) {
  await db.exec(mig('20261125180000_instrumentos_acervos.sql'));
  await db.exec(`create trigger vertice_repo_files_classification before insert or update on vertice_repository_files for each row execute function vertice_private.check_repository_classification();
   create trigger vertice_repo_files_sync_classification after update on vertice_repository_files for each row execute function vertice_private.sync_repository_classification();
   create trigger vertice_repo_files_validate before insert or update on vertice_repository_files for each row execute function vertice_private.check_repository_file();`);
}
async function upload(db, request, n, bucket) {
  const path = `${I}/${request}/${fid(n)}.pdf`;
  await db.query(`insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,'{"size":10}')`, [bucket, path, U]);
  await db.exec(`select set_config('test.uid','${U}',false)`);
  try {
    await db.query(`insert into vertice_repository_files(id,institution_id,request_id,storage_path,file_name,size_bytes,status) values($1,$2,$3,$4,'x.pdf',10,'enviado')`, [fid(n), I, request, path]);
  } finally { await db.exec(`select set_config('test.uid','',false)`); }
  return fid(n);
}

test('Reconhecimento e documentos gerais: revisão de cache idêntica antes e depois', async () => {
  const db = await setup();
  try {
    const before = [await rev(db, 'vertice_repository_files', F_REC), await rev(db, 'vertice_documents', DOC)];
    await migrate(db);
    assert.deepEqual([await rev(db, 'vertice_repository_files', F_REC), await rev(db, 'vertice_documents', DOC)], before);
    const scope = async (t, id) => (await db.query('select vertice_doc_source_scope($1,$2,$3) s', [I, t, id])).rows[0].s;
    assert.deepEqual(await scope('vertice_repository_files', F_REC), {bucket: 'vertice-repositorios', catalog_code: null, catalog_version: null});
    assert.deepEqual(await scope('vertice_documents', DOC), {bucket: 'vertice-documents', catalog_code: null, catalog_version: null});
    await assert.rejects(() => db.query('select vertice_doc_source_scope($1,$2,$3)', [OTHER, 'vertice_repository_files', F_REC]), /source_not_found/);
  } finally { await db.close(); }
});

test('envio ao acervo do Recredenciamento e do Novo Instrumento passa a ser registrado; arquivo em acervo errado, não', async () => {
  const db = await setup();
  try {
    await migrate(db);
    await upload(db, R_R17, 11, 'vertice-recredenciamento-2017');
    await upload(db, R_NI, 12, 'vertice-novo-instrumento-2026-institucional');
    await upload(db, R_REC, 13, 'vertice-repositorios');
    await assert.rejects(() => upload(db, R_R17, 14, 'vertice-repositorios'), /arquivo não enviado por esta conta/);
    await assert.rejects(() => upload(db, R_REC, 15, 'vertice-recredenciamento-2017'), /arquivo não enviado por esta conta/);
  } finally { await db.close(); }
});

test('classificação pelo catálogo do acervo e seção preservada', async () => {
  const db = await setup();
  try {
    await migrate(db);
    const f17 = await upload(db, R_R17, 21, 'vertice-recredenciamento-2017');
    const classify = (id, codes) => db.query(`update vertice_repository_files set document_category='instrumento', instrument_indicators=$2 where id=$1`, [id, codes]);
    await classify(f17, ['4.8']); // indicador do eixo 4 do Recredenciamento (não existe no Reconhecimento)
    await assert.rejects(() => classify(f17, ['4.12']), /indicador fora do instrumento/); // eixo 4 vai até 4.8
    await assert.rejects(() => classify(f17, ['9.9']), /indicador fora do instrumento/);
    const [req] = (await db.query(`select repository_section, indicator from vertice_repository_requests where id=$1`, [R_R17])).rows;
    assert.deepEqual(req, {repository_section: 'recredenciamento_2017', indicator: '1.1'}, 'classificar não tira a solicitação do acervo');
    const fni = await upload(db, R_NI, 22, 'vertice-novo-instrumento-2026-institucional');
    await classify(fni, ['E1.1']);
    await assert.rejects(() => classify(fni, ['1.1']), /indicador fora do instrumento/);
    // Reconhecimento: regra de antes (1.x a 3.x, limites 24/16/18) e seção sincronizada como antes.
    await assert.rejects(() => classify(F_REC, ['1.25']), /indicador fora do instrumento/);
    await assert.rejects(() => classify(F_REC, ['E1.1']), /indicador inválido/);
    await classify(F_REC, ['1.2']);
    assert.equal((await db.query(`select indicator from vertice_repository_requests where id=$1`, [R_REC])).rows[0].indicator, '1.2');
  } finally { await db.close(); }
});

test('pré-validação: vínculo só com o catálogo do acervo do arquivo', async () => {
  const db = await setup();
  try {
    await migrate(db);
    const f17 = await upload(db, R_R17, 31, 'vertice-recredenciamento-2017');
    const run = async (file, link) => {
      const c = (await db.query(`select vertice_doc_claim_rules($1,'vertice_repository_files',$2,$3,'analyze','regras-test') j`, [I, file, U])).rows[0].j;
      assert.equal(c.status, 'claimed');
      await db.query(`update vertice_doc_prevalidation set source_sha256=repeat('a',64),extraction_status='ready',extracted_pages=$2 where id=$1`, [c.prevalidation_id, JSON.stringify([{page: 1, section: null, text}])]);
      return db.query('select vertice_doc_finish_rules($1,$2,$3) j', [c.prevalidation_id, JSON.stringify({summary: 's', nature: 'n'}), JSON.stringify([link])]);
    };
    const link = (code, version, object) => ({instrument_code: code, instrument_version: version, object_code: object, dimension: '1', compatibility: 'alta', justification: 'Trecho literal',
      evidence_excerpts: [{page: 1, text: text.slice(0, 60)}]});
    assert.equal((await run(f17, link('recredenciamento_institucional', '2017', '1.1'))).rows[0].j.links_created, 1);
    const f17b = await upload(db, R_R17, 32, 'vertice-recredenciamento-2017');
    await assert.rejects(() => run(f17b, link('reconhecimento_curso', '2017', '1.1')), /unknown_indicator/);
    await assert.rejects(() => run(F_REC, link('recredenciamento_institucional', '2017', '1.1')), /unknown_indicator/, 'Reconhecimento segue só com os catálogos ativos');
    assert.equal((await run(await upload(db, R_REC, 33, 'vertice-repositorios'), link('reconhecimento_curso', '2017', '1.1'))).rows[0].j.links_created, 1);
  } finally { await db.close(); }
});
