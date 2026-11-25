// Instrumentos, passo 2 (migração 20261125160000): avaliação simulada com chaves e escrita restrita a gestão;
// conceito por eixo do Recredenciamento 2017 gravado. PostgreSQL real (PGlite) com as funções de permissão
// reais das migrações de origem (is_master, can_read_institution, instrumento_can_record).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const root = new URL('../../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const mig = (name) => read((existsSync(new URL('supabase/migrations/' + name, root)) ? 'supabase/migrations/' : 'supabase/migrations_nao_aplicadas/') + name);
const fn = (file, name) => {
  const src = read(file), start = src.indexOf('create or replace function vertice_private.' + name);
  return src.slice(start, src.indexOf('$$;', src.indexOf('$$', src.indexOf(' as $$', start) + 6)) + 3);
};
const UNITOP = '10000000-0000-4000-8000-000000000001', OTHER = '10000000-0000-4000-8000-000000000002';
const C1 = '30000000-0000-4000-8000-000000000001', C_OTHER = '30000000-0000-4000-8000-000000000002';
const GESTOR = '40000000-0000-4000-8000-000000000001', LEITOR = '40000000-0000-4000-8000-000000000002', OUTRA = '40000000-0000-4000-8000-000000000003';

async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema vertice_private;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal', coalesce(nullif(current_setting('test.aal', true), ''), 'aal1')) $$;
  grant usage on schema auth, vertice_private, public to authenticated, anon;
  grant execute on all functions in schema auth to authenticated;
  create table vertice_institutions(id uuid primary key,emec_code text,acronym text);
  insert into vertice_institutions values('${UNITOP}','4969','UNITOP'),('${OTHER}','9999','OTHER');
  create table vertice_courses(id uuid primary key,institution_id uuid not null);
  create unique index vertice_courses_scope_key on vertice_courses(id,institution_id);
  insert into vertice_courses values('${C1}','${UNITOP}'),('${C_OTHER}','${OTHER}');
  create table vertice_admins(user_id uuid);
  create table vertice_memberships(user_id uuid,institution_id uuid,role text);
  insert into vertice_memberships values('${GESTOR}','${UNITOP}','gestor'),('${LEITOR}','${UNITOP}','leitor'),('${OUTRA}','${OTHER}','gestor');
  create schema storage;create table storage.objects(bucket_id text,name text,updated_at timestamptz,metadata jsonb);
  create table vertice_documents(id uuid,institution_id uuid,storage_path text,file_name text);
  create table vertice_repository_files(id uuid,institution_id uuid,storage_path text,file_name text);`);
  await db.exec(fn('supabase/migrations/202610260001_access_foundation.sql', 'is_master'));
  await db.exec(fn('supabase/migrations/202610260001_access_foundation.sql', 'can_read_institution'));
  await db.exec(fn('supabase/migrations/novo_instrumento.sql', 'instrumento_can_record'));
  await db.exec(`grant execute on all functions in schema vertice_private to authenticated;`);
  // Estado de produção antes da migração: tabela sem chaves e com as políticas antigas (escrita por quem lê).
  await db.exec(`create table vertice_avaliacao_simulada(id uuid primary key default gen_random_uuid(),institution_id uuid not null,course_id uuid not null,
   indicador text not null,dimensao smallint not null,conceito_atual smallint check(conceito_atual>=1 and conceito_atual<=5),conceito_viavel smallint check(conceito_viavel>=1 and conceito_viavel<=5),
   parecer text default '',lacunas text default '',plano_nde text default '',perguntas_comissao text default '',updated_by uuid,updated_at timestamptz default now(),created_at timestamptz default now(),
   unique(institution_id,course_id,indicador));
   alter table vertice_avaliacao_simulada enable row level security;
   create policy avs_insert on vertice_avaliacao_simulada for insert to authenticated with check(vertice_private.is_master() or vertice_private.can_read_institution(institution_id));
   grant all on vertice_avaliacao_simulada to anon, authenticated;
   insert into vertice_avaliacao_simulada(institution_id,course_id,indicador,dimensao,conceito_atual) values('${UNITOP}','${C1}','1.1',1,3);`);
  const base = read('supabase/migrations/20261111170000_prevalidation_mirroring.sql');
  await db.exec(base.slice(0, base.indexOf('-- 5.')) + base.slice(base.indexOf('-- 6.'), base.indexOf('-- 7.')));
  await db.exec(read('supabase/migrations/20261117153003_enade360_official_reference_catalog.sql'));
  await db.exec(mig('20261125150000_instrumentos_catalogos.sql'));
  await db.exec(mig('20261125160000_avaliacao_registros.sql'));
  return db;
}
async function as(db, user, sql, params = []) {
  await db.exec(`select set_config('test.uid','${user}',false), set_config('test.aal','aal2',false); set role authenticated;`);
  try { return (await db.query(sql, params)).rows; } finally { await db.exec(`reset role; select set_config('test.uid','',false);`); }
}

test('avaliação simulada: registro existente preservado; curso de outra IES recusado', async () => {
  const db = await setup();
  try {
    assert.equal((await db.query('select count(*)::int n from vertice_avaliacao_simulada')).rows[0].n, 1);
    await assert.rejects(() => db.query(`insert into vertice_avaliacao_simulada(institution_id,course_id,indicador,dimensao) values($1,$2,'1.2',1)`, [UNITOP, C_OTHER]), /foreign key/);
  } finally { await db.close(); }
});

test('avaliação simulada: gestor grava com autor registrado; leitor e outra IES não gravam', async () => {
  const db = await setup();
  try {
    const ins = `insert into vertice_avaliacao_simulada(institution_id,course_id,indicador,dimensao,conceito_atual,updated_by) values('${UNITOP}','${C1}',$1,1,4,'${LEITOR}') returning updated_by`;
    const [row] = await as(db, GESTOR, ins, ['1.3']);
    assert.equal(row.updated_by, GESTOR, 'o autor vem da sessão, não do que o cliente envia');
    await assert.rejects(() => as(db, LEITOR, ins, ['1.4']), /row-level security/);
    await assert.rejects(() => as(db, OUTRA, ins, ['1.5']), /row-level security/);
    assert.equal((await as(db, LEITOR, 'select count(*)::int n from vertice_avaliacao_simulada'))[0].n, 2, 'leitor continua lendo');
    assert.equal((await as(db, OUTRA, 'select count(*)::int n from vertice_avaliacao_simulada'))[0].n, 0);
    const [mov] = await as(db, GESTOR, `update vertice_avaliacao_simulada set course_id='${C_OTHER}', conceito_atual=5 where indicador='1.3' returning course_id, conceito_atual`);
    assert.deepEqual(mov, {course_id: C1, conceito_atual: 5}, 'alteração não muda curso nem indicador');
    await assert.rejects(() => as(db, GESTOR, `delete from vertice_avaliacao_simulada where indicador='1.3'`).then((r) => { if (!r.length) throw Error('row-level security: nada apagado'); }), /row-level security/);
    await db.exec('set role anon');
    await assert.rejects(() => db.query('select 1 from vertice_avaliacao_simulada'), /permission denied/);
    await db.exec('reset role');
  } finally { await db.close(); }
});

test('conceito por eixo do Recredenciamento: grava, valida o eixo e isola a instituição', async () => {
  const db = await setup();
  try {
    const [{id: cat}] = (await db.query(`select id from vertice_instrument_catalog where instrument_code='recredenciamento_institucional'`)).rows;
    const [{id: curso}] = (await db.query(`select id from vertice_instrument_catalog where instrument_code='reconhecimento_curso'`)).rows;
    const up = (axis, c, catalog = cat, inst = UNITOP) => `insert into vertice_avaliacao_institucional_eixos(institution_id,catalog_id,axis_code,conceito) values('${inst}','${catalog}',${axis},${c})
      on conflict(institution_id,catalog_id,axis_code) do update set conceito=excluded.conceito returning conceito, updated_by`;
    assert.deepEqual((await as(db, GESTOR, up(2, 4)))[0], {conceito: 4, updated_by: GESTOR});
    assert.deepEqual((await as(db, GESTOR, up(2, 'null')))[0], {conceito: null, updated_by: GESTOR}, 'sem nota volta a nulo');
    await assert.rejects(() => as(db, GESTOR, up(6, 3)), /eixo inexistente/);
    await assert.rejects(() => as(db, GESTOR, up(1, 3, curso)), /eixo inexistente/, 'catálogo de curso não recebe nota de eixo');
    await assert.rejects(() => as(db, GESTOR, up(1, 6)), /check/);
    await assert.rejects(() => as(db, LEITOR, up(1, 3)), /row-level security/);
    await assert.rejects(() => as(db, OUTRA, up(1, 3, cat, OTHER)), /foreign key|row-level security|eixo inexistente/);
    assert.equal((await as(db, OUTRA, 'select count(*)::int n from vertice_avaliacao_institucional_eixos'))[0].n, 0);
  } finally { await db.close(); }
});
