// Metas: medição automática das metas de checklist (meta-checklist-v1) e integridade dos vínculos
// (migração 20261125190000). PostgreSQL real (PGlite) com as colunas de produção usadas.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const root = new URL('../../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const NAME = '20261125190000_metas_medicao_indices.sql';
const MIG = read((existsSync(new URL('supabase/migrations/' + NAME, root)) ? 'supabase/migrations/' : 'supabase/migrations_nao_aplicadas/') + NAME);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TOP = id(1), OUT = id(2), PESSOA = id(9);
const FORMULA = '100 × itens aplicáveis concluídos e conferidos ÷ total de itens aplicáveis';

async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema vertice_private;create schema cron;
  create schema vertice_conecta;create schema vertice_planning;create schema vertice_app;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create table cron.job(jobid serial primary key, jobname text unique, schedule text, command text);
  create function cron.schedule(n text, s text, c text) returns bigint language sql as $$ insert into cron.job(jobname,schedule,command) values(n,s,c) returning jobid $$;
  create function cron.unschedule(n text) returns boolean language sql as $$ delete from cron.job where jobname=n returning true $$;
  create table vertice_institutions(id uuid primary key, state text, acronym text);
  insert into vertice_institutions values('${TOP}','TO','UNITOP'),('${OUT}','SP','OUTRA');
  create table vertice_goals(id uuid primary key, institution_id uuid not null, formula text, status text);
  create table vertice_repository_requests(id uuid primary key, institution_id uuid not null, goal_id uuid, active boolean default true, not_applicable boolean default false);
  create table vertice_repository_files(id uuid primary key default gen_random_uuid(), institution_id uuid not null, request_id uuid not null, status text);
  create table vertice_goal_measurements(id uuid primary key default gen_random_uuid(), institution_id uuid not null, goal_id uuid not null references vertice_goals(id) on delete cascade,
   measured_on date not null, value numeric not null, source text, note text, created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
  create table vertice_actions(id uuid primary key default gen_random_uuid(), goal_id uuid);
  create table vertice_conecta.partner_proposals(id uuid primary key default gen_random_uuid(), goal_id uuid);
  create table vertice_planning.objective_goal_links(id uuid primary key default gen_random_uuid(), goal_id uuid);
  create table vertice_sapiens_action_plans(id uuid primary key default gen_random_uuid(), institution_id uuid not null, goal_id uuid not null);
  create table vertice_app.trail_actions(id uuid primary key default gen_random_uuid(), goal_id uuid);
  create table vertice_extension_plans(id uuid primary key default gen_random_uuid(), institution_id uuid not null, goal_ids uuid[]);
  insert into vertice_goals values
   ('${id(11)}','${TOP}','${FORMULA}','planejada'),  -- 2 aplicáveis, 1 validado, 1 NSA
   ('${id(12)}','${TOP}','${FORMULA}','planejada'),  -- só NSA: sem item aplicável
   ('${id(13)}','${TOP}','Taxa de evasão (%)','planejada'), -- outra fórmula: fora
   ('${id(14)}','${TOP}','${FORMULA}','concluida'),  -- encerrada: fora
   ('${id(15)}','${OUT}','${FORMULA}','planejada');  -- outra IES, 1 aplicável sem validação
  insert into vertice_repository_requests(id,institution_id,goal_id,not_applicable,active) values
   ('${id(21)}','${TOP}','${id(11)}',false,true),('${id(22)}','${TOP}','${id(11)}',false,true),('${id(23)}','${TOP}','${id(11)}',true,true),
   ('${id(24)}','${TOP}','${id(11)}',false,false),('${id(25)}','${TOP}','${id(12)}',true,true),('${id(26)}','${TOP}','${id(13)}',false,true),
   ('${id(27)}','${TOP}','${id(14)}',false,true),('${id(28)}','${OUT}','${id(15)}',false,true);
  insert into vertice_repository_files(institution_id,request_id,status) values
   ('${TOP}','${id(21)}','validado'),('${TOP}','${id(22)}','enviado'),('${TOP}','${id(24)}','validado'),('${TOP}','${id(26)}','validado'),('${OUT}','${id(28)}','enviado');`);
  await db.exec(MIG);
  return db;
}
const medir = async (db, inst = null) => (await db.query('select vertice_private.goal_measure_checklist($1) r', [inst])).rows[0].r;
const medicoes = async (db, goal) => (await db.query('select value::float v, source, created_by from vertice_goal_measurements where goal_id=$1 order by created_at', [goal])).rows;

test('mede só metas de checklist abertas, com itens aplicáveis; ausência não vira zero', async () => {
  const db = await setup();
  try {
    const r = await medir(db);
    assert.deepEqual(r, {regra: 'meta-checklist-v1', novas: 2, atualizadas: 0, sem_mudanca: 0, sem_itens_aplicaveis: 1});
    const m = await medicoes(db, id(11));
    assert.equal(m.length, 1);
    assert.equal(m[0].v, 50); // 1 de 2 aplicáveis (NSA e inativa fora)
    assert.match(m[0].source, /^algoritmo meta-checklist-v1: 1 de 2 itens aplicáveis/);
    assert.equal(m[0].created_by, null);
    assert.deepEqual(await medicoes(db, id(12)), [], 'sem item aplicável: não mede');
    assert.deepEqual(await medicoes(db, id(13)), [], 'outra fórmula: não mede');
    assert.deepEqual(await medicoes(db, id(14)), [], 'meta encerrada: não mede');
    assert.equal((await medicoes(db, id(15)))[0].v, 0, 'aplicável sem validação mede 0, que é dado real');
  } finally { await db.close(); }
});

test('idempotente; valor novo atualiza a medição do dia; medição humana nunca é alterada', async () => {
  const db = await setup();
  try {
    await medir(db);
    assert.equal((await medir(db)).sem_mudanca, 2, 'mesmo valor: nada novo');
    await db.exec(`update vertice_repository_files set status='validado' where request_id='${id(22)}'`);
    const r = await medir(db);
    assert.equal(r.atualizadas, 1);
    assert.deepEqual((await medicoes(db, id(11))).map((x) => x.v), [100], 'mesma data: atualiza a do algoritmo');
    // Pessoa lança medição diferente no mesmo dia: o algoritmo não a altera e grava a sua à parte.
    await db.exec(`select set_config('test.uid','${PESSOA}',false); insert into vertice_goal_measurements(institution_id,goal_id,measured_on,value,source) values('${TOP}','${id(11)}',current_date,70,'Coordenação'); select set_config('test.uid','',false);`);
    await medir(db);
    const m = await medicoes(db, id(11));
    assert.deepEqual(m.filter((x) => x.created_by === PESSOA).map((x) => x.v), [70]);
    assert.deepEqual(m.filter((x) => x.created_by === null).map((x) => x.v), [100]);
    assert.equal((await medir(db, OUT)).sem_mudanca, 1, 'filtro por instituição');
  } finally { await db.close(); }
});

test('rotina diária agendada; índices e chaves dos vínculos com metas', async () => {
  const db = await setup();
  try {
    assert.deepEqual((await db.query(`select schedule, command from cron.job where jobname='vertice-metas-medicao-diaria'`)).rows,
      [{schedule: '37 6 * * *', command: 'select vertice_private.goal_measure_checklist()'}]);
    await db.exec(MIG); // reaplicação não duplica a rotina
    assert.equal((await db.query(`select count(*)::int n from cron.job`)).rows[0].n, 1);
    const idx = (await db.query(`select indexname from pg_indexes where indexname like '%goal_id_idx' order by 1`)).rows.map((r) => r.indexname);
    assert.deepEqual(idx, ['objective_goal_links_goal_id_idx', 'partner_proposals_goal_id_idx', 'trail_actions_goal_id_idx', 'vertice_actions_goal_id_idx', 'vertice_sapiens_action_plans_goal_id_idx']);
    await assert.rejects(() => db.query(`insert into vertice_sapiens_action_plans(institution_id,goal_id) values('${TOP}','${id(99)}')`), /foreign key/);
    await assert.rejects(() => db.query(`insert into vertice_app.trail_actions(goal_id) values('${id(99)}')`), /foreign key/);
    await db.query(`insert into vertice_extension_plans(institution_id,goal_ids) values('${TOP}',array['${id(11)}']::uuid[])`);
    await assert.rejects(() => db.query(`insert into vertice_extension_plans(institution_id,goal_ids) values('${TOP}',array['${id(15)}']::uuid[])`), /outra instituição/);
    await assert.rejects(() => db.query(`insert into vertice_extension_plans(institution_id,goal_ids) values('${TOP}',array['${id(99)}']::uuid[])`), /meta inexistente/);
  } finally { await db.close(); }
});
