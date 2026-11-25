// Certificados de Extensão e de Atividades de Ensino (migração 20261125230000) em PGlite com pgcrypto.
// Permissões com as funções nativas de produção (texto lido em 25/11/2026). Dados sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const IES = id(101), IES_B = id(102), DIR = id(201), PROJ = id(301), ACT = id(401), ACT_DRAFT = id(402);
const MASTER = id(1), GESTOR = id(2), EQUIPE = id(3), LEITOR = id(4), COORD = id(5), GESTOR_B = id(6);
const ANA = id(501), BIA = id(502), CAIO = id(503), RET = id(504), R1 = id(601), R2 = id(602);
const read = (p) => readFile(new URL(p, import.meta.url), 'utf8');
const readMigration = (name) => read('../../../supabase/migrations/' + name).catch(() => read('../../../supabase/migrations_nao_aplicadas/' + name));

const NATIVE = `
CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto SCHEMA extensions;
CREATE OR REPLACE FUNCTION vertice_private.has_role(target uuid, roles text[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
 select coalesce(vertice_private.member_role(target) = 'master' or vertice_private.member_role(target) = any(roles), false);
$function$;
CREATE OR REPLACE FUNCTION vertice_private.can_read_institution(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $function$
  SELECT vertice_private.is_master() OR exists(SELECT 1 FROM public.vertice_memberships WHERE user_id = (SELECT auth.uid()) AND institution_id = target);
$function$;
CREATE TABLE public.vertice_learning_staff_scope(institution_id uuid, course_id uuid, subject_code text, user_id uuid, active boolean);
CREATE TABLE public.vertice_extension_projects(id uuid PRIMARY KEY, institution_id uuid NOT NULL, title text, start_date date, end_date date,
  owner_id uuid, coordinator_email text, deleted_at timestamptz);
CREATE TABLE public.vertice_extension_students(id uuid PRIMARY KEY, institution_id uuid NOT NULL, project_id uuid NOT NULL, full_name text,
  cpf text, email text, deleted_at timestamptz, removed_at timestamptz);
CREATE TABLE public.vertice_extension_hour_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid, project_id uuid, student_id uuid,
  entry_type text, minutes integer, hour_state text);
CREATE TABLE public.vertice_student_registry(id uuid PRIMARY KEY, institution_id uuid, full_name text, enrollment_code text);
CREATE TABLE vertice_private.teaching_activity_students(activity_id uuid, student_id uuid, participant_role text, minutes integer, removed_at timestamptz);
CREATE OR REPLACE FUNCTION vertice_private.extension_project_manager(p vertice_extension_projects) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
 select auth.uid() is not null
  and coalesce(vertice_private.can_read_institution(p.institution_id),false)
  and (coalesce(vertice_private.has_role(p.institution_id,array['gestor']),false)
       or (coalesce(vertice_private.has_role(p.institution_id,array['equipe']),false)
           and (p.owner_id=auth.uid() or
            (p.owner_id is null and exists(select 1 from auth.users u where u.id=auth.uid()
             and u.email_confirmed_at is not null and lower(u.email)=lower(p.coordinator_email))))));
$function$;
CREATE OR REPLACE FUNCTION vertice_private.teaching_access(inst uuid, course uuid, mode text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
 select coalesce(
   (select auth.uid()) is not null and (select auth.jwt()->>'aal')='aal2'
   and exists(select 1 from public.vertice_courses c join public.vertice_institutions i on i.id=c.institution_id
              where c.id=course and c.institution_id=inst and i.tier='superior')
   and (vertice_private.member_role(inst) in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador')
      or vertice_private.course_function(inst,course)='coordenador'
      or (mode='read' and vertice_private.course_function(inst,course)='nde')
      or (exists(select 1 from public.vertice_learning_staff_scope st
                 where st.user_id=(select auth.uid()) and st.institution_id=inst and st.course_id=course and st.active)
          and (vertice_private.member_role(inst)='coordenador'
             or (mode='read' and vertice_private.member_role(inst)='nde')
             or (mode in ('read','record') and vertice_private.member_role(inst)='equipe')))),false)
$function$;`;

async function setup(t) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.waitReady;
  t.after(() => db.close());
  await db.exec(await read('./fixture.sql'));
  const staff = await read('../../../supabase/migrations/20261122170000_course_staff_functions.sql');
  const s = staff.indexOf('create function vertice_private.course_function(');
  await db.exec(staff.slice(s, staff.indexOf('$$;', s) + 3));
  await db.exec('ALTER TABLE auth.users ADD COLUMN email text, ADD COLUMN email_confirmed_at timestamptz');
  await db.exec(NATIVE);
  await db.exec(await readMigration('20261125230000_certificados.sql'));
  await db.exec(`
    INSERT INTO public.vertice_institutions VALUES ('${IES}','IES sintética','superior'),('${IES_B}','IES B sintética','superior');
    INSERT INTO public.vertice_courses VALUES ('${DIR}','${IES}','Direito','DIR');
    INSERT INTO public.vertice_admins VALUES ('${MASTER}');
    INSERT INTO public.vertice_memberships VALUES ('${GESTOR}','${IES}','gestor'),('${EQUIPE}','${IES}','equipe'),('${LEITOR}','${IES}','leitor'),
      ('${COORD}','${IES}','equipe'),('${GESTOR_B}','${IES_B}','gestor');
    INSERT INTO public.vertice_course_staff_functions VALUES ('${IES}','${DIR}','${COORD}','coordenador',true);
    INSERT INTO public.vertice_extension_projects VALUES ('${PROJ}','${IES}','Projeto Cidadania','2026-03-01','2026-06-30',null,null,null);
    INSERT INTO public.vertice_extension_students VALUES ('${ANA}','${IES}','${PROJ}','Ana Souza','111','ana@x',null,null),
      ('${BIA}','${IES}','${PROJ}','Bia Lima','222','bia@x',null,null),('${CAIO}','${IES}','${PROJ}','Caio Reis','333','caio@x',null,null),
      ('${RET}','${IES}','${PROJ}','Retirado','444','r@x',null,now());
    INSERT INTO public.vertice_extension_hour_entries(project_id,student_id,entry_type,minutes,hour_state) VALUES
      ('${PROJ}','${ANA}','credit',600,'validada'),('${PROJ}','${ANA}','credit',300,'integralizada'),('${PROJ}','${ANA}','correction',-60,'validada'),
      ('${PROJ}','${BIA}','credit',480,'aguardando_validacao'),('${PROJ}','${CAIO}','credit',120,'validada'),('${PROJ}','${RET}','credit',900,'validada');
    INSERT INTO public.vertice_teaching_activities(id,institution_id,course_id,title,activity_date,status) VALUES
      ('${ACT}','${IES}','${DIR}','Júri simulado','2026-05-10','validada'),('${ACT_DRAFT}','${IES}','${DIR}','Rascunho','2026-05-11','rascunho');
    INSERT INTO public.vertice_student_registry VALUES ('${R1}','${IES}','Davi Alves','M1'),('${R2}','${IES}','Eva Costa','M2');
    INSERT INTO vertice_private.teaching_activity_students VALUES ('${ACT}','${R1}','participante',240,null),('${ACT}','${R2}','organizador',0,null),
      ('${ACT_DRAFT}','${R1}','participante',60,null);`);
  return db;
}
async function as(db, sub, sql, params = [], { aal = 'aal2', role = 'authenticated' } = {}) {
  await db.query(`select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claim.aal',$2,false), set_config('request.jwt.claim.role',$3,false)`, [sub ?? '', aal ?? '', role]);
  await db.exec(`SET ROLE ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('RESET ROLE'); }
}
const issue = (db, user, kind, src, opts) => as(db, user, 'select public.vertice_certificate_issue($1,$2,$3,$4) n', [kind, src, 'Profa. Maria Coordenadora', 'Coordenadora de Extensão'], opts);
const roster = (db, user, kind, src) => as(db, user, 'select public.vertice_certificate_roster($1,$2) r', [kind, src]);
const verify = (db, code, role = 'anon') => as(db, null, 'select public.vertice_certificate_verify($1) v', [code], { role, aal: null });

test('extensão: só horas validadas/integralizadas, com correção; retirado e horas não validadas ficam fora', async (t) => {
  const db = await setup(t);
  const r = (await roster(db, GESTOR, 'extensao', PROJ)).rows[0].r;
  assert.equal(r.title, 'Projeto Cidadania');
  assert.deepEqual(r.eligible.map((e) => [e.holderName, e.minutes, e.certificate]), [['Ana Souza', 840, null], ['Caio Reis', 120, null]]);
  assert.equal((await issue(db, GESTOR, 'extensao', PROJ)).rows[0].n, 2);
  assert.equal((await issue(db, GESTOR, 'extensao', PROJ)).rows[0].n, 0, 'idempotente');
  const certs = (await db.query("select holder_name, minutes, code, content_sha256, signer_name, issued_by, period_start::text from public.vertice_certificates order by holder_name")).rows;
  assert.equal(certs.length, 2);
  assert.match(certs[0].code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.notEqual(certs[0].code, certs[1].code);
  assert.match(certs[0].content_sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual([certs[0].minutes, certs[0].signer_name, certs[0].issued_by, certs[0].period_start], [840, 'Profa. Maria Coordenadora', GESTOR, '2026-03-01']);
});

test('ensino: só atividade validada e estudante com minutos; rascunho não emite', async (t) => {
  const db = await setup(t);
  assert.equal((await issue(db, COORD, 'ensino', ACT)).rows[0].n, 1);
  const c = (await db.query("select holder_name, minutes, course_id, activity_title from public.vertice_certificates")).rows;
  assert.deepEqual(c, [{ holder_name: 'Davi Alves', minutes: 240, course_id: DIR, activity_title: 'Júri simulado' }]);
  await assert.rejects(issue(db, COORD, 'ensino', ACT_DRAFT), /acesso negado/);
});

test('permissões: MFA, papel e IES; leitor e equipe de outro projeto não emitem', async (t) => {
  const db = await setup(t);
  await assert.rejects(issue(db, GESTOR, 'extensao', PROJ, { aal: 'aal1' }), /acesso negado/);
  await assert.rejects(issue(db, LEITOR, 'extensao', PROJ), /acesso negado/);
  await assert.rejects(issue(db, EQUIPE, 'extensao', PROJ), /acesso negado/); // equipe que não coordena o projeto
  await assert.rejects(issue(db, GESTOR_B, 'extensao', PROJ), /acesso negado/);
  await assert.rejects(issue(db, EQUIPE, 'ensino', ACT), /acesso negado/);
  await assert.rejects(roster(db, LEITOR, 'extensao', PROJ), /acesso negado/);
  await db.exec(`UPDATE public.vertice_extension_projects SET owner_id = '${EQUIPE}'`);
  assert.equal((await issue(db, EQUIPE, 'extensao', PROJ)).rows[0].n, 2); // responsável pelo projeto
  assert.equal((await issue(db, MASTER, 'ensino', ACT)).rows[0].n, 1);
  await assert.rejects(as(db, GESTOR, 'select public.vertice_certificate_issue($1,$2,$3,$4)', ['extensao', PROJ, 'X', 'Coordenadora']), /signatário/);
  await assert.rejects(as(db, GESTOR, 'select public.vertice_certificate_issue($1,$2,$3,$4)', ['diploma', PROJ, 'Maria', 'Coordenadora']), /tipo/);
});

test('verificação pública: só o impresso no certificado; código inexistente; revogação aparece', async (t) => {
  const db = await setup(t);
  await issue(db, GESTOR, 'extensao', PROJ);
  const { id: cid, code } = (await db.query("select id, code from public.vertice_certificates where holder_name='Ana Souza'")).rows[0];
  const v = (await verify(db, code.toLowerCase())).rows[0].v;
  assert.deepEqual(Object.keys(v).sort(), ['activityTitle', 'contentSha256', 'found', 'holderName', 'institution', 'issuedAt', 'kind', 'minutes',
    'periodEnd', 'periodStart', 'revokedAt', 'signerName', 'signerRole', 'status']);
  assert.equal(v.status, 'emitido'); assert.equal(v.institution, 'IES sintética'); assert.equal(v.minutes, 840);
  assert.ok(!JSON.stringify(v).includes('111') && !JSON.stringify(v).includes('ana@x'), 'sem CPF nem e-mail');
  assert.deepEqual((await verify(db, 'AAAA-BBBB-CCCC')).rows[0].v, { found: false });
  assert.deepEqual((await verify(db, null)).rows[0].v, { found: false });
  await assert.rejects(as(db, GESTOR, 'select public.vertice_certificate_revoke($1,$2)', [cid, 'ok']), /justificativa/);
  await assert.rejects(as(db, LEITOR, 'select public.vertice_certificate_revoke($1,$2)', [cid, 'Horas corrigidas']), /acesso negado/);
  await as(db, GESTOR, 'select public.vertice_certificate_revoke($1,$2)', [cid, 'Horas corrigidas após auditoria']);
  const after = (await verify(db, code)).rows[0].v;
  assert.equal(after.status, 'revogado'); assert.ok(after.revokedAt);
  await assert.rejects(as(db, GESTOR, 'select public.vertice_certificate_revoke($1,$2)', [cid, 'De novo, justificado']), /já revogado/);
  // Revogado libera nova emissão para o mesmo estudante, com código novo.
  assert.equal((await issue(db, GESTOR, 'extensao', PROJ)).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int n from public.vertice_certificates where holder_name='Ana Souza'")).rows[0].n, 2);
});

test('conteúdo imutável, sem exclusão; tabela fechada para a API; horas alteradas aparecem como desatualizadas', async (t) => {
  const db = await setup(t);
  await issue(db, GESTOR, 'extensao', PROJ);
  await assert.rejects(db.query("update public.vertice_certificates set minutes = 9999"), /imutável/);
  await assert.rejects(db.query("delete from public.vertice_certificates"), /revogue/);
  for (const role of ['anon', 'authenticated']) await assert.rejects(as(db, GESTOR, 'select * from public.vertice_certificates', [], { role }), /permission denied/);
  await assert.rejects(as(db, null, 'select public.vertice_certificate_issue($1,$2,$3,$4)', ['extensao', PROJ, 'Maria', 'Coordenadora'], { role: 'anon', aal: null }), /permission denied/);
  await db.exec(`INSERT INTO public.vertice_extension_hour_entries(project_id,student_id,entry_type,minutes,hour_state) VALUES ('${PROJ}','${CAIO}','credit',60,'validada')`);
  const caio = (await roster(db, GESTOR, 'extensao', PROJ)).rows[0].r.eligible.find((e) => e.holderName === 'Caio Reis');
  assert.equal(caio.minutes, 180); assert.equal(caio.certificate.minutes, 120); assert.equal(caio.certificate.outdated, true);
});
