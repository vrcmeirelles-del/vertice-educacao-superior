// Real SQL function definitions captured read-only on 2026-11-16.
// Auth claims and memberships are fixtures, not a live authenticated session.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, before, after } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const functions = JSON.parse(readFileSync(new URL('./authorization-functions.snapshot.json', import.meta.url))).functions;
const institution = '00000000-0000-4000-8000-000000000011';
const other = '00000000-0000-4000-8000-000000000012';
const actor = '00000000-0000-4000-8000-000000000001';
const initial = { header_text: 'IES sintética', theme_color: '#333333', logo_data: null };
const changed = { ...initial, header_text: 'Cabeçalho de teste' };
const db = new PGlite();

before(async () => {
  await db.exec(`create role authenticated; create schema auth; create schema vertice_private;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('test.claims',true)::jsonb$$;
    create function vertice_private.member_role(target uuid) returns text language sql stable as $$
      select case when current_setting('test.membership',true)='master' or target='${institution}'::uuid then current_setting('test.membership',true) else null end$$;
    create table public.vertice_institutions(id uuid primary key, document_branding jsonb, updated_at timestamptz not null default now());`);
  for (const name of ['valid_document_branding', 'has_role', 'branding_version', 'save_document_branding']) {
    await db.exec(functions.find(f => f.name === name).definition);
  }
  await db.exec(`alter table public.vertice_institutions add constraint branding_valid check(vertice_private.valid_document_branding(document_branding));
    create trigger branding_version before update of document_branding on public.vertice_institutions for each row execute function vertice_private.branding_version();
    grant usage on schema vertice_private,auth to authenticated;
    revoke all on function vertice_private.save_document_branding(uuid,timestamptz,jsonb) from public;
    grant execute on function vertice_private.save_document_branding(uuid,timestamptz,jsonb) to authenticated;`);
  for (const id of [institution, other]) await db.query('insert into public.vertice_institutions(id,document_branding) values($1,$2)', [id, initial]);
});
after(async () => { await db.close(); });

async function claims({ role = 'master', aal = 'aal2', anonymous = false, user = actor } = {}) {
  await db.exec('reset role');
  for (const [key, value] of [['test.actor', user], ['test.claims', JSON.stringify({ aal, is_anonymous: anonymous })], ['test.membership', role]]) {
    await db.query('select set_config($1,$2,false)', [key, value]);
  }
}
async function revision(id = institution) {
  await db.exec('reset role'); return (await db.query('select updated_at::text as version from public.vertice_institutions where id=$1', [id])).rows[0].version;
}
async function save(id, expected, payload = changed) {
  await db.exec('set role authenticated');
  return db.query('select vertice_private.save_document_branding($1,$2,$3) as result', [id, expected, payload]);
}

test('Master with AAL2 saves a synthetic record and advances its revision', async () => {
  const before = await revision(); await claims();
  const result = (await save(institution, before)).rows[0].result;
  assert.equal(result.document_branding.header_text, changed.header_text);
  assert.notEqual(result.updated_at, before);
});
test('scoped gestor with AAL2 can save its institution', async () => {
  const expected = await revision(); await claims({ role: 'gestor' });
  assert.ok((await save(institution, expected)).rows[0].result.updated_at);
});
test('AAL1 is denied by the saved SQL guard', async () => {
  const expected = await revision(); await claims({ aal: 'aal1' });
  await assert.rejects(save(institution, expected), e => e.code === '42501');
});
test('anonymous and unauthenticated claims are denied', async () => {
  const expected = await revision();
  for (const c of [{ anonymous: true }, { user: '' }]) { await claims(c); await assert.rejects(save(institution, expected), e => e.code === '42501'); }
});
test('reader and gestor from another institution are denied', async () => {
  const expected = await revision(); await claims({ role: 'leitor' });
  await assert.rejects(save(institution, expected), e => e.code === '42501');
  const otherRevision = await revision(other); await claims({ role: 'gestor' });
  await assert.rejects(save(other, otherRevision), e => e.code === '42501');
});
test('missing and stale revisions are rejected instead of overwriting a record', async () => {
  await claims();
  for (const expected of [null, '2000-01-01T00:00:00Z']) await assert.rejects(save(institution, expected), e => e.code === '40001');
});
test('the database rejects an incompatible branding payload', async () => {
  const expected = await revision(); await claims();
  await assert.rejects(save(institution, expected, { ...initial, theme_color: 'red' }), e => e.code === '23514');
});
test('authenticated role cannot update the institution directly', async () => {
  await claims(); await db.exec('set role authenticated');
  await assert.rejects(db.query('update public.vertice_institutions set document_branding=$1 where id=$2', [initial, institution]), e => e.code === '42501');
});
