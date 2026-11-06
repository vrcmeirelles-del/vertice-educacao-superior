/** Serial, synthetic, in-memory tests. No network, credentials, or real users. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const results = [];
const uid = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// Deterministic fixtures only, all tokens generated from TEST-ONLY strings.
const token = (n) => createHash('sha256').update(`NO-EXTERNAL-VALIDITY-fixture-${n}`).digest('base64url');
const digest = (n) => createHash('sha256').update(token(n)).digest('hex');
const scalar = async (sql, params = []) => (await db.query(sql, params)).rows[0]?.value;
const owner = async (sql, params = []) => db.query(sql, params);
async function asUser(n, work, { aal = 'aal2', role = 'authenticated' } = {}) {
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: n ? uid(n) : undefined, aal })]);
  await db.exec(`set role ${role}`);
  try { return await work(); } finally { await db.exec('reset role'); }
}
const rpc = async (name, params = []) => {
  const placeholders = params.map((_, i) => `$${i + 1}`).join(',');
  return (await db.query(`select public.${name}(${placeholders}) as value`, params)).rows[0].value;
};
const issue = async (email, n = 1, actor = 1) => asUser(actor, () => rpc('vertice_issue_master_invitation', [email, digest(n)]));
const preview = async (inv, actor, n = 1, opts) => asUser(actor, () => rpc('vertice_preview_master_invitation', [inv.id, token(n)]), opts);
const accept = async (inv, actor, n = 1, opts) => asUser(actor, () => rpc('vertice_accept_master_invitation', [inv.id, token(n)]), opts);
const revoke = async (inv, actor = 1) => asUser(actor, () => rpc('vertice_revoke_master_invitation', [inv.id]));
async function denied(work, message, code) {
  await assert.rejects(work, (error) => {
    assert.match(error.message, message);
    if (code) assert.equal(error.code, code);
    return true;
  });
}
async function test(name, work) {
  try {
    await work();
    results.push({ name, status: 'passed' });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: 'failed', error: error.message });
    console.error(`FAIL ${name}: ${error.message}`, error.where ?? '');
    throw error;
  }
}
const signatures = [
  'public.vertice_list_masters(integer,timestamptz,uuid)',
  'public.vertice_list_master_invitations(integer,timestamptz,uuid)',
  'public.vertice_issue_master_invitation(text,text)',
  'public.vertice_preview_master_invitation(uuid,text)',
  'public.vertice_accept_master_invitation(uuid,text)',
  'public.vertice_revoke_master_invitation(uuid)',
];
const counts = async () => ({
  masters: await scalar('select count(*)::int as value from public.vertice_admins'),
  invitations: await scalar('select count(*)::int as value from vertice_private.master_invitations'),
  audit: await scalar('select count(*)::int as value from vertice_private.master_invitation_audit'),
  legacyAudit: await scalar('select count(*)::int as value from public.vertice_audit'),
});
const list = async (kind, size = 50, time = null, id = null, actor = 1) => asUser(actor,
  () => db.query(`select * from public.vertice_list_${kind}($1,$2,$3)`, [size, time, id]));
const expire = async (inv) => owner(`update vertice_private.master_invitations
  set created_at = clock_timestamp() - interval '2 days', expires_at = clock_timestamp() - interval '1 day'
  where id = $1`, [inv.id]);

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema vertice_private;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
    grant usage on schema auth,vertice_private to authenticated,service_role;
    -- Minimal base copied from supabase/migrations/202610260001_access_foundation.sql.
    create table public.vertice_admins (
      user_id uuid primary key references auth.users(id) on delete cascade,
      created_at timestamptz not null default now()
    );
    create table public.vertice_audit (
      id bigint generated always as identity primary key,
      actor uuid, table_name text not null, action text not null,
      record_id text, occurred_at timestamptz not null default now()
    );
    create function vertice_private.is_master() returns boolean
    language sql stable security definer set search_path = '' as $$
      select coalesce((select auth.jwt()->>'aal') = 'aal2',false)
      and exists(select 1 from public.vertice_admins where user_id = (select auth.uid())); $$;
    revoke all on function vertice_private.is_master() from public,anon;
    grant execute on function vertice_private.is_master() to authenticated;
    alter table public.vertice_admins enable row level security;
    alter table public.vertice_audit enable row level security;
    revoke all on public.vertice_admins,public.vertice_audit from anon,authenticated;
    grant select on public.vertice_admins,public.vertice_audit to authenticated;
    create policy vertice_admin_self on public.vertice_admins for select to authenticated using(user_id=(select auth.uid()));
    create policy vertice_audit_read on public.vertice_audit for select to authenticated using(vertice_private.is_master());
    create function vertice_private.audit_change() returns trigger
    language plpgsql security definer set search_path = '' as $$
    begin
      insert into public.vertice_audit(actor,table_name,action,record_id)
      values(auth.uid(),tg_table_name,tg_op,coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'user_id',to_jsonb(old)->>'id',to_jsonb(old)->>'user_id'));
      return coalesce(new,old);
    end; $$;
    revoke all on function vertice_private.audit_change() from public,anon,authenticated;
    create trigger vertice_audit_admins after insert or update or delete on public.vertice_admins
    for each row execute function vertice_private.audit_change();
  `);
  for (let n = 1; n <= 30; n++) {
    await owner('insert into auth.users values($1,$2,$3)', [uid(n), `person-${n}@example.invalid`, n === 5 || n === 8 ? null : '2026-01-01T00:00:00Z']);
  }
  await owner('insert into public.vertice_admins(user_id) values($1),($2),($3)', [uid(1), uid(2), uid(8)]);
  // Model dangerous existing Supabase-style default privileges BEFORE proposal.
  // Schema usage is granted above so tests prove object ACL denial, not merely
  // accidental denial at the schema boundary. BYPASSRLS is intentionally real.
  await db.exec(`
    alter default privileges in schema public,vertice_private grant all on tables to service_role;
    alter default privileges in schema public,vertice_private grant all on sequences to service_role;
    alter default privileges in schema public,vertice_private grant all on functions to service_role;
  `);
  await test('harness reproduces service_role default grants and BYPASSRLS before fix', async () => {
    assert.equal(await scalar("select rolbypassrls as value from pg_roles where rolname='service_role'"), true);
    await db.exec(`
      create table vertice_private.test_default_acl_probe(id bigint generated always as identity primary key, enabled boolean default false);
      alter table vertice_private.test_default_acl_probe enable row level security;
      alter table vertice_private.test_default_acl_probe force row level security;
      create function vertice_private.test_default_acl_probe() returns boolean language sql as $$select true$$;
      insert into vertice_private.test_default_acl_probe(enabled) values(false);
    `);
    for (const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])
      assert.equal(await scalar("select has_table_privilege('service_role','vertice_private.test_default_acl_probe',$1) as value", [privilege]), true);
    assert.equal(await scalar("select has_sequence_privilege('service_role','vertice_private.test_default_acl_probe_id_seq','USAGE') as value"), true);
    assert.equal(await scalar("select has_function_privilege('service_role','vertice_private.test_default_acl_probe()','EXECUTE') as value"), true);
    await asUser(1, () => owner('update vertice_private.test_default_acl_probe set enabled=true'), { role: 'service_role' });
    assert.equal(await scalar('select enabled as value from vertice_private.test_default_acl_probe'), true);
    await db.exec('drop table vertice_private.test_default_acl_probe; drop function vertice_private.test_default_acl_probe();');
  });
  await db.exec(await readFile(new URL('./proposal.sql', import.meta.url), 'utf8'));

  await test('proposal parses and stays disabled; default 24-hour proposal', async () => {
    assert.equal(await scalar('select enabled as value from vertice_private.master_invitation_config'), false);
    assert.equal(await scalar("select lifetime = interval '24 hours' as value from vertice_private.master_invitation_config"), true);
  });
  await test('all six RPCs denied to PUBLIC, anon, authenticated and service_role by default', async () => {
    for (const role of ['anon', 'authenticated', 'service_role']) for (const signature of signatures)
      assert.equal(await scalar('select has_function_privilege($1,$2,\'EXECUTE\') as value', [role, signature]), false);
    await denied(() => asUser(1, () => rpc('vertice_list_masters', [50, null, null])), /permission denied/, '42501');
  });
  await test('private helpers revoked and all privileged functions have empty search_path', async () => {
    const functions = (await owner(`select n.nspname, p.proname, p.oid::regprocedure::text as signature,
      p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where (n.nspname = 'vertice_private' and p.proname like 'master_%')
         or (n.nspname = 'public' and p.proname in
         ('vertice_list_masters','vertice_list_master_invitations','vertice_issue_master_invitation',
          'vertice_preview_master_invitation','vertice_accept_master_invitation','vertice_revoke_master_invitation'))`)).rows;
    assert.equal(functions.length, 12);
    for (const f of functions) {
      assert(f.proconfig.some((value) => value === 'search_path=""'));
      for (const role of ['anon', 'authenticated', 'service_role'])
        assert.equal(await scalar('select has_function_privilege($1,$2,\'EXECUTE\') as value', [role, f.signature]), false);
    }
  });
  await test('service_role default ACL regression: config, invitations, ledger, sequence and helpers denied', async () => {
    for (const table of ['master_invitation_config', 'master_invitations', 'master_invitation_audit']) {
      for (const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])
        assert.equal(await scalar('select has_table_privilege(\'service_role\',$1,$2) as value', [`vertice_private.${table}`, privilege]), false);
      for (const sql of [`select * from vertice_private.${table}`, `delete from vertice_private.${table}`, `truncate vertice_private.${table}`])
        await denied(() => asUser(1, () => owner(sql), { role: 'service_role' }), /permission denied for table/, '42501');
    }
    for (const privilege of ['USAGE','SELECT','UPDATE'])
      assert.equal(await scalar('select has_sequence_privilege(\'service_role\',\'vertice_private.master_invitation_audit_id_seq\',$1) as value', [privilege]), false);
    await denied(() => asUser(1, () => owner("select nextval('vertice_private.master_invitation_audit_id_seq')"), { role: 'service_role' }), /permission denied for sequence/, '42501');
    await denied(() => asUser(1, () => owner('update vertice_private.master_invitation_config set enabled=true'), { role: 'service_role' }), /permission denied for table/, '42501');
    assert.equal(await scalar('select enabled as value from vertice_private.master_invitation_config'), false);
    await denied(() => asUser(1, () => owner(`insert into vertice_private.master_invitations(target_email,token_digest,issued_by,expires_at)
      values('forged@example.invalid',$1,$2,clock_timestamp()+interval '1 day')`, [digest(999), uid(1)]), { role: 'service_role' }), /permission denied for table/, '42501');
    await denied(() => asUser(1, () => owner('select vertice_private.master_request_actor()'), { role: 'service_role' }), /permission denied for function/, '42501');
    await owner('update vertice_private.master_invitation_config set enabled=true');
    try {
      await denied(() => asUser(1, () => rpc('vertice_list_masters', [50,null,null]), { role: 'service_role' }), /permission denied for function/, '42501');
      await denied(() => asUser(1, () => owner('select vertice_private.master_require_actor()'), { role: 'service_role' }), /permission denied for function/, '42501');
      await denied(() => asUser(1, () => owner('update vertice_private.master_invitation_config set enabled=false'), { role: 'service_role' }), /permission denied for table/, '42501');
    } finally { await owner('update vertice_private.master_invitation_config set enabled=false'); }
    assert.equal(await scalar('select count(*)::int as value from vertice_private.master_invitations'), 0);
  });
  // TEST-ONLY activation: grants below never appear in proposal.sql.
  await db.exec(`grant execute on function ${signatures.join(',')} to authenticated`);
  await test('config off denies every RPC even after isolated harness grants', async () => {
    for (const [name, params] of [
      ['vertice_list_masters', [50, null, null]], ['vertice_list_master_invitations', [50, null, null]],
      ['vertice_issue_master_invitation', ['person-4@example.invalid', digest(1)]],
      ['vertice_preview_master_invitation', [uid(100), token(1)]],
      ['vertice_accept_master_invitation', [uid(100), token(1)]], ['vertice_revoke_master_invitation', [uid(100)]],
    ]) await denied(() => asUser(1, () => rpc(name, params)), /master_invitations_disabled/);
  });
  await owner('update vertice_private.master_invitation_config set enabled = true');

  await test('non-Master cannot enumerate, issue, revoke or infer validation details', async () => {
    for (const [name, params] of [
      ['vertice_list_masters', [50, null, null]], ['vertice_list_master_invitations', [50, null, null]],
      ['vertice_issue_master_invitation', ['invalid', 'invalid']], ['vertice_revoke_master_invitation', [uid(100)]],
    ]) await denied(() => asUser(3, () => rpc(name, params)), /master_access_denied/, '42501');
  });
  await test('AAL1, missing AAL, missing subject, deleted identity and unconfirmed issuer denied', async () => {
    for (const [actor, options] of [[1, { aal: 'aal1' }], [1, { aal: null }], [null, {}], [99, {}], [8, {}]])
      await denied(() => asUser(actor, () => rpc('vertice_list_masters', [50, null, null]), options), /master_access_denied/, '42501');
    await denied(() => issue('person-4@example.invalid', 1, 8), /master_access_denied/);
  });
  await test('email/digest validation handles malicious, malformed and overlong values', async () => {
    const emails = [null, '', 'a@@example.invalid', '.a@example.invalid', 'a.@example.invalid',
      'a..b@example.invalid', 'a b@example.invalid', 'a\nb@example.invalid', 'a@example',
      'a@-example.invalid', 'a@example-.invalid', 'a@example..invalid', 'a@example.1',
      'a@example.123', 'a@example.i', `a@${'x'.repeat(64)}.invalid`, `${'a'.repeat(65)}@example.invalid`,
      `a@${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.invalid`,
      'a@exämple.invalid', 'a@example.invalid\r\nBcc:b@example.invalid', '"quoted"@example.invalid'];
    for (const email of emails) await denied(() => issue(email), /invalid_email/, '22023');
    for (const hash of [null, '', '0'.repeat(63), '0'.repeat(65), 'A'.repeat(64), 'z'.repeat(64)])
      await denied(() => asUser(1, () => rpc('vertice_issue_master_invitation', ['person-4@example.invalid', hash])), /invalid_token_digest/, '22023');
  });
  await test('issuer self and existing Master targets rejected', async () => {
    for (const n of [1, 2, 8]) await denied(() => issue(`person-${n}@example.invalid`), /master_target_unavailable/);
  });
  let invitation;
  await test('normalized issue audits but does not promote; return has no token/hash', async () => {
    const before = await counts();
    invitation = await issue('  PERSON-4@EXAMPLE.INVALID  ');
    assert.deepEqual(Object.keys(invitation).sort(), ['email', 'expires_at', 'id']);
    assert.equal(invitation.email, 'person-4@example.invalid');
    const after = await counts();
    assert.deepEqual(after, { ...before, invitations: before.invitations + 1, audit: before.audit + 1 });
    assert.equal(await scalar('select expires_at - created_at = interval \'24 hours\' as value from vertice_private.master_invitations where id=$1', [invitation.id]), true);
  });
  await test('duplicate open email denied across issuers and normalization', async () => {
    const before = await counts();
    await denied(() => issue(' Person-4@Example.Invalid ', 2, 2), /duplicate_master_invitation/);
    assert.deepEqual(await counts(), before);
  });
  await test('invalid tokens, stored hash and wrong recipients reveal no invitation data', async () => {
    for (const raw of [null, '', token(2), digest(1), token(1) + 'x', ' '.repeat(43)]) {
      await denied(() => asUser(4, () => rpc('vertice_preview_master_invitation', [invitation.id, raw])), /invitation_unavailable/);
      await denied(() => asUser(4, () => rpc('vertice_accept_master_invitation', [invitation.id, raw])), /invitation_unavailable/);
    }
    await denied(() => preview(invitation, 3), /invitation_unavailable/);
    await denied(() => accept(invitation, 3), /invitation_unavailable/);
    await denied(() => preview({ id: uid(999) }, 4), /invitation_unavailable/);
    await denied(() => preview(invitation, 1), /invitation_unavailable/);
    await denied(() => preview(invitation, 4, 1, { aal: 'aal1' }), /master_access_denied/);
    await denied(() => accept(invitation, 4, 1, { aal: 'aal1' }), /master_access_denied/);
  });
  await test('confirmed target exact normalized identity required, not JWT email claim', async () => {
    const inv = await issue('person-5@example.invalid', 5);
    await denied(() => preview(inv, 5, 5), /invitation_unavailable/);
    await denied(() => accept(inv, 5, 5), /invitation_unavailable/);
    await owner('update auth.users set email=$1 where id=$2', ['changed@example.invalid', uid(4)]);
    await denied(() => accept(invitation, 4), /invitation_unavailable/);
    await owner('update auth.users set email=$1 where id=$2', ['PERSON-4@EXAMPLE.INVALID', uid(4)]);
  });
  await test('preview has exact safe response and changes no rows or audits', async () => {
    const before = await counts();
    assert.deepEqual(await preview(invitation, 4), invitation);
    assert.deepEqual(await counts(), before);
  });
  await test('acceptance grants once and atomically writes consumption plus both audits', async () => {
    const before = await counts();
    assert.deepEqual(await accept(invitation, 4), { id: invitation.id, user_id: uid(4), accepted: true });
    assert.deepEqual(await counts(), { ...before, masters: before.masters + 1, audit: before.audit + 1, legacyAudit: before.legacyAudit + 1 });
    const audit = (await owner("select * from vertice_private.master_invitation_audit where invitation_id=$1 and event='accepted'", [invitation.id])).rows[0];
    assert.equal(audit.actor_user_id, uid(4)); assert.equal(audit.recipient_user_id, uid(4));
    assert.equal(audit.issuer_user_id, uid(1)); assert.equal(audit.target_email, 'person-4@example.invalid');
    assert.equal(await scalar('select accepted_by as value from vertice_private.master_invitations where id=$1', [invitation.id]), uid(4));
  });
  await test('consumed invitation cannot be previewed, reused or revoked', async () => {
    const before = await counts();
    await denied(() => preview(invitation, 4), /invitation_unavailable/);
    await denied(() => accept(invitation, 4), /invitation_unavailable/);
    await denied(() => revoke(invitation), /invitation_unavailable/);
    assert.deepEqual(await counts(), before);
  });
  await test('revocation is authorized, idempotent, audited once and blocks preview/accept', async () => {
    const inv = await issue('person-6@example.invalid', 6);
    await denied(() => revoke(inv, 3), /master_access_denied/);
    const before = await counts();
    assert.deepEqual(await revoke(inv, 2), { id: inv.id, revoked: true });
    assert.deepEqual(await revoke(inv, 1), { id: inv.id, revoked: true });
    assert.deepEqual(await counts(), { ...before, audit: before.audit + 1 });
    await denied(() => preview(inv, 6, 6), /invitation_unavailable/);
    await denied(() => accept(inv, 6, 6), /invitation_unavailable/);
  });
  await test('expired invitation blocked and only explicit fresh issue closes old record', async () => {
    const inv = await issue('person-7@example.invalid', 7); await expire(inv);
    const before = await counts();
    await denied(() => preview(inv, 7, 7), /invitation_unavailable/);
    await denied(() => accept(inv, 7, 7), /invitation_unavailable/);
    assert.deepEqual(await counts(), before);
    const fresh = await issue('person-7@example.invalid', 70);
    assert.notEqual(fresh.id, inv.id);
    assert.equal(await scalar('select revoked_reason as value from vertice_private.master_invitations where id=$1', [inv.id]), 'expired_replaced');
    assert.deepEqual(await counts(), { ...before, invitations: before.invitations + 1, audit: before.audit + 2 });
    await denied(() => accept(inv, 7, 7), /invitation_unavailable/);
    assert.deepEqual(await preview(fresh, 7, 70), fresh);
  });
  await test('removed issuer authority invalidates pending invitation immediately', async () => {
    const inv = await issue('person-9@example.invalid', 9, 2);
    await owner('delete from public.vertice_admins where user_id=$1', [uid(2)]);
    await denied(() => preview(inv, 9, 9), /invitation_unavailable/);
    await denied(() => accept(inv, 9, 9), /invitation_unavailable/);
    await owner('insert into public.vertice_admins(user_id) values($1)', [uid(2)]);
  });
  await test('issuer identity deletion or lost confirmation invalidates pending invitation', async () => {
    const inv = await issue('person-10@example.invalid', 10, 2);
    await owner('update auth.users set email_confirmed_at=null where id=$1', [uid(2)]);
    await denied(() => accept(inv, 10, 10), /invitation_unavailable/);
    await owner("update auth.users set email_confirmed_at='2026-01-01' where id=$1", [uid(2)]);
    await owner('insert into public.vertice_admins(user_id) values($1)', [uid(11)]);
    const deletedIssuer = await issue('person-12@example.invalid', 12, 11);
    await owner('delete from auth.users where id=$1', [uid(11)]);
    await denied(() => accept(deletedIssuer, 12, 12), /invitation_unavailable/);
  });
  await test('already-promoted recipient and deleted recipient cannot accept', async () => {
    const inv = await issue('person-13@example.invalid', 13);
    await owner('insert into public.vertice_admins(user_id) values($1)', [uid(13)]);
    await denied(() => preview(inv, 13, 13), /invitation_unavailable/);
    await denied(() => accept(inv, 13, 13), /invitation_unavailable/);
    const deletedRecipient = await issue('person-14@example.invalid', 14);
    await owner('delete from auth.users where id=$1', [uid(14)]);
    await denied(() => accept(deletedRecipient, 14, 14), /invitation_unavailable/);
  });
  await test('audit failure rolls back grant, consumption and existing audit trigger together', async () => {
    const inv = await issue('person-15@example.invalid', 15);
    await db.exec(`create function vertice_private.test_fail_audit() returns trigger language plpgsql as $$
      begin if new.event='accepted' then raise exception 'TEST_ONLY_audit_failure'; end if; return new; end $$;
      create trigger test_fail_audit before insert on vertice_private.master_invitation_audit
      for each row execute function vertice_private.test_fail_audit();`);
    const before = await counts();
    await denied(() => accept(inv, 15, 15), /TEST_ONLY_audit_failure/);
    assert.deepEqual(await counts(), before);
    assert.equal(await scalar('select accepted_at as value from vertice_private.master_invitations where id=$1', [inv.id]), null);
    await db.exec('drop trigger test_fail_audit on vertice_private.master_invitation_audit; drop function vertice_private.test_fail_audit();');
    assert.equal((await accept(inv, 15, 15)).accepted, true);
  });
  await test('caller transaction rollback erases issuance and audit', async () => {
    const before = await counts();
    await db.exec('begin');
    try { await issue('person-16@example.invalid', 16); } finally { await db.exec('rollback'); }
    assert.deepEqual(await counts(), before);
  });
  await test('direct private tables deny all clients; RLS still denies after accidental grant', async () => {
    for (const table of ['master_invitation_config', 'master_invitations', 'master_invitation_audit']) {
      await denied(() => asUser(1, () => owner(`select * from vertice_private.${table}`)), /permission denied/, '42501');
      await denied(() => asUser(1, () => owner(`delete from vertice_private.${table}`)), /permission denied/, '42501');
      await denied(() => asUser(null, () => owner(`select * from vertice_private.${table}`), { role: 'anon' }), /permission denied/, '42501');
      await db.exec(`grant select on vertice_private.${table} to authenticated`);
      assert.deepEqual((await asUser(1, () => owner(`select * from vertice_private.${table}`))).rows, []);
      await db.exec(`revoke select on vertice_private.${table} from authenticated`);
    }
    await db.exec('grant insert on vertice_private.master_invitation_config to authenticated');
    await denied(() => asUser(1, () => owner('insert into vertice_private.master_invitation_config(singleton) values(true)')), /row-level security/, '42501');
    await db.exec('revoke insert on vertice_private.master_invitation_config from authenticated');
    await denied(() => asUser(1, () => owner('insert into public.vertice_admins(user_id) values($1)', [uid(20)])), /permission denied/, '42501');
  });
  await test('private audit rejects update, delete and truncate including owner attempts', async () => {
    await denied(() => owner("update vertice_private.master_invitation_audit set event='revoked'"), /master_audit_immutable/, '42501');
    await denied(() => owner('delete from vertice_private.master_invitation_audit'), /master_audit_immutable/, '42501');
    await denied(() => owner('truncate vertice_private.master_invitation_audit'), /master_audit_immutable/, '42501');
  });
  await test('pagination validates limits, complete cursor and finite timestamps', async () => {
    for (const kind of ['masters', 'master_invitations']) {
      for (const size of [null, 0, -1, 101]) await denied(() => list(kind, size), /invalid_pagination/, '22023');
      await denied(() => list(kind, 50, '2026-01-01', null), /invalid_pagination/, '22023');
      await denied(() => list(kind, 50, null, uid(1)), /invalid_pagination/, '22023');
      for (const time of ['infinity', '-infinity']) await denied(() => list(kind, 50, time, uid(1)), /invalid_pagination/, '22023');
    }
  });
  await test('keyset pages deterministic without duplicates or skips on timestamp ties', async () => {
    await owner("update public.vertice_admins set created_at='2026-01-01T00:00:00Z'");
    await owner("update vertice_private.master_invitations set created_at='2026-01-01T00:00:00Z'");
    for (const kind of ['masters', 'master_invitations']) {
      const expected = (await list(kind, 100)).rows;
      const rows = []; let time = null; let id = null;
      do {
        const page = (await list(kind, 2, time, id)).rows;
        if (!page.length) break;
        rows.push(...page); const tail = page.at(-1);
        time = tail.created_at; id = kind === 'masters' ? tail.user_id : tail.id;
      } while (rows.length <= 100);
      assert.deepEqual(rows, expected);
      assert.equal(new Set(rows.map((row) => row.user_id ?? row.id)).size, rows.length);
    }
  });
  await test('listing and audit schemas exclude raw token and hash', async () => {
    const rows = (await list('master_invitations', 100)).rows;
    for (const row of rows) assert.deepEqual(Object.keys(row).sort(), ['accepted_at','created_at','expires_at','id','revoked_at','target_email']);
    const json = JSON.stringify({ rows, audit: (await owner('select * from vertice_private.master_invitation_audit')).rows });
    assert(!json.includes('token')); assert(!json.includes('digest'));
    for (let n = 1; n <= 30; n++) { assert(!json.includes(token(n))); assert(!json.includes(digest(n))); }
  });
  await test('disabling feature after issuance blocks acceptance without consuming invitation', async () => {
    const inv = await issue('person-17@example.invalid', 17);
    await owner('update vertice_private.master_invitation_config set enabled = false');
    const before = await counts();
    await denied(() => accept(inv, 17, 17), /master_invitations_disabled/);
    assert.deepEqual(await counts(), before);
    assert.equal(await scalar('select accepted_at as value from vertice_private.master_invitations where id=$1', [inv.id]), null);
  });
} finally {
  await writeFile(new URL('./sql-test-results.json', import.meta.url), JSON.stringify({
    engine: 'PGlite 0.3.14, in-memory, serial', production_access: false,
    actual_concurrent_sessions_tested: false, results,
  }, null, 2) + '\n');
  await db.close();
}
console.log(`\n${results.length} serial test groups passed. No deployment, external calls or actual concurrency test.`);
