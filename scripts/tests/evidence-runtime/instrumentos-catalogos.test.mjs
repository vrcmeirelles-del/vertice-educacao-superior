// Catálogos de Recredenciamento 2017 e Novo Instrumento 2026 e equivalência 2017→2026 (migração 20261125150000).
// PostgreSQL real (PGlite) com as migrações de origem: confere carga, integridade, permissões e que a
// pré-validação homologada não muda (os catálogos novos entram inativos e a revisão de cache é a mesma).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';

const root = new URL('../../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const NAME = '20261125150000_instrumentos_catalogos.sql';
const MIG = existsSync(new URL('supabase/migrations/' + NAME, root)) ? 'supabase/migrations/' + NAME : 'supabase/migrations_nao_aplicadas/' + NAME;
const UNITOP = '10000000-0000-4000-8000-000000000001', OTHER = '10000000-0000-4000-8000-000000000002';
const DOC = '20000000-0000-4000-8000-000000000001';
const recred = JSON.parse(read('source-overrides/client/src/lib/avaliacao-institucional.json'));

async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema storage;create schema vertice_private;
  create table storage.objects(bucket_id text,name text,updated_at timestamptz,metadata jsonb);
  create table vertice_institutions(id uuid primary key,emec_code text,acronym text);
  insert into vertice_institutions values('${UNITOP}','4969','UNITOP'),('${OTHER}','9999','OTHER');
  create table vertice_documents(id uuid,institution_id uuid,storage_path text,file_name text);
  create table vertice_repository_files(id uuid,institution_id uuid,storage_path text,file_name text);
  insert into vertice_documents values('${DOC}','${UNITOP}','a.pdf','a.pdf');
  create function vertice_private.can_read_institution(p uuid) returns boolean language sql stable as $$ select p::text = current_setting('test.inst', true) $$;
  grant usage on schema vertice_private to authenticated;grant execute on function vertice_private.can_read_institution(uuid) to authenticated;`);
  const base = read('supabase/migrations/20261111170000_prevalidation_mirroring.sql');
  await db.exec(base.slice(0, base.indexOf('-- 5.')) + base.slice(base.indexOf('-- 6.'), base.indexOf('-- 7.')));
  await db.exec(read('supabase/migrations/20261117153003_enade360_official_reference_catalog.sql'));
  await db.exec(read('supabase/migrations/20261117113047_enade360_evidence_text_index.sql').split('create index')[0]);
  await db.exec(read('supabase/migrations/20261120154403_documentary_rules_reliability.sql'));
  return db;
}
const rev = async (db) => (await db.query(`select vertice_doc_rules_revision($1,'vertice_documents',$2) r`, [UNITOP, DOC])).rows[0].r;
const rows = async (db, sql, p) => (await db.query(sql, p)).rows;

test('a migração está em dia com os catálogos do portal (gerador --check)', () => {
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/instrumentos/gerar-catalogos.mjs', '--check'], {cwd: root, encoding: 'utf8'});
  assert.match(out, /ok/);
});

test('carga completa, inativa para a pré-validação e sem mudar a revisão de cache homologada', async () => {
  const db = await setup();
  try {
    const before = await rev(db);
    await db.exec(read(MIG));
    assert.equal(await rev(db), before, 'catálogo inativo não pode alterar a revisão da pré-validação');
    const cats = await rows(db, `select instrument_code,instrument_version,is_active,scope,source_provenance p,structure s,(select count(*)::int from vertice_instrument_objects o where o.catalog_id=c.id) n from vertice_instrument_catalog c order by 1`);
    assert.deepEqual(cats.map((c) => [c.instrument_code, c.instrument_version, c.is_active, c.scope, c.n]), [
      ['novo_instrumento_2026_curso', '2026-proposta', false, 'curso', 38],
      ['novo_instrumento_2026_institucional', '2026-proposta', false, 'instituicao', 26],
      ['reconhecimento_curso', '2017', true, 'curso', 58],
      ['recredenciamento_institucional', '2017', false, 'instituicao', 50]]);
    for (const c of cats.filter((x) => x.instrument_code !== 'reconhecimento_curso')) {
      assert.equal(c.p.official_text_verified, false);
      assert.match(c.p.sha256_source_file, /^[0-9a-f]{64}$/);
    }
    assert.ok(cats.filter((c) => c.instrument_code.startsWith('novo_')).every((c) => c.p.status === 'provisorio'));
    const rc = cats.find((c) => c.instrument_code === 'recredenciamento_institucional');
    assert.deepEqual(rc.s.dimensions, recred.axes);
    assert.equal(rc.s.dimensions.reduce((s, a) => s + a.weight, 0), 100);
    const objs = await rows(db, `select o.object_code,o.dimension,o.object_label,o.reference r from vertice_instrument_objects o join vertice_instrument_catalog c on c.id=o.catalog_id where c.instrument_code='recredenciamento_institucional'`);
    for (const i of recred.indicators) {
      const o = objs.find((x) => x.object_code === i.code);
      assert.equal(o.object_label, i.title);
      assert.equal(o.dimension, String(i.axis));
      assert.deepEqual(o.r.concept_descriptors, i.criteria);
      assert.deepEqual(o.r.evidence, {obrigatoria: i.obrig, complementar: i.compl, resultado: i.resultado});
    }
    const d4 = await rows(db, `select o.reference r from vertice_instrument_objects o join vertice_instrument_catalog c on c.id=o.catalog_id where c.instrument_code='novo_instrumento_2026_curso' and o.object_code='4.1'`);
    assert.match(d4[0].r.variants.direito.title, /Núcleo de Prática Jurídica/);
    const eq = await rows(db, `select degree,count(*)::int n from vertice_instrument_equivalences group by 1 order by 1`);
    assert.equal(eq.reduce((s, x) => s + x.n, 0), 51);
    assert.equal((await rows(db, `select count(*)::int n from vertice_instrument_catalog where institution_id=$1`, [OTHER]))[0].n, 0);
  } finally { await db.close(); }
});

test('equivalência só entre indicadores existentes e da mesma instituição', async () => {
  const db = await setup();
  try {
    await db.exec(read(MIG));
    const [src] = await rows(db, `select id from vertice_instrument_catalog where instrument_code='reconhecimento_curso'`);
    const [dst] = await rows(db, `select id from vertice_instrument_catalog where instrument_code='novo_instrumento_2026_curso'`);
    const ins = (inst, s, sc, t, tc) => db.query(`insert into vertice_instrument_equivalences(institution_id,source_catalog_id,source_code,target_catalog_id,target_code,degree) values($1,$2,$3,$4,$5,'direto')`, [inst, s, sc, t, tc]);
    await assert.rejects(() => ins(UNITOP, src.id, '9.9', dst.id, '1.1'), /foreign key/);
    await assert.rejects(() => ins(UNITOP, src.id, '1.1', dst.id, '9.9'), /foreign key/);
    await assert.rejects(() => ins(OTHER, src.id, '1.1', dst.id, '3.9'), /foreign key/);
    await ins(UNITOP, src.id, '1.1', dst.id, '3.9'); // par novo e válido é aceito
    await assert.rejects(() => ins(UNITOP, src.id, '1.1', src.id, '1.2'), /check/);
  } finally { await db.close(); }
});

test('leitura da equivalência só pela própria instituição; anon e escrita direta recusadas', async () => {
  const db = await setup();
  try {
    await db.exec(read(MIG));
    await db.exec(`grant usage on schema public to authenticated, anon;`);
    const as = async (role, inst, sql) => {
      await db.exec(`set role ${role}; select set_config('test.inst', '${inst}', false);`);
      try { return (await db.query(sql)).rows; } finally { await db.exec('reset role'); }
    };
    assert.equal((await as('authenticated', UNITOP, 'select count(*)::int n from vertice_instrument_equivalences'))[0].n, 51);
    assert.equal((await as('authenticated', OTHER, 'select count(*)::int n from vertice_instrument_equivalences'))[0].n, 0);
    await assert.rejects(() => as('anon', UNITOP, 'select 1 from vertice_instrument_equivalences'), /permission denied/);
    await assert.rejects(() => as('authenticated', UNITOP, `delete from vertice_instrument_equivalences`), /permission denied/);
  } finally { await db.close(); }
});
