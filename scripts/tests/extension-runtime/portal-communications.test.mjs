import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db;
const q = (s, ...v) => db.query(s, v);
const value = async (s, ...v) => (await q(s, ...v)).rows[0]?.v;
const actor = async (n, aal = "aal2") => {
  await db.exec("reset role");
  await q(
    "select set_config('test.actor',$1,false),set_config('test.aal',$2,false)",
    id(n),
    aal,
  );
  await db.exec("set role authenticated");
};
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema vertice_private;create schema vertice_onboarding;
 create function auth.uid() returns uuid language sql stable as $$select current_setting('test.actor',true)::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('test.aal',true))$$;
 create table auth.users(id uuid primary key,email text);
 create table vertice_institutions(id uuid primary key);create table vertice_courses(id uuid primary key,institution_id uuid);
 create table vertice_memberships(user_id uuid,institution_id uuid,role text);
 create table vertice_invites(id uuid primary key default gen_random_uuid(),institution_id uuid,email text,role text,created_by uuid,created_at timestamptz default now(),accepted_at timestamptz,unique(institution_id,email));
 create function vertice_private.is_master() returns boolean language sql stable as $$select auth.uid()='${id(1)}'::uuid$$;
 create function vertice_private.member_role(i uuid) returns text language sql stable security definer as $$select case when auth.jwt()->>'aal'='aal2' then (select role from public.vertice_memberships where user_id=auth.uid() and institution_id=i) end$$;
 create table vertice_onboarding.settings(enabled boolean);insert into vertice_onboarding.settings values(true);
 create function vertice_onboarding.actor() returns uuid language plpgsql as $$begin if not (select enabled from vertice_onboarding.settings) then raise exception 'feature_disabled';end if;return auth.uid();end;$$;
 create table vertice_onboarding.invitations(id uuid,institution_id uuid,course_id uuid,recipient_email text,role text,token_hash text,status text,expires_at timestamptz);
 create function vertice_onboarding.can_manage(u uuid,i uuid,r text) returns boolean language sql stable as $$select coalesce(vertice_private.member_role(i) in ('master','gestor'),false)$$;
 create table vertice_private.master_invitations(id uuid,target_email text,token_digest text,revoked_at timestamptz,accepted_at timestamptz,expires_at timestamptz);
 create table vertice_experience_invites(id uuid,target_email text,token_digest text,revoked_at timestamptz,expires_at timestamptz);
 grant usage on schema public to authenticated,service_role,anon;`);
  await db.exec(
    readFileSync(
      new URL(
        "../../../supabase/migrations/20261118140255_portal_communications.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await q("insert into vertice_institutions values($1),($2)", id(11), id(12));
  await q(
    "insert into vertice_courses values($1,$2),($3,$4)",
    id(21),
    id(11),
    id(22),
    id(12),
  );
  await q(
    "insert into vertice_memberships values($1,$2,'master'),($3,$2,'gestor'),($4,$2,'equipe')",
    id(1),
    id(11),
    id(2),
    id(3),
  );
});
after(async () => db.close());
const invite = (inst = 11, role = "equipe", course = 21) =>
  value(
    "select vertice_portal_prepare_invite($1,$2,$3,$4) v",
    id(inst),
    "recipient@example.org",
    role,
    id(course),
  );
test("convite exige gestão da IES e MFA e recusa curso de outra instituição", async () => {
  await actor(3);
  await assert.rejects(invite(), /invitation_denied/);
  await actor(1, "aal1");
  await assert.rejects(invite(), /invitation_denied/);
  await actor(2);
  await assert.rejects(invite(11, "gestor"), /invitation_denied/);
  await assert.rejects(invite(11, "equipe", 22), /course_scope_invalid/);
  await assert.rejects(invite(12, "equipe", 22), /invitation_denied/);
});
test("emissão não concede membership nem cria senha; conta vinculada não é rebaixada", async () => {
  await actor(1);
  assert.equal((await invite()).existing_member, false);
  await db.exec("reset role");
  assert.equal(
    await value("select count(*)::int v from vertice_memberships"),
    3,
  );
  await q("insert into auth.users values($1,'recipient@example.org')", id(4));
  await q(
    "insert into vertice_memberships values($1,$2,'gestor')",
    id(4),
    id(11),
  );
  await actor(1);
  assert.equal((await invite()).existing_member, true);
  await db.exec("reset role");
  assert.equal(
    await value(
      "select role v from vertice_memberships where user_id=$1",
      id(4),
    ),
    "gestor",
  );
});
test("somente serviço registra envio; duplicata e conflito são distintos", async () => {
  const p = {
    id: id(51),
    institution_id: id(11),
    course_id: id(21),
    module: "tcc",
    actor_id: id(1),
    recipient_digest: "a".repeat(64),
    fingerprint: "b".repeat(64),
  };
  await actor(1);
  await assert.rejects(
    value("select vertice_email_delivery('claim',$1) v", p),
    /permission denied/,
  );
  await db.exec("reset role;set role service_role");
  assert.equal(
    (await value("select vertice_email_delivery('claim',$1) v", p)).claimed,
    true,
  );
  assert.equal(
    (await value("select vertice_email_delivery('claim',$1) v", p)).claimed,
    false,
  );
  await assert.rejects(
    value("select vertice_email_delivery('claim',$1) v", {
      ...p,
      module: "estagio",
    }),
    /request_conflict/,
  );
  assert.equal(
    (
      await value("select vertice_email_delivery('finish',$1) v", {
        id: p.id,
        status: "accepted",
        provider_id: "synthetic",
      })
    ).status,
    "accepted",
  );
  await assert.rejects(
    value("select vertice_email_delivery('finish',$1) v", {
      id: p.id,
      status: "failed",
    }),
    /outcome_already_recorded/,
  );
});
test("histórico é segregado por IES/curso e não expõe destinatário ou corpo", async () => {
  await actor(2);
  const h = await value(
    "select vertice_portal_email_history($1,null,$2) v",
    id(11),
    id(21),
  );
  assert.equal(h.length, 1);
  assert.equal(h[0].status, "accepted");
  assert.ok(!JSON.stringify(h).includes("recipient_digest"));
  await assert.rejects(
    value("select vertice_portal_email_history($1) v", id(12)),
    /email_management_denied/,
  );
  await actor(3);
  await assert.rejects(
    value("select vertice_portal_email_history($1) v", id(11)),
    /email_management_denied/,
  );
});
test("encaminhamento nativo exige hash, validade e autorização; não altera convite", async () => {
  await db.exec("reset role");
  await q(
    "insert into vertice_onboarding.invitations values($1,$2,$3,'recipient@example.org','coordenador',$4,'pending',now()+interval '1 day')",
    id(71),
    id(11),
    id(21),
    "c".repeat(64),
  );
  await actor(1);
  const call = (hash) =>
    value("select vertice_portal_email_native('ies',$1,$2) v", id(71), hash);
  await assert.rejects(call("d".repeat(64)), /invitation_unavailable/);
  assert.equal((await call("c".repeat(64))).course_id, id(21));
  await actor(3);
  await assert.rejects(call("c".repeat(64)), /invitation_denied/);
  await actor(1, "aal1");
  await assert.rejects(call("c".repeat(64)), /invitation_denied/);
  await db.exec(
    "reset role;update vertice_onboarding.settings set enabled=false",
  );
  await actor(1);
  await assert.rejects(call("c".repeat(64)), /feature_disabled/);
});
