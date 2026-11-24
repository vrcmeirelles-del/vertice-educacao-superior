// Correção das funções 5W2H da Governança 360°: reproduz o defeito de produção com o SQL original
// extraído (docs/automacao360/contratos-nativos/5w2h) e valida a correção candidata. Dados sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const IES_A = id(101), IES_B = id(102), CUR_A = id(201), CUR_B = id(202);
const GESTOR = id(2), EQUIPE = id(3), LEITOR = id(4), GESTOR_B = id(5);
const DELIB = id(501), DELIB2 = id(502), BODY = id(601);
const read = (p) => readFile(new URL(p, import.meta.url), 'utf8');

// Colunas de produção (information_schema, 24/11/2026) usadas pelas funções.
const GOVERNANCE = `
ALTER TABLE public.vertice_goals ADD COLUMN direction text, ADD COLUMN unit text, ADD COLUMN baseline numeric, ADD COLUMN due_date date,
  ADD COLUMN frequency text, ADD COLUMN owner_name text, ADD COLUMN owner_user_id uuid, ADD COLUMN created_by uuid, ADD COLUMN origin_type text, ADD COLUMN origin_ref uuid;
ALTER TABLE public.vertice_actions ADD COLUMN deliberation_id uuid;
CREATE TABLE public.governance_bodies(id uuid PRIMARY KEY, institution_id uuid, course_id uuid, name text, acronym text, body_type text);
CREATE TABLE public.governance_meetings(id uuid PRIMARY KEY, scheduled_date date, meeting_type text, meeting_number int);
CREATE TABLE public.governance_deliberations(id uuid PRIMARY KEY, institution_id uuid NOT NULL, body_id uuid, meeting_id uuid, subject text,
  due_date date, status text, action_id uuid, goal_id uuid, created_at timestamptz DEFAULT now());
CREATE TABLE public.governance_workflow_events(id bigserial PRIMARY KEY, deliberation_id uuid, institution_id uuid, event_type text, from_actor uuid,
  from_sector text, to_actor uuid, to_sector text, status_before text, status_after text, event_note text, evidence_file_id uuid, occurred_at timestamptz DEFAULT now());
CREATE TABLE public.governance_evidence(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), deliberation_id uuid);
INSERT INTO public.vertice_institutions VALUES ('${IES_A}','IES A sintética','superior'),('${IES_B}','IES B sintética','superior');
INSERT INTO public.vertice_courses VALUES ('${CUR_A}','${IES_A}','Direito','DIR'),('${CUR_B}','${IES_B}','Direito','DIR');
INSERT INTO public.vertice_memberships VALUES ('${GESTOR}','${IES_A}','gestor'),('${EQUIPE}','${IES_A}','equipe'),('${LEITOR}','${IES_A}','leitor'),('${GESTOR_B}','${IES_B}','gestor');
INSERT INTO public.governance_bodies VALUES ('${BODY}','${IES_A}','${CUR_A}','Colegiado de Direito','COL','colegiado');
INSERT INTO public.governance_deliberations(id,institution_id,body_id,subject,due_date,status) VALUES
  ('${DELIB}','${IES_A}','${BODY}','Revisar o PPC', current_date + 30,'registrada'),('${DELIB2}','${IES_A}','${BODY}','Atualizar ementas', current_date + 20,'registrada');
INSERT INTO public.vertice_goals(id,institution_id,course_id,title) VALUES ('${id(701)}','${IES_A}','${CUR_A}','Meta A'),('${id(702)}','${IES_B}',null,'Meta B');
GRANT USAGE ON SCHEMA public TO authenticated;`;

async function setup(t, { corrected = true } = {}) {
  const db = new PGlite();
  await db.waitReady;
  t.after(() => db.close());
  await db.exec(await read('./fixture.sql'));
  await db.exec(GOVERNANCE);
  await db.exec(await read('../../../docs/automacao360/contratos-nativos/5w2h/20261111010933_governance_360_phase3_routing_5w2h.producao.sql'));
  if (corrected) await db.exec(await read('../../../supabase/migrations_nao_aplicadas/20261124210002_governanca_5w2h_correcao.sql'));
  return db;
}
async function as(db, sub, sql, params = [], aal = 'aal2') {
  await db.query(`select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claim.aal',$2,false)`, [sub, aal]);
  await db.exec('SET ROLE authenticated');
  try { return await db.query(sql, params); } finally { await db.exec('RESET ROLE'); }
}
const route = (db, user, delib = DELIB, course = null, aal) => as(db, user, 'select public.governance_route_to_action($1,$2,p_course_id:=$3) id', [delib, 'Ação de teste', course], aal);

test('defeito de produção reproduzido: o SQL original falha com o esquema real', async (t) => {
  const db = await setup(t, { corrected: false });
  await assert.rejects(route(db, GESTOR), /linked_goal_id/);
  await assert.rejects(as(db, GESTOR, 'select public.governance_traceability_report($1)', [IES_A]), /linked_action_id/);
  // e o original deixava um leitor passar da checagem de acesso
  await assert.rejects(route(db, LEITOR), /linked_goal_id/);
});

test('correção: encaminha deliberação para ação 5W2H com rastreabilidade e revisão em rascunho', async (t) => {
  const db = await setup(t);
  const action = (await route(db, GESTOR)).rows[0].id;
  const a = (await db.query('select a.*, g.review_status from public.vertice_actions a join public.vertice_action_governance g on g.action_id=a.id')).rows[0];
  assert.equal(a.id, action); assert.equal(a.deliberation_id, DELIB); assert.equal(a.course_id, CUR_A);
  assert.equal(a.origin_type, 'colegiado'); assert.equal(a.review_status, 'rascunho');
  const d = (await db.query('select status, action_id from public.governance_deliberations where id=$1', [DELIB])).rows[0];
  assert.deepEqual(d, { status: 'encaminhada', action_id: action });
  const ev = (await db.query('select event_type, status_before, status_after from public.governance_workflow_events')).rows;
  assert.deepEqual(ev, [{ event_type: 'encaminhamento', status_before: 'registrada', status_after: 'encaminhada' }]);
  const trace = (await as(db, LEITOR, 'select public.governance_deliberation_trace($1) t', [DELIB])).rows[0].t;
  assert.equal(trace.linked_action.id, action); assert.equal(trace.workflow_events.length, 1);
});

test('correção: leitor, sessão sem MFA e gestor de outra IES não encaminham', async (t) => {
  const db = await setup(t);
  await assert.rejects(route(db, LEITOR), /acesso_negado/);
  await assert.rejects(route(db, GESTOR, DELIB, null, 'aal1'), /acesso_negado/);
  await assert.rejects(route(db, GESTOR_B), /acesso_negado/);
  assert.equal((await db.query('select count(*)::int n from public.vertice_actions')).rows[0].n, 0);
});

test('correção: curso de outra IES é recusado', async (t) => {
  const db = await setup(t);
  await assert.rejects(route(db, GESTOR, DELIB, CUR_B), /curso_fora_da_instituicao/);
});

test('correção: criar meta segue a política nativa (equipe não cria; gestor cria)', async (t) => {
  const db = await setup(t);
  const call = (u) => as(db, u, 'select public.governance_route_to_goal_and_action($1,$2,$3,$4) r', [DELIB, 'Meta do colegiado', 'Indicador', 10]);
  await assert.rejects(call(EQUIPE), /acesso_negado/);
  const r = (await call(GESTOR)).rows[0].r;
  const d = (await db.query('select goal_id, action_id from public.governance_deliberations where id=$1', [DELIB])).rows[0];
  assert.deepEqual(d, { goal_id: r.goal_id, action_id: r.action_id });
});

test('correção: lote não vincula meta de outra IES e isola falhas por item', async (t) => {
  const db = await setup(t);
  const out = (await as(db, EQUIPE, 'select public.governance_batch_route($1) r', [[
    { deliberation_id: DELIB, what: 'Item 1', goal_id: id(702) },
    { deliberation_id: DELIB2, what: 'Item 2', goal_id: id(701) }]])).rows[0].r;
  assert.match(out[0].error, /meta_nao_encontrada/);
  assert.equal(out[1].status, 'ok');
  const d = (await db.query('select id, goal_id, action_id from public.governance_deliberations order by id')).rows;
  assert.equal(d[0].goal_id, null); assert.equal(d[0].action_id, null);
  assert.equal(d[1].goal_id, id(701)); assert.ok(d[1].action_id);
});

test('correção: relatório sem deliberações não transforma ausência em taxa zero', async (t) => {
  const db = await setup(t);
  const r = (await as(db, LEITOR, 'select public.governance_traceability_report($1) r', [IES_A])).rows[0].r;
  assert.equal(r.summary.total_deliberations, 2); assert.equal(r.summary.routing_rate, 0);
  await db.exec(`DELETE FROM public.governance_deliberations`);
  const empty = (await as(db, LEITOR, 'select public.governance_traceability_report($1) r', [IES_A])).rows[0].r;
  assert.equal(empty.summary.total_deliberations, 0); assert.equal(empty.summary.routing_rate, null);
  await assert.rejects(as(db, LEITOR, 'select public.governance_traceability_report($1)', [IES_B]), /acesso_negado/);
});
