import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../../../supabase/migrations/20261118131741_teaching_fo_metrics.sql', import.meta.url), 'utf8');
const id = n => '93000000-0000-4000-8000-'+String(n).padStart(12,'0');
const [a,b,c1,c2,c3,school,cs] = Array.from({length:7}, (_,i)=>id(i+1));
const rpc = (db, institution=a, course=c1, semester=null, module=null) =>
  db.query('select * from public.vertice_teaching_fo_metrics($1,$2,$3,$4)', [institution,course,semester,module]);
const grants = (db, profile='manager', aal='aal2') =>
  db.exec(`reset role; set s.profile='${profile}'; set s.aal='${aal}'; set role authenticated`);

test('Fato & Ordem de Ensino lê apenas agregados já mapeados, no cruzamento de escopos', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema vertice_private;
      grant usage on schema vertice_private to authenticated;
      create table public.course_fixture(id uuid,institution_id uuid,tier text);
      insert into public.course_fixture values
        ('${c1}','${a}','superior'),('${c2}','${a}','superior'),('${c3}','${b}','superior'),('${cs}','${school}','escolas');
      create function vertice_private.teaching_access(inst uuid,course uuid,operation text) returns boolean
      language sql stable security definer set search_path='' as $$
        select coalesce(current_setting('s.aal',true)='aal2' and inst='${a}' and operation='read'
          and (current_setting('s.profile',true)='manager' or course='${c1}')
          and exists(select 1 from public.course_fixture where id=course and institution_id=inst and tier='superior'),false)
      $$;
      create table public.vertice_learning_course_metrics(
        institution_id uuid,course_id uuid,semester text,subject_code text,module text,
        competency text,participants int, attempts int, graded int,correct int,
        updated_at timestamptz default now(), secret_tag text default 'NEVER SELECT THIS'
      );
      alter table public.vertice_learning_course_metrics enable row level security;
      grant select on public.vertice_learning_course_metrics to authenticated;
      create policy metrics_native_read on public.vertice_learning_course_metrics for select to authenticated using (
        current_setting('s.aal',true)='aal2'
        and (current_setting('s.profile',true)='manager' or subject_code='PERMITTED')
      );
      insert into public.vertice_learning_course_metrics(institution_id,course_id,semester,subject_code,module,competency,participants,attempts,graded,correct) values
       ('${a}','${c1}','2026/2','PERMITTED','oab','Civil',5,20,18,12),
       ('${a}','${c1}','2026/1','PERMITTED','residencia','Clínica',5,5,0,0),
       ('${a}','${c1}','2026/2','OTHER','enamed','Outra disciplina',5,10,10,7),
       ('${a}','${c1}','2026/2','PERMITTED','cfc','Abaixo do mínimo',4,5,5,4),
       ('${a}','${c1}','2026/2','PERMITTED','enem','Não é Superior',8,20,20,20),
       ('${a}','${c2}','2026/2','PERMITTED','oab','Outro curso',6,6,6,6),
       ('${b}','${c3}','2026/2','PERMITTED','oab','Outra IES',5,99,99,99),
       ('${school}','${cs}','2026/2','PERMITTED','enem','Escola',6,6,6,6);
    `);
    await db.exec(migration);

    await t.test('gestão vê somente métricas do curso, exclui ENEM e coortes menores e pode aplicar filtros', async () => {
      await grants(db);
      const { rows } = await rpc(db);
      assert.deepEqual(rows.map(r=>r.module), ['enamed','oab','residencia']);
      assert.ok(!Object.keys(rows[0]).includes('secret_tag'));
      assert.deepEqual((await rpc(db,a,c1,'2026/2','oab')).rows.map(r=>r.participants),[5]);
      assert.equal((await rpc(db,a,c1,'2026/1','oab')).rows.length,0);
      assert.equal((await rpc(db,b,c3)).rows.length,0);
      assert.equal((await rpc(db,a,c3)).rows.length,0);
      assert.equal((await rpc(db,school,cs)).rows.length,0);
    });

    await t.test('vínculo por curso não amplia leitura por disciplina, exige MFA e nega RPC a anônimo', async () => {
      await grants(db,'teacher');
      assert.deepEqual((await rpc(db)).rows.map(r=>r.subject_code), ['PERMITTED','PERMITTED']);
      assert.equal((await rpc(db,a,c2)).rows.length,0);
      await grants(db,'manager','aal1');
      assert.equal((await rpc(db)).rows.length,0);
      await db.exec('reset role; set role anon');
      await assert.rejects(rpc(db),{code:'42501'});
    });
  } finally {
    await db.close();
  }
});
