// Homologação da migração candidata da Automação 360° em PGlite (PostgreSQL 17), dados sintéticos.
// Cobre: catálogo, RBAC nativo com MFA, isolamento IES/curso, aprovação independente, CAS,
// imutabilidade, execução sombra com o motor real, fila operacional, 5W2H, painel e reversão.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { RULES } from '../../../supabase/functions/_shared/automacao360/catalog.mjs';
import { shadowRun } from '../../../supabase/functions/_shared/automacao360/native-integration.mjs';
import { prepareShadowReceipt } from '../../../supabase/functions/_shared/automacao360/persistence.mjs';
import { evaluate } from '../../../supabase/functions/_shared/automacao360/engine.mjs';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// UNITOP e UNICALDAS sintéticas (identificadores fictícios), mais um curso de cada.
const UNITOP = id(101), UNICALDAS = id(102), DIR_TOP = id(201), DIR_CAL = id(202);
const MASTER = id(1), GESTOR_TOP = id(2), GESTOR2_TOP = id(3), COORD_TOP = id(4), LEITOR_TOP = id(5), EQUIPE_TOP = id(6), GESTOR_CAL = id(7);
const read = (p) => readFile(new URL(p, import.meta.url), 'utf8');

async function setup(t) {
  const db = new PGlite();
  await db.waitReady;
  t.after(() => db.close());
  await db.exec(await read('./fixture.sql'));
  const staff = await read('../../../supabase/migrations/20261122170000_course_staff_functions.sql');
  const s = staff.indexOf('create function vertice_private.course_function(');
  await db.exec(staff.slice(s, staff.indexOf('$$;', s) + 3));
  await db.exec(await read('../../../supabase/migrations_nao_aplicadas/20261124210000_automacao360_nucleo.sql'));
  await db.exec(await read('../../../supabase/migrations_nao_aplicadas/20261124210001_automacao360_catalogo.sql'));
  await db.exec(`
    INSERT INTO public.vertice_institutions VALUES ('${UNITOP}','UNITOP sintética','superior'),('${UNICALDAS}','UNICALDAS sintética','superior');
    INSERT INTO public.vertice_courses VALUES ('${DIR_TOP}','${UNITOP}','Direito','DIR'),('${DIR_CAL}','${UNICALDAS}','Direito','DIR');
    INSERT INTO public.vertice_admins VALUES ('${MASTER}');
    INSERT INTO public.vertice_memberships VALUES ('${GESTOR_TOP}','${UNITOP}','gestor'),('${GESTOR2_TOP}','${UNITOP}','gestor'),('${COORD_TOP}','${UNITOP}','equipe'),
      ('${LEITOR_TOP}','${UNITOP}','leitor'),('${EQUIPE_TOP}','${UNITOP}','equipe'),('${GESTOR_CAL}','${UNICALDAS}','gestor');
    INSERT INTO public.vertice_course_staff_functions VALUES ('${UNITOP}','${DIR_TOP}','${COORD_TOP}','coordenador',true);
    INSERT INTO public.vertice_goals(id,institution_id,course_id,title) VALUES ('${id(301)}','${UNITOP}','${DIR_TOP}','Meta PPC'),('${id(302)}','${UNICALDAS}',null,'Meta UNICALDAS');
    INSERT INTO public.vertice_repository_requests(id,institution_id,course_id,title,due_date,not_applicable) VALUES
      ('${id(401)}','${UNITOP}','${DIR_TOP}','PPC vigente', current_date - 3, false),
      ('${id(402)}','${UNITOP}','${DIR_TOP}','Ata NDE', current_date + 2, false),
      ('${id(403)}','${UNITOP}','${DIR_TOP}','Regulamento', current_date - 10, false),
      ('${id(404)}','${UNITOP}','${DIR_TOP}','Sem prazo', null, false),
      ('${id(405)}','${UNITOP}','${DIR_TOP}','Não se aplica', current_date - 5, true),
      ('${id(406)}','${UNICALDAS}','${DIR_CAL}','Outra IES', current_date - 1, false);
    INSERT INTO public.vertice_repository_files(institution_id,request_id,status) VALUES ('${UNITOP}','${id(403)}','validado'),('${UNITOP}','${id(402)}','enviado');
  `);
  return db;
}

// Executa como um papel do Supabase com claims de JWT simuladas.
async function as(db, sub, sql, params = [], { aal = 'aal2', role = 'authenticated' } = {}) {
  await db.query(`select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claim.aal',$2,false), set_config('request.jwt.claim.role',$3,false)`, [sub ?? '', aal ?? '', role]);
  await db.exec(`SET ROLE ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('RESET ROLE'); }
}
const propose = (db, user, inst, course, rules, { enabled = true, mode = 'shadow', expected = 0, aal } = {}) =>
  as(db, user, 'select public.vertice_automation_propose_config($1,$2,$3,$4,$5,24,$6,$7) as id', [inst, course, rules, enabled, mode, expected, 'Configuração de teste'], { aal });
const approve = (db, user, cfg, opts) => as(db, user, 'select public.vertice_automation_approve_config($1,$2)', [cfg, 'Aprovação de teste'], opts);
const configured = async (db, opts = {}) => {
  const cfg = (await propose(db, opts.by ?? COORD_TOP, UNITOP, DIR_TOP, ['repo.overdue', 'repo.due'], opts)).rows[0].id;
  await approve(db, opts.approver ?? GESTOR_TOP, cfg);
  return cfg;
};

// Executor do servidor: fonte autorizada -> motor -> recibo -> gravação (service_role).
async function execute(db, { revision = 1, ruleIds = ['repo.overdue', 'repo.due'], runId = randomUUID() } = {}) {
  const scope = { institutionId: UNITOP, courseId: DIR_TOP };
  const source = (await as(db, null, 'select public.vertice_automation_source_documentary($1,$2) s', [UNITOP, DIR_TOP], { role: 'service_role', aal: null })).rows[0].s;
  const asOf = new Date().toISOString();
  const config = { ...scope, enabled: true, approved: true, revision, ruleIds, maxAgeHours: 24 };
  const actor = { ...scope, id: id(999), mfa: true, permissions: ['read'] };
  const result = await shadowRun({ scope, actor, config, asOf, timeZone: 'America/Sao_Paulo', adapters: { documentary: async () => source } });
  const receipt = prepareShadowReceipt({ scope, config, result, runId, asOf });
  const ack = (await as(db, null, 'select public.vertice_automation_record_run($1) r', [receipt], { role: 'service_role', aal: null })).rows[0].r;
  return { source, result, receipt, ack };
}

test('catálogo do banco é idêntico ao catálogo versionado e nenhuma regra nasce validada', async (t) => {
  const db = await setup(t);
  const rows = (await db.query('select id, version, priority, source_status from vertice_automation.rules order by id')).rows;
  assert.equal(rows.length, 40);
  for (const r of RULES) assert.ok(rows.some((x) => x.id === r.id && x.version === r.version && x.priority === r.priority), r.id);
  assert.equal(rows.filter((r) => r.source_status === 'validada').length, 0);
  const mod = (await db.query("select active, tabs from public.vertice_module_catalog where code = 'GEST_AUTOMACAO360'")).rows[0];
  assert.deepEqual(mod, { active: false, tabs: ['automacao360'] }); // módulo nasce desativado
});

test('estado inicial: tudo inativo, sem execução e sem fila (nada vira zero)', async (t) => {
  const db = await setup(t);
  const d = (await as(db, GESTOR_TOP, 'select public.vertice_automation_dashboard($1,null) d', [UNITOP])).rows[0].d;
  assert.equal(d.config, null); assert.equal(d.lastRun, null); assert.equal(d.pending, null);
  assert.ok(d.rules.every((r) => r.state === 'inactive'));
});

test('MFA obrigatório: gestor sem aal2 não configura nem lê', async (t) => {
  const db = await setup(t);
  await assert.rejects(propose(db, GESTOR_TOP, UNITOP, null, ['repo.due'], { aal: 'aal1' }), /MFA/);
  await assert.rejects(as(db, GESTOR_TOP, 'select public.vertice_automation_dashboard($1,null)', [UNITOP], { aal: 'aal1' }), /MFA/);
});

test('isolamento entre IES: gestor da UNICALDAS não acessa a UNITOP e vice-versa', async (t) => {
  const db = await setup(t);
  await assert.rejects(propose(db, GESTOR_CAL, UNITOP, null, ['repo.due']), /acesso negado/);
  await assert.rejects(as(db, GESTOR_TOP, 'select public.vertice_automation_dashboard($1,null)', [UNICALDAS]), /acesso negado/);
  // Adaptador de fonte é exclusivo do servidor: nem o próprio gestor o executa pelo navegador.
  await assert.rejects(as(db, GESTOR_TOP, 'select public.vertice_automation_source_documentary($1,$2)', [UNITOP, DIR_TOP]), /permission denied/);
});

test('isolamento entre cursos: curso de outra IES é recusado (FK composta corrigida)', async (t) => {
  const db = await setup(t);
  await assert.rejects(propose(db, MASTER, UNITOP, DIR_CAL, ['repo.due']), /acesso negado/);
  await assert.rejects(db.query(`insert into vertice_automation.config_revision(institution_id,course_id,revision,configured_by) values ($1,$2,1,$3)`, [UNITOP, DIR_CAL, MASTER]), /foreign key/);
});

test('papéis nativos: leitor não configura; coordenador só no próprio curso; equipe não aprova', async (t) => {
  const db = await setup(t);
  await assert.rejects(propose(db, LEITOR_TOP, UNITOP, null, ['repo.due']), /acesso negado/);
  await assert.rejects(propose(db, COORD_TOP, UNITOP, null, ['repo.due']), /acesso negado/);
  const cfg = (await propose(db, COORD_TOP, UNITOP, DIR_TOP, ['repo.due'])).rows[0].id;
  await assert.rejects(approve(db, EQUIPE_TOP, cfg), /acesso negado/);
  await assert.rejects(as(db, LEITOR_TOP, 'select public.vertice_automation_dashboard($1,$2)', [UNITOP, DIR_TOP]), /acesso negado/);
  assert.ok((await as(db, LEITOR_TOP, 'select public.vertice_automation_dashboard($1,null) d', [UNITOP])).rows[0].d);
});

test('aprovação independente, revisão superada e concorrência (CAS)', async (t) => {
  const db = await setup(t);
  const first = (await propose(db, GESTOR_TOP, UNITOP, null, ['repo.due'])).rows[0].id;
  await assert.rejects(approve(db, GESTOR_TOP, first), /autoaprovação/);
  await assert.rejects(propose(db, GESTOR2_TOP, UNITOP, null, ['repo.due'], { expected: 0 }), /concorrente/);
  const second = (await propose(db, GESTOR2_TOP, UNITOP, null, ['repo.overdue'], { expected: 1 })).rows[0].id;
  await assert.rejects(approve(db, GESTOR2_TOP, first), /superada/);
  await approve(db, GESTOR_TOP, second);
  await assert.rejects(approve(db, MASTER, second), /já aprovada/);
  await assert.rejects(db.query('update vertice_automation.config_revision set enabled = false where id = $1', [second]), /imutável/);
  await assert.rejects(propose(db, GESTOR_TOP, UNITOP, null, ['repo.due', 'repo.due'], { expected: 2 }), /repetida/);
  await assert.rejects(propose(db, GESTOR_TOP, UNITOP, null, ['nao.existe'], { expected: 2 }), /desconhecida/);
});

test('gravação de execução é exclusiva do servidor e exige revisão vigente aprovada e ativada', async (t) => {
  const db = await setup(t);
  await assert.rejects(as(db, GESTOR_TOP, 'select public.vertice_automation_record_run($1)', [{}]), /permission denied/);
  await assert.rejects(execute(db), /divergente/); // sem configuração aprovada
  const cfg = (await propose(db, COORD_TOP, UNITOP, DIR_TOP, ['repo.overdue', 'repo.due'], { enabled: false })).rows[0].id;
  await approve(db, GESTOR_TOP, cfg);
  await assert.rejects(execute(db), /não aprovada ou desativada/);
});

test('modo sombra ponta a ponta com fonte documental e motor real, sem fila operacional', async (t) => {
  const db = await setup(t);
  await configured(db);
  const { source, result, ack, receipt } = await execute(db);
  assert.equal(source.requests.length, 4); // NSA fora; outra IES fora
  assert.deepEqual(source.requests.map((r) => r.status).sort(), ['open', 'open', 'submitted', 'validated']);
  assert.equal(result.status, 'partial'); // sem prazo vira issue, não zero
  assert.deepEqual(result.alerts.map((a) => a.ruleId).sort(), ['repo.overdue']); // 401 vencido; 402 enviado; 403 validado; 404 sem prazo
  assert.equal(ack.status, 'inserted');
  assert.equal((await db.query('select count(*)::int n from vertice_automation.alert')).rows[0].n, 0);
  const again = (await as(db, null, 'select public.vertice_automation_record_run($1) r', [receipt], { role: 'service_role', aal: null })).rows[0].r;
  assert.equal(again.status, 'existing');
  await assert.rejects(as(db, null, 'select public.vertice_automation_record_run($1)', [{ ...receipt, digest: 'f'.repeat(64) }], { role: 'service_role', aal: null }), /digest diferente/);
  const d = (await as(db, COORD_TOP, 'select public.vertice_automation_dashboard($1,$2) d', [UNITOP, DIR_TOP])).rows[0].d;
  assert.equal(d.lastRun.status, 'partial'); assert.equal(d.lastRun.alerts, 1); assert.equal(d.lastRun.mode, 'shadow');
  assert.equal(d.pending, null);
  assert.equal(d.rules.find((r) => r.id === 'repo.overdue').state, 'blocked'); // fonte ainda não validada
});

test('execução grava somente regras da configuração e no catálogo vigente', async (t) => {
  const db = await setup(t);
  const cfg = (await propose(db, COORD_TOP, UNITOP, DIR_TOP, ['repo.due'])).rows[0].id;
  await approve(db, GESTOR_TOP, cfg);
  const scope = { institutionId: UNITOP, courseId: DIR_TOP };
  const bad = { runId: randomUUID(), ...scope, configRevision: 1, asOf: new Date().toISOString(), status: 'evaluated', sourceCount: 1, unmappedCount: 0, digest: 'a'.repeat(64), alerts: [{ key: 'b'.repeat(64), rule: 'repo.overdue', version: RULES[0].version, priority: 'P0' }] };
  await assert.rejects(as(db, null, 'select public.vertice_automation_record_run($1)', [bad], { role: 'service_role', aal: null }), /fora da configuração/);
  bad.alerts = [{ key: 'b'.repeat(64), rule: 'repo.due', version: 'velha', priority: 'P0' }];
  await assert.rejects(as(db, null, 'select public.vertice_automation_record_run($1)', [bad], { role: 'service_role', aal: null }), /catálogo/);
});

test('trilha, execuções e alertas observados são imutáveis mesmo para o proprietário', async (t) => {
  const db = await setup(t);
  await configured(db);
  await execute(db);
  await assert.rejects(db.query('update vertice_automation.event set reason = $1', ['alterado manualmente']), /imutável/);
  await assert.rejects(db.query('delete from vertice_automation.event'), /imutável/);
  await assert.rejects(db.query('update vertice_automation.run set status = $1', ['evaluated']), /imutável/);
  await assert.rejects(db.query('delete from vertice_automation.run_alert'), /imutável/);
});

test('ciclo operacional: alerta -> revisão -> responsável -> 5W2H rascunho -> execução -> verificação independente', async (t) => {
  const db = await setup(t);
  await configured(db, { mode: 'operational' });
  await execute(db);
  const alert = (await db.query('select id, status, revision from vertice_automation.alert')).rows;
  assert.equal(alert.length, 1); assert.equal(alert[0].status, 'pending_review');
  const a = alert[0].id;
  const due = new Date(Date.now() + 7 * 864e5).toISOString();
  const decide = (user, action, rev, extra = {}) => as(db, user, 'select public.vertice_automation_decide($1,$2,$3,$4,$5,$6,$7) r',
    [a, action, rev, extra.reason ?? 'Decisão documentada', extra.owner ?? null, extra.due ?? null, extra.evidence ?? null]);
  await assert.rejects(decide(EQUIPE_TOP, 'approve', 0, { owner: EQUIPE_TOP, due }), /acesso negado/); // equipe não revisa
  await assert.rejects(decide(COORD_TOP, 'approve', 0, { owner: GESTOR_CAL, due }), /vínculo/); // responsável de outra IES
  await assert.rejects(decide(COORD_TOP, 'approve', 0, { owner: EQUIPE_TOP, due: new Date(Date.now() - 1000).toISOString() }), /prazo futuro/);
  await assert.rejects(as(db, EQUIPE_TOP, 'select public.vertice_automation_handoff_5w2h($1,$2,null,null)', [a, id(301)]), /somente alerta aprovado/);
  assert.equal((await decide(COORD_TOP, 'approve', 0, { owner: EQUIPE_TOP, due })).rows[0].r, 1);
  await assert.rejects(decide(COORD_TOP, 'start', 0), /concorrente/);
  await assert.rejects(as(db, EQUIPE_TOP, 'select public.vertice_automation_handoff_5w2h($1,$2,null,null)', [a, id(302)]), /meta ativa/); // meta de outra IES
  const action = (await as(db, EQUIPE_TOP, 'select public.vertice_automation_handoff_5w2h($1,$2,null,null) id', [a, id(301)])).rows[0].id;
  const again = (await as(db, EQUIPE_TOP, 'select public.vertice_automation_handoff_5w2h($1,$2,null,null) id', [a, id(301)])).rows[0].id;
  assert.equal(again, action);
  const act = (await db.query('select a.*, g.review_status from public.vertice_actions a join public.vertice_action_governance g on g.action_id = a.id')).rows;
  assert.equal(act.length, 1);
  assert.equal(act[0].origin_type, 'automacao_360'); assert.equal(act[0].origin_ref, a);
  assert.equal(act[0].how, null); assert.equal(act[0].how_much, null); assert.equal(act[0].review_status, 'rascunho');
  assert.equal(act[0].status, 'nao_iniciada'); assert.equal(act[0].responsible_user_id, EQUIPE_TOP);
  await decide(EQUIPE_TOP, 'start', 1);
  await assert.rejects(decide(EQUIPE_TOP, 'complete', 2), /evidência/);
  await decide(EQUIPE_TOP, 'complete', 2, { evidence: 'repositorio:arquivo-sintetico' });
  await assert.rejects(decide(GESTOR_TOP, 'verify', 3), /evidência/);
  await as(db, MASTER, 'select set_config($1,$2,false)', ['x.y', 'z']); // troca de sessão
  assert.equal((await decide(GESTOR_TOP, 'verify', 3, { evidence: 'repositorio:conferido' })).rows[0].r, 4);
  const trail = (await db.query("select action from vertice_automation.event where entity in ('alert','handoff') order by id")).rows.map((r) => r.action);
  assert.deepEqual(trail, ['approve', '5w2h_draft', 'start', 'complete', 'verify']);
  const d = (await as(db, GESTOR_TOP, 'select public.vertice_automation_dashboard($1,$2) d', [UNITOP, DIR_TOP])).rows[0].d;
  assert.deepEqual(d.pending, []);
});

test('verificação independente: quem concluiu não verifica; encerramento administrativo com justificativa', async (t) => {
  const db = await setup(t);
  await configured(db, { mode: 'operational' });
  await execute(db);
  const a = (await db.query('select id from vertice_automation.alert')).rows[0].id;
  const due = new Date(Date.now() + 864e5).toISOString();
  const decide = (user, action, rev, extra = {}) => as(db, user, 'select public.vertice_automation_decide($1,$2,$3,$4,$5,$6,$7) r', [a, action, rev, extra.reason ?? 'Decisão documentada', extra.owner ?? null, extra.due ?? null, extra.evidence ?? null]);
  await decide(GESTOR_TOP, 'approve', 0, { owner: GESTOR_TOP, due });
  await decide(GESTOR_TOP, 'start', 1);
  await decide(GESTOR_TOP, 'complete', 2, { evidence: 'ref' });
  await assert.rejects(decide(GESTOR_TOP, 'verify', 3, { evidence: 'ref' }), /independente/);
  await assert.rejects(decide(GESTOR2_TOP, 'close', 3, { reason: 'Encerramento após conclusão' }), /transição inválida/);
});

test('encerramento administrativo de alerta superado exige justificativa e fica na trilha', async (t) => {
  const db = await setup(t);
  await configured(db, { mode: 'operational' });
  await execute(db);
  const a = (await db.query('select id from vertice_automation.alert')).rows[0].id;
  const close = (reason) => as(db, COORD_TOP, 'select public.vertice_automation_decide($1,$2,$3,$4) r', [a, 'close', 0, reason]);
  await assert.rejects(close('ok'), /justificativa/);
  assert.equal((await close('Pendência resolvida na fonte antes da revisão')).rows[0].r, 1);
  const ev = (await db.query("select action, from_status, to_status from vertice_automation.event where entity='alert'")).rows;
  assert.deepEqual(ev, [{ action: 'close', from_status: 'pending_review', to_status: 'closed_admin' }]);
});

test('execução em lote repetida não duplica a fila (idempotência entre execuções)', async (t) => {
  const db = await setup(t);
  await configured(db, { mode: 'operational' });
  await execute(db); await execute(db);
  assert.equal((await db.query('select count(*)::int n from vertice_automation.run')).rows[0].n, 2);
  assert.equal((await db.query('select count(*)::int n from vertice_automation.alert')).rows[0].n, 1);
});

test('reversão: nova revisão desativada bloqueia execuções e preserva todo o histórico', async (t) => {
  const db = await setup(t);
  await configured(db, { mode: 'operational' });
  await execute(db);
  const before = (await db.query('select (select count(*) from vertice_automation.run)::int r, (select count(*) from vertice_automation.alert)::int a, (select count(*) from vertice_automation.event)::int e')).rows[0];
  const off = (await propose(db, COORD_TOP, UNITOP, DIR_TOP, ['repo.overdue', 'repo.due'], { enabled: false, expected: 1 })).rows[0].id;
  await approve(db, GESTOR_TOP, off);
  await assert.rejects(execute(db, { revision: 2 }), /não aprovada ou desativada/);
  const after = (await db.query('select (select count(*) from vertice_automation.run)::int r, (select count(*) from vertice_automation.alert)::int a, (select count(*) from vertice_automation.event)::int e')).rows[0];
  assert.equal(after.r, before.r); assert.equal(after.a, before.a); assert.equal(after.e, before.e + 2);
  const d = (await as(db, GESTOR_TOP, 'select public.vertice_automation_dashboard($1,$2) d', [UNITOP, DIR_TOP])).rows[0].d;
  assert.equal(d.config.enabled, false); assert.equal(d.pending, null);
  assert.ok(d.rules.every((r) => r.state === 'inactive'));
});

test('papéis da API não leem nem gravam as tabelas diretamente', async (t) => {
  const db = await setup(t);
  for (const role of ['anon', 'authenticated', 'service_role'])
    await assert.rejects(as(db, GESTOR_TOP, 'select * from vertice_automation.config_revision', [], { role }), /permission denied/);
  await assert.rejects(as(db, GESTOR_TOP, "insert into public.vertice_actions(institution_id,what,origin_type) values ($1,'x','inexistente')", [UNITOP], { role: 'service_role' }), /permission denied|check/);
});

test('adaptador do planejamento e da CPA: PEI institucional e evidências da CPA, com motor real e gravação', async (t) => {
  const db = await setup(t);
  await db.exec(`
    INSERT INTO public.vertice_goals(id,institution_id,course_id,title) VALUES ('${id(311)}','${UNITOP}',null,'Meta do PDI'),('${id(312)}','${UNITOP}',null,'Meta em dia');
    INSERT INTO public.vertice_actions(institution_id,goal_id,what,due_date,status) VALUES
      ('${UNITOP}','${id(311)}','Vencida em andamento', current_date - 4,'em_andamento'),
      ('${UNITOP}','${id(311)}','Vencida concluída', current_date - 9,'concluida'),
      ('${UNITOP}','${id(312)}','No prazo', current_date + 9,'nao_iniciada');
    INSERT INTO public.vertice_cpa_findings VALUES ('${id(801)}','${UNITOP}',null,'Achado CPA'),('${id(802)}','${UNICALDAS}',null,'Achado de outra IES');
    INSERT INTO public.vertice_cpa_actions(finding_id,institution_id,status,evidence_description,evidence_url) VALUES
      ('${id(801)}','${UNITOP}','executada',null,null),('${id(801)}','${UNITOP}','executada','Relatório anexado',null),('${id(801)}','${UNITOP}','planejada',null,null),
      ('${id(802)}','${UNICALDAS}','executada',null,null);`);
  const cfg = (await propose(db, GESTOR_TOP, UNITOP, null, ['pei.overdue', 'cpa.pending'])).rows[0].id;
  await approve(db, GESTOR2_TOP, cfg);
  const src = (await as(db, null, 'select public.vertice_automation_source_planning($1,null) s', [UNITOP], { role: 'service_role', aal: null })).rows[0].s;
  const metric = (rule, entity) => src.records.find((r) => r.ruleId === rule && r.entityId === entity).metrics;
  assert.deepEqual(metric('pei.overdue', id(311)), { overdueActions: 1 }); // concluída não conta
  assert.deepEqual(metric('pei.overdue', id(312)), { overdueActions: 0 });
  assert.deepEqual(metric('cpa.pending', id(801)), { missingEvidence: 1 }); // planejada não exige evidência
  assert.ok(!src.records.some((r) => r.entityId === id(802))); // outra IES fora
  await assert.rejects(as(db, GESTOR_TOP, 'select public.vertice_automation_source_planning($1,null)', [UNITOP]), /permission denied/);
  const scope = { institutionId: UNITOP, courseId: null }, asOf = new Date().toISOString();
  const config = { ...scope, enabled: true, approved: true, revision: 1, ruleIds: ['pei.overdue', 'cpa.pending'], maxAgeHours: 24 };
  const out = evaluate({ scope, config, asOf, snapshot: { ...scope, sourceId: src.sourceId, observedAt: src.observedAt, records: src.records } });
  assert.deepEqual(out.alerts.map((a) => `${a.ruleId}:${a.entityId}`).sort(), [`cpa.pending:${id(801)}`, `pei.overdue:${id(311)}`]);
  const receipt = prepareShadowReceipt({ scope, config, runId: randomUUID(), asOf, result: { mode: 'shadow', status: out.status, alerts: out.alerts, sources: [{}], unmapped: [] } });
  const ack = (await as(db, null, 'select public.vertice_automation_record_run($1) r', [receipt], { role: 'service_role', aal: null })).rows[0].r;
  assert.equal(ack.status, 'inserted');
  assert.equal((await db.query('select count(*)::int n from vertice_automation.run_alert')).rows[0].n, 2);
});
