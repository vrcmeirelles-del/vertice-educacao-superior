import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
const root = path.resolve('.');
const { Client } = await import(path.join(root, 'scripts/tests/runtime/node_modules/pg/lib/index.js')).then(m => m.default || m);
const { createClient } = await import(path.join(root, '.captacao-build/node_modules/@supabase/supabase-js/dist/index.mjs'));
const { build } = await import(path.join(root, '.captacao-build/node_modules/esbuild/lib/main.js'));
// Read generated LOCAL settings silently: never print keys, tokens, passwords or TOTP secrets.
const settings = JSON.parse(execFileSync('npx', ['--yes', 'supabase@3.1.0', 'status', '--workdir', '.captacao-stack', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }));
assert.equal(new URL(settings.API_URL).hostname, '127.0.0.1');
assert(['127.0.0.1', 'localhost'].includes(new URL(settings.DB_URL).hostname));
const publicKey = settings.ANON_KEY || settings.PUBLISHABLE_KEY;
const adminKey = settings.SERVICE_ROLE_KEY || settings.SECRET_KEY;
assert(publicKey && adminKey);
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(settings.API_URL, adminKey, options);
const db = new Client({ connectionString: settings.DB_URL });
await db.connect();
const results = [];
const pass = name => { results.push({ name, result: 'pass' }); console.log('PASS REAL ' + name); };
const iesA = 'bb000000-0000-4000-8000-000000000001', iesB = 'bb000000-0000-4000-8000-000000000002', archived = 'bb000000-0000-4000-8000-000000000003';
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret.replace(/=+$/,'').toUpperCase()].map(ch => { const n = alphabet.indexOf(ch); assert(n >= 0); return n.toString(2).padStart(5,'0'); }).join('');
  const key = Buffer.from((bits.match(/.{8}/g) || []).map(byte => parseInt(byte,2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const digest = createHmac('sha1',key).update(counter).digest(), offset = digest[19] & 15;
  return ((digest.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
}
function ok(response) { assert.equal(response.error, null, response.error?.message); return response.data; }
const clients = {}, sessions = {}, users = {};
try {
  await db.query(readFileSync('supabase/tests/captacao_integrada.sql','utf8'));
  pass('PostgreSQL 17: transactional security suite, 100 duplicate attempts and rollback');
  await db.query('insert into public.vertice_institutions(id,name,status) values ($1,$2,$3),($4,$5,$3),($6,$7,$8)', [iesA,'IES sintética A','ativa',iesB,'IES sintética B',archived,'IES arquivada','arquivada']);
  for (const name of ['managerA','managerB','reader','master','noMfa']) {
    const password = randomBytes(24).toString('base64url') + 'aA1!';
    const email = `${name.toLowerCase()}@captacao.example.invalid`;
    const created = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
    users[name] = created.user.id;
    const client = createClient(settings.API_URL, publicKey, options); clients[name] = client;
    ok(await client.auth.signInWithPassword({ email, password }));
    if (name !== 'noMfa') {
      const enrolled = ok(await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Synthetic CI only' }));
      const challenge = ok(await client.auth.mfa.challenge({ factorId: enrolled.id }));
      ok(await client.auth.mfa.verify({ factorId: enrolled.id, challengeId: challenge.id, code: totp(enrolled.totp.secret) }));
    }
    const session = ok(await client.auth.getSession()).session;
    assert(session);
    const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString());
    assert.equal(claims.aal, name === 'noMfa' ? 'aal1' : 'aal2');
    sessions[name] = { access_token: session.access_token, refresh_token: session.refresh_token };
    if (name === 'master') await db.query('insert into public.vertice_admins(user_id) values($1)',[users[name]]);
    else await db.query('insert into public.vertice_memberships(user_id,institution_id,role) values($1,$2,$3)',[users[name],name === 'managerB' ? iesB : iesA,name === 'reader' ? 'leitor' : 'gestor']);
  }
  pass('Auth: five synthetic logins, four real TOTP enroll/challenge/verify, AAL1/AAL2 checked');
  const sdk = clients.managerA;
  assert.equal(ok(await sdk.rpc('vertice_captacao_access',{p_institution:iesA})),true);
  for (const name of ['reader','noMfa']) {
    assert.equal(ok(await clients[name].rpc('vertice_captacao_access',{p_institution:iesA})),false);
    assert.deepEqual(ok(await clients[name].from('vertice_captacao_connections').select('*')),[]);
    const denied = await clients[name].from('vertice_captacao_connections').insert({institution_id:iesA,provider:'meta',label:'Forbidden',public_url:'https://instagram.com/synthetic'});
    assert.equal(denied.error?.code,'42501');
  }
  pass('REST: reader and genuine AAL1 session cannot read or create setup');
  // Run the PRODUCT library against real Supabase SDK clients, replacing only deployment config.
  const bundled = await build({ entryPoints:['source-overrides/client/src/lib/captacao-integrada.ts'],bundle:true,platform:'node',format:'esm',write:false,
    plugins:[{name:'local-test-client',setup(builder){builder.onResolve({filter:/^\.\/supabase$/},()=>({path:'local-client',namespace:'synthetic'}));builder.onLoad({filter:/.*/,namespace:'synthetic'},()=>({contents:'export const supabase = globalThis.__CAPTACAO_LOCAL_CLIENT;'}));}}] });
  const modulePath = path.join(root,'.captacao-build/captacao-real-lib.mjs'); writeFileSync(modulePath,bundled.outputFiles[0].text);
  globalThis.__CAPTACAO_LOCAL_CLIENT = sdk;
  const lib = await import(modulePath + '?managerA'); delete globalThis.__CAPTACAO_LOCAL_CLIENT;
  const connection = await lib.createCaptacaoConnection(iesA,randomUUID(),{provider:'meta',label:'Conta API A',public_url:'https://instagram.com/synthetic',account_external_id:'111'});
  assert.equal(connection.status,'prepared');assert.equal(connection.last_successful_sync_at,null);
  const payload = {connection_id:connection.id,name:'Campanha API',public_url:'https://ies.example.invalid/vestibular',external_campaign_id:null,capture_mode:'landing',form_asset_id:null,status:'draft'};
  const key = randomUUID();
  const repeated = await Promise.all([lib.createCaptacaoCampaign(iesA,key,payload),lib.createCaptacaoCampaign(iesA,key,payload)]);
  assert.equal(repeated[0].id,repeated[1].id);
  assert.equal((await db.query('select count(*)::int as n from vertice_private.captacao_setup_audit where record_id=$1',[key])).rows[0].n,1);
  pass('PRODUCT library + REST: simultaneous create/retry returns one campaign and one audit entry');
  await assert.rejects(lib.createCaptacaoCampaign(iesA,key,{...payload,name:'Changed replay'}),lib.CaptacaoConflict);
  const edits = await Promise.allSettled([lib.updateCaptacaoCampaign(repeated[0],{...payload,name:'Winner one'}),lib.updateCaptacaoCampaign(repeated[0],{...payload,name:'Winner two'})]);
  assert.equal(edits.filter(r=>r.status==='fulfilled').length,1);assert.equal(edits.filter(r=>r.status==='rejected' && r.reason instanceof lib.CaptacaoConflict).length,1);
  pass('PRODUCT library + REST: changed replay rejected; competing edits have exactly one winner');
  const claims = JSON.parse(Buffer.from(sessions.managerA.access_token.split('.')[1],'base64url').toString());
  const one = new Client({connectionString:settings.DB_URL,application_name:'captacao-session1'}), two = new Client({connectionString:settings.DB_URL,application_name:'captacao-session2'});
  await one.connect(); await two.connect();
  try {
    for (const client of [one,two]) { await client.query('begin'); await client.query('set local role authenticated'); await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]); }
    const first = await one.query('update public.vertice_captacao_campaigns set name=$1,version=3 where id=$2 and version=2 returning id',['Native winner',key]);
    const pending = two.query('update public.vertice_captacao_campaigns set name=$1,version=3 where id=$2 and version=2 returning id',['Native stale',key]);
    let locked = false;
    for (let i=0;i<80;i++) { if ((await db.query("select 1 from pg_stat_activity where application_name='captacao-session2' and wait_event_type='Lock'")).rowCount) {locked=true;break;} await new Promise(resolve=>setTimeout(resolve,25)); }
    assert(locked,'second database session must actually wait on row lock');
    await one.query('commit'); const second = await pending; await two.query('commit');
    assert.equal(first.rowCount,1);assert.equal(second.rowCount,0);
  } finally { await one.query('rollback').catch(()=>{});await two.query('rollback').catch(()=>{});await one.end();await two.end(); }
  pass('PostgreSQL two live sessions: observed lock contention; stale snapshot cannot overwrite');
  const other = ok(await clients.managerB.from('vertice_captacao_connections').insert({institution_id:iesB,provider:'meta',label:'Conta B',public_url:'https://instagram.com/syntheticb',account_external_id:'111'}).select().single());
  assert.deepEqual(ok(await sdk.from('vertice_captacao_connections').select('*').eq('institution_id',iesB)),[]);
  assert.deepEqual(ok(await sdk.from('vertice_captacao_connections').update({label:'Forbidden update',version:2}).eq('id',other.id).select()),[]);
  assert.equal((await sdk.from('vertice_captacao_connections').insert({institution_id:iesB,provider:'meta',label:'Cross IES',public_url:'https://instagram.com/synthetic'})).error?.code,'42501');
  assert.equal((await clients.master.from('vertice_captacao_campaigns').insert({...payload,institution_id:iesB})).error?.code,'23503');
  assert.equal((await clients.master.from('vertice_captacao_connections').insert({institution_id:archived,provider:'meta',label:'Archived',public_url:'https://instagram.com/synthetic'})).error?.code,'42501');
  pass('REST: tenant read/update/insert blocked, composite FK rejects cross-tenant parent, archived IES blocked');
  assert.equal((await sdk.from('vertice_captacao_connections').update({status:'active'}).eq('id',connection.id)).error?.code,'42501');
  assert.equal((await sdk.from('vertice_captacao_connections').update({last_successful_sync_at:new Date().toISOString()}).eq('id',connection.id)).error?.code,'42501');
  assert.equal((await sdk.from('vertice_captacao_connections').update({label:'No version'}).eq('id',connection.id)).error?.code,'40001');
  assert.equal((await sdk.from('vertice_captacao_connections').delete().eq('id',connection.id)).error?.code,'42501');
  pass('REST: technical facts, missing CAS and deletion rejected');
  const anonymous = createClient(settings.API_URL,publicKey,options);
  assert.equal((await anonymous.from('vertice_captacao_connections').select('*')).error?.code,'42501');
  const badJwt = await fetch(settings.API_URL+'/rest/v1/vertice_captacao_connections',{headers:{apikey:publicKey,Authorization:'Bearer invalid.jwt.signature'}});
  assert.equal(badJwt.status,401);
  pass('REST: anonymous table access denied and invalid JWT rejected');
  const directory = path.join(root,'.captacao-build/captacao-ui');mkdirSync(directory,{recursive:true});
  writeFileSync(path.join(directory,'session-fixtures.json'),JSON.stringify({url:settings.API_URL,key:publicKey,iesA,iesB,sessions}));
  const evidenceDirectory = process.env.CAPTACAO_EVIDENCE_DIR || path.join(root,'.captacao-build/captacao-evidence');mkdirSync(evidenceDirectory,{recursive:true});
  writeFileSync(path.join(evidenceDirectory,'backend-results.json'),JSON.stringify({head:process.env.TEST_HEAD_SHA,environment:'ephemeral local Supabase, PostgreSQL 17, Auth TOTP and PostgREST',tests:results},null,2));
  console.log(`PASS REAL integration: ${results.length} groups. Synthetic browser sessions prepared without exposing administrative keys.`);
} finally { for (const client of Object.values(clients)) client.auth.stopAutoRefresh();await db.end(); }
