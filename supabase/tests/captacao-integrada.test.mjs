// Isolated PostgreSQL/WASM. No remote database, provider, or credentials.
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const root = new URL('../../', import.meta.url);
const sql = path => readFileSync(new URL(path, root), 'utf8');
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users(id uuid primary key,email text);
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
  grant usage on schema auth to authenticated; grant execute on all functions in schema auth to authenticated;`);
  await db.exec(sql('supabase/migrations/202610260001_access_foundation.sql'));
  // Only dependencies used by this module: actual repository helpers, not guessed ACL.
  function getFunction(file, name) {
    const source = sql(file), start = source.indexOf('create or replace function ' + name + '(');
    assert(start >= 0, `missing dependency ${name}`);
    const end = source.indexOf('$$;', start); assert(end >= 0);
    return source.slice(start, end + 3);
  }
  await db.exec(`alter table public.vertice_institutions add column status text not null default 'ativa';
  alter table public.vertice_memberships drop constraint vertice_memberships_role_check;`);
  for (const [file, name] of [
    ['202610300001_area_real.sql','vertice_private.member_role'],
    ['202610300001_area_real.sql','vertice_private.has_role'],
  ]) await db.exec(getFunction('supabase/migrations/' + file, name));
  const files = readdirSync(new URL('supabase/migrations/', root)).filter(name => name.endsWith('_captacao_integrada_preparacao.sql'));
  assert.equal(files.length, 1);
  await db.exec(sql('supabase/migrations/' + files[0]));
  await db.exec(sql('supabase/tests/captacao_integrada.sql'));
  console.log('PASS PostgreSQL/PGlite: MFA, roles, tenant/FK isolation, CAS, duplicate IDs, validation, audit and forged facts.');
} finally { await db.close(); }
