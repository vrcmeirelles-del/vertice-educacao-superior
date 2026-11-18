import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function fixture(t, { beforeMigration = false } = {}) {
  const db = new PGlite();
  await db.waitReady;
  t.after(() => db.close());
  const read = (p) => readFile(new URL(p, import.meta.url), "utf8");
  await db.exec(await read("./fixture.sql"));
  const area = await read(
    "../../../supabase/migrations/202610300001_area_real.sql",
  );
  const start = area.indexOf(
    "create or replace function vertice_private.member_role(",
  );
  const end = area.indexOf("$$;", start);
  await db.exec(area.slice(start, end + 3));
  await db.exec(
    await read(
      "../../../supabase/migrations/20261115185813_planning_management_previous_period_guard.sql",
    ),
  );
  await db.exec(
    await read(
      "../../../supabase/migrations/20261115201528_sapiens_planning_analysis.sql",
    ),
  );
  // Replay the existing school-context integration before the proposed replacement.
  // Only the data-producing functions are synthetic; the integration DO block is real.
  const schoolIntegration = await read(
    "../../../supabase/migrations/20261115203758_school_operations_validation_context.sql",
  );
  const integrationStart = schoolIntegration.indexOf(
    "DO $$ DECLARE definition text;",
  );
  assert.ok(integrationStart >= 0);
  await db.exec(schoolIntegration.slice(integrationStart));
  const inventory = await read(
    "../../../supabase/migrations/20261116000301_sapiens_bi_module_context.sql",
  );
  const triggerStart = inventory.indexOf(
    "CREATE OR REPLACE FUNCTION vertice_private.sapiens_module_context()",
  );
  assert.ok(triggerStart >= 0);
  await db.exec(
    inventory.slice(triggerStart, inventory.indexOf("$fn$;", triggerStart) + 5),
  );
  await db.exec(
    "CREATE TRIGGER zz_sapiens_module_context BEFORE INSERT ON public.vertice_sapiens_planning_analyses FOR EACH ROW EXECUTE FUNCTION vertice_private.sapiens_module_context()",
  );
  if (!beforeMigration)
    await db.exec(
      await read(
        "../../../supabase/migrations/20261116074720_planning_interpretation_traceability.sql",
      ),
    );
  for (const n of [1, 2, 3, 4])
    await db.query("INSERT INTO auth.users VALUES($1)", [id(n)]);
  await db.query(
    "INSERT INTO vertice_institutions(id,name) VALUES($1,$2),($3,$4)",
    [id(11), "Synthetic A", id(12), "Synthetic B"],
  );
  await db.query(
    "INSERT INTO vertice_courses VALUES($1,$2,$3,$4),($5,$2,$6,$7),($8,$9,$10,$11)",
    [
      id(21),
      id(11),
      "Synthetic Law",
      "027",
      id(22),
      "Synthetic Other",
      "028",
      id(23),
      id(12),
      "Other IES",
      "029",
    ],
  );
  await db.query(
    "INSERT INTO vertice_memberships VALUES($1,$2,$3),($4,$2,$5),($6,$2,$7)",
    [id(1), id(11), "reitor", id(2), "coordenador", id(4), "cpa"],
  );
  await db.query(
    "INSERT INTO vertice_learning_staff_scope VALUES($1,$2,$3,true)",
    [id(2), id(11), id(21)],
  );
  await db.query(
    `INSERT INTO vertice_app.strategic_plans(id,institution_id,course_id,version,strategic_objectives) VALUES($1,$2,$3,1,'[{"theme":"Permanência","description":"Acompanhar o estudante","indicator":"Indicador declarado"}]'),($4,$2,$5,1,'[{"theme":"Other course"}]')`,
    [id(31), id(11), id(21), id(32), id(22)],
  );
  await db.query(
    `INSERT INTO vertice_app.semester_plannings(id,institution_id,course_id,version,semester) VALUES($1,$2,$3,1,'2026/2')`,
    [id(33), id(11), id(21)],
  );
  for (const [n, inst, course] of [
    [41, 11, 21],
    [42, 11, 22],
    [43, 12, 23],
  ])
    await db.query(
      `INSERT INTO vertice_goals(id,institution_id,course_id,title,indicator,unit,target,status,due_date) VALUES($1,$2,$3,'Synthetic goal','Indicador cadastrado','%',80,'concluida','2026-10-01')`,
      [id(n), id(inst), id(course)],
    );
  for (const [n, date, value] of [
    [51, "2026-07-01", 70],
    [52, "2026-09-01", 60],
    [53, "2026-10-10", 50],
    [54, "2027-01-01", 99],
  ])
    await db.query(
      `INSERT INTO vertice_goal_measurements(id,institution_id,goal_id,measured_on,value,source) VALUES($1,$2,$3,$4,$5,'Synthetic register')`,
      [id(n), id(11), id(41), date, value],
    );
  await db.query(
    `INSERT INTO vertice_course_semester_stats(institution_id,codigo,semestre,matriculados) VALUES($1,'027','2026/01',100),($1,'027','2026/1',100),($1,'027','2026/2',90),($1,'027','2027/1',999)`,
    [id(11)],
  );
  await db.query(
    `INSERT INTO vertice_repository_requests(id,institution_id,course_id,goal_id,semester) VALUES($1,$2,$3,$4,'2026/2')`,
    [id(61), id(11), id(21), id(41)],
  );
  await db.query(
    `INSERT INTO vertice_repository_files(id,institution_id,request_id,status,created_at) VALUES($1,$2,$3,'validado','2026-08-01'),($4,$2,$3,'devolvido','2026-09-01')`,
    [id(62), id(11), id(61), id(63)],
  );
  await db.query(
    `INSERT INTO synthetic_risk SELECT $1::uuid,$2::uuid,'high' FROM generate_series(1,6) UNION ALL SELECT $1::uuid,$2::uuid,'low' FROM generate_series(1,2)`,
    [id(11), id(21)],
  );
  const auth = async (user = 1, aal = "aal2") => {
    await db.exec("RESET ROLE");
    await db.query(
      "SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",
      [user ? id(user) : "", aal],
    );
    await db.exec("SET ROLE authenticated");
  };
  const rpc = async (action, payload = {}, inst = 11) =>
    (
      await db.query(
        "SELECT public.vertice_sapiens_planning($1,$2,$3) result",
        [id(inst), action, payload],
      )
    ).rows[0].result;
  return { db, auth, rpc };
}
test("scope and MFA enforced by database: coordinator cannot access other courses or institution", async (t) => {
  const { db, auth, rpc } = await fixture(t);
  await auth(2);
  assert.equal((await rpc("options")).courses.length, 1);
  assert.equal((await rpc("options")).can_review, false);
  for (const [payload, inst] of [
    [{}, 11],
    [{ course_id: id(22) }, 11],
    [{ course_id: id(23) }, 12],
  ])
    await assert.rejects(rpc("start", payload, inst), /autorizado/);
  await assert.rejects(
    db.query("SELECT public.vertice_planning_management($1,NULL)", [id(11)]),
    /restrita/,
  );
  for (const [user, aal] of [
    [2, "aal1"],
    [null, "aal2"],
    [3, "aal2"],
    [4, "aal2"],
  ]) {
    await auth(user, aal);
    await assert.rejects(
      rpc("start", { course_id: id(21) }),
      /obrigatória|vínculo|segundo fator/,
    );
  }
  await auth(2);
  await assert.rejects(
    db.exec("SELECT * FROM vertice_planning.objective_goal_links"),
    /permission denied/,
  );
  await assert.rejects(
    db.exec("SELECT * FROM vertice_sapiens_planning_analyses"),
    /permission denied/,
  );
});
test("snapshot reuses portfolio, preserves ambiguity and missing data, excludes future periods and global inventory", async (t) => {
  const { db, auth, rpc } = await fixture(t);
  await auth(2);
  const job = await rpc("start", { course_id: id(21), semester: "2026/2" });
  const c = job.context.courses[0];
  assert.equal(job.context.courses.length, 1);
  assert.equal(c.id, id(21));
  assert.equal(job.context.audience, "coordenacao");
  assert.equal(job.context.institutional_module_inventory, undefined);
  assert.equal(c.enrollment_history.length, 2);
  assert.equal(c.enrollment_history[0].semester, "2026/1");
  assert.equal(c.enrollment_history[0].matches, 2);
  assert.equal(c.enrollment_history[0].matriculados, null);
  assert.equal(c.goals[0].measurements.length, 3);
  assert.equal(c.goals[0].documents[0].status, "devolvido");
  assert.equal(c.goals[0].documents[0].id, id(63));
  assert.equal(
    c.permanence.groups.find((g) => g.risk_level === "low").students,
    null,
  );
  assert.equal(
    c.permanence.groups.find((g) => g.risk_level === "high").students,
    6,
  );
  await db.exec("RESET ROLE");
  assert.deepEqual(
    (
      await db.query(
        "SELECT context FROM vertice_sapiens_planning_analyses WHERE id=$1",
        [job.id],
      )
    ).rows[0].context,
    job.context,
  );
  await auth(1);
  await assert.rejects(rpc("start", { semester: "2026/2" }), /andamento/);
  await db.exec("RESET ROLE");
  await db.exec("UPDATE vertice_sapiens_planning_analyses SET status='failed'");
  await auth(1);
  const institutional = await rpc("start", { semester: "2026/2" });
  assert.ok(institutional.context.institutional_module_inventory);
  assert.deepEqual(
    (
      await db.query(
        "SELECT public.vertice_planning_management($1,NULL) data",
        [id(11)],
      )
    ).rows[0].data.courses.map((c) => c.id),
    [id(21), id(22)],
  );
  await db.exec("RESET ROLE");
  assert.deepEqual(
    (
      await db.query(
        "SELECT context FROM vertice_sapiens_planning_analyses WHERE id=$1",
        [institutional.id],
      )
    ).rows[0].context,
    institutional.context,
  );
});
test("objective links require exact version, course and rationale; changed drafts and new versions invalidate association", async (t) => {
  const { db, auth, rpc } = await fixture(t);
  await auth(2);
  let options = await rpc("links", { course_id: id(21) });
  const base = {
    course_id: id(21),
    plan_id: options.plan.id,
    expected_updated_at: options.plan.updated_at,
    objective_index: 0,
    goal_id: id(41),
    expected_goal_updated_at: options.goals[0].updated_at,
    expected_indicator_definition: options.goals[0].indicator_definition,
    rationale: "Synthetic explicit relationship",
  };
  await assert.rejects(
    rpc("link_objective", { ...base, goal_id: id(42) }),
    /Meta fora/,
  );
  await assert.rejects(
    rpc("link_objective", { ...base, rationale: "short" }),
    /Justifique/,
  );
  await assert.rejects(
    rpc("link_objective", { ...base, objective_index: -1 }),
    /Objetivo inválido/,
  );
  const linked = await rpc("link_objective", base);
  assert.ok(linked.id);
  await assert.rejects(rpc("link_objective", base), /duplicate key/);
  await db.exec("RESET ROLE");
  await db.query(
    `UPDATE vertice_app.strategic_plans SET strategic_objectives='[{"theme":"Changed objective"}]',updated_at=updated_at+interval '1 second' WHERE id=$1`,
    [id(31)],
  );
  await auth(2);
  assert.equal(
    (await rpc("links", { course_id: id(21) })).links[0].valid_for_snapshot,
    false,
  );
  await assert.rejects(
    rpc("unlink_objective", { ...base, id: linked.id }),
    /Versão alterada/,
  );
  const job = await rpc("start", { course_id: id(21) });
  assert.equal(
    job.context.courses[0].objective_links[0].valid_for_snapshot,
    false,
  );
  await db.exec("RESET ROLE");
  await db.query(
    `INSERT INTO vertice_app.strategic_plans(id,institution_id,course_id,version,strategic_objectives) VALUES($1,$2,$3,2,'[{"theme":"New version"}]')`,
    [id(34), id(11), id(21)],
  );
  await auth(2);
  assert.equal((await rpc("links", { course_id: id(21) })).links.length, 0);
});
test("history is filtered before limit; human review checks role and institution and does not change plans", async (t) => {
  const { db, auth, rpc } = await fixture(t);
  await auth(2);
  const job = await rpc("start", { course_id: id(21) });
  await db.exec("RESET ROLE");
  await db.query(
    `UPDATE vertice_sapiens_planning_analyses SET status='pending_review',result='{"schema_version":2}' WHERE id=$1`,
    [job.id],
  );
  const plans = (await db.exec("SELECT * FROM vertice_app.strategic_plans"))[0]
    .rows;
  for (let n = 100; n < 125; n++)
    await db.query(
      `INSERT INTO vertice_sapiens_planning_analyses(id,institution_id,course_id,semester,scope,status,context,result,created_by,created_at) VALUES($1,$2,$3,'2026/2','superior','pending_review','{}','{"schema_version":2}',$4,now()+interval '1 hour')`,
      [id(n), id(11), id(22), id(1)],
    );
  await auth(2);
  assert.equal(
    (await rpc("list", { course_id: id(21), semester: "2026/2" })).length,
    1,
  );
  await assert.rejects(rpc("list", {}), /Recorte/);
  await assert.rejects(
    rpc("review", {
      course_id: id(21),
      id: job.id,
      status: "reviewed",
      note: "Sufficient human justification",
    }),
    /restrita/,
  );
  await auth(1);
  const reviewed = await rpc("review", {
    id: job.id,
    status: "reviewed",
    note: "Sufficient human justification",
  });
  assert.equal(reviewed.status, "reviewed");
  await assert.rejects(
    rpc("review", {
      id: job.id,
      status: "reviewed",
      note: "Sufficient human justification",
    }),
    /já revisado/,
  );
  await assert.rejects(
    rpc(
      "review",
      {
        id: job.id,
        status: "reviewed",
        note: "Sufficient human justification",
      },
      12,
    ),
    /vínculo|autorizado/,
  );
  await db.exec("RESET ROLE");
  assert.deepEqual(
    (await db.exec("SELECT * FROM vertice_app.strategic_plans"))[0].rows,
    plans,
  );
  assert.equal(
    (
      await db.query(
        "SELECT has_function_privilege('anon','public.vertice_sapiens_planning(uuid,text,jsonb)','EXECUTE') allowed",
      )
    ).rows[0].allowed,
    false,
  );
});
test("future academic periods, absent risk source and small learning groups remain explicitly unavailable", async (t) => {
  const { db, auth, rpc } = await fixture(t);
  await db.exec("DROP VIEW public.v_student_evasion_risk");
  await db.query(
    `INSERT INTO vertice_learning_course_metrics(institution_id,course_id,semester,subject_code,module,competency,participants) VALUES($1,$2,'2026/2','LAW','oab','A',4),($1,$2,'2027/1','LAW','oab','A',10)`,
    [id(11), id(21)],
  );
  await auth(1);
  const job = await rpc("start", { course_id: id(21), semester: "2027/1" });
  const c = job.context.courses[0];
  assert.equal(c.permanence.status, "unavailable");
  assert.equal(c.learning_history.length, 0);
  assert.equal(c.learning_history_total, 0);
  assert.equal(c.stats, null);
  assert.equal(c.previous_stats, null);
  assert.equal(job.context.collection_rules.future_academic_period, true);
  assert.ok(c.enrollment_history.every((h) => h.semester <= "2026/2"));
});
test("direct action documents require current human approval and scoped institution; active upload alone is insufficient", async (t) => {
  const { db, auth, rpc } = await fixture(t);
  for (const [doc, inst, course, approved, expiry] of [
    [71, 11, 21, true, "2027-12-31"],
    [73, 11, 21, false, "2027-12-31"],
    [75, 11, 21, true, "2025-01-01"],
    [77, 12, 23, true, "2027-12-31"],
  ]) {
    await db.query(
      `INSERT INTO vertice_documents(id,institution_id,course_id,status,approved_by,approved_at,expiry_date) VALUES($1,$2,$3,'active',$4,$5,$6)`,
      [
        id(doc),
        id(inst),
        id(course),
        approved ? id(1) : null,
        approved ? "2026-10-01" : null,
        expiry,
      ],
    );
    await db.query(
      `INSERT INTO vertice_actions(id,institution_id,course_id,goal_id,what,status,evidence_doc_id) VALUES($1,$2,$3,$4,'Synthetic action','concluida',$5)`,
      [id(doc + 1), id(11), id(21), id(41), id(doc)],
    );
  }
  await auth(2);
  const job = await rpc("start", { course_id: id(21) });
  const c = job.context.courses[0];
  assert.equal(c.goals[0].action_documents.length, 3);
  assert.equal(
    c.goals[0].action_documents.find((d) => d.id === id(71)).human_approved,
    true,
  );
  assert.equal(
    c.goals[0].action_documents.find((d) => d.id === id(73)).human_approved,
    false,
  );
  assert.equal(
    c.goals[0].action_documents.find((d) => d.id === id(75)).human_approved,
    false,
  );
  assert.equal(c.actions.find((a) => a.id === id(78)).evidence_doc_id, null);
});

test("default semester excludes future enrollment when no observed semester exists", async (t) => {
  const { db, auth, rpc } = await fixture(t);
  await db.exec(
    "DELETE FROM vertice_app.semester_plannings; DELETE FROM vertice_course_semester_stats WHERE semestre NOT LIKE '2027/%'",
  );
  await auth(2);
  const { context } = await rpc("start", { course_id: id(21) });
  assert.equal(context.semester, null);
  assert.deepEqual(context.courses[0].enrollment_history, []);
  assert.equal(context.courses[0].stats, null);
});

test("school operational context survives replacement of the actual earlier Sapiens integration", async (t) => {
  const { db, auth, rpc } = await fixture(t, { beforeMigration: true });
  await db.query("UPDATE vertice_institutions SET tier='escolas' WHERE id=$1", [
    id(11),
  ]);
  await auth(1);
  const before = await rpc("start", { semester: "2026/2" });
  assert.equal(before.context.school_operations.year, 2026);
  assert.equal(before.context.school_operations.classes[0].enrolled, 30);
  await db.exec(
    "RESET ROLE; UPDATE vertice_sapiens_planning_analyses SET status='failed'",
  );
  await db.exec(
    await readFile(
      new URL(
        "../../../supabase/migrations/20261116074720_planning_interpretation_traceability.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await auth(1);
  const after = await rpc("start", { semester: "2026/2" });
  assert.deepEqual(
    after.context.school_operations,
    before.context.school_operations,
  );
  assert.ok(after.context.institutional_module_inventory);
});

test("indicator changes invalidate links and stale confirmations cannot overwrite history", async (t) => {
  const { db, auth, rpc } = await fixture(t);
  await auth(2);
  const options = await rpc("links", { course_id: id(21) });
  const base = {
    course_id: id(21),
    plan_id: options.plan.id,
    expected_updated_at: options.plan.updated_at,
    objective_index: 0,
    goal_id: id(41),
    expected_goal_updated_at: options.goals[0].updated_at,
    expected_indicator_definition: options.goals[0].indicator_definition,
    rationale: "O indicador cadastrado mede explicitamente este objetivo",
  };
  const first = await rpc("link_objective", base);
  await db.exec("RESET ROLE");
  await db.query(
    "UPDATE vertice_goals SET indicator='Outro indicador',unit='alunos',direction='reduzir',updated_at=updated_at+interval '1 second' WHERE id=$1",
    [id(41)],
  );
  await auth(2);
  const changed = await rpc("links", { course_id: id(21) });
  assert.equal(changed.links[0].valid_for_snapshot, false);
  assert.equal(changed.links[0].objective_matches, true);
  assert.equal(changed.links[0].indicator_matches, false);
  assert.equal(
    changed.links[0].indicator_snapshot.indicator,
    "Indicador cadastrado",
  );
  await assert.rejects(
    rpc("link_objective", base),
    /Meta ou indicador alterado/,
  );
  await assert.rejects(
    rpc("link_objective", {
      ...base,
      expected_goal_updated_at: changed.goals[0].updated_at,
    }),
    /Meta ou indicador alterado/,
  );
  await assert.rejects(
    rpc("link_objective", {
      ...base,
      expected_indicator_definition: changed.goals[0].indicator_definition,
    }),
    /Meta ou indicador alterado/,
  );
  const job = await rpc("start", { course_id: id(21) });
  assert.equal(
    job.context.courses[0].objective_links[0].valid_for_snapshot,
    false,
  );
  await rpc("unlink_objective", { ...base, id: first.id });
  const second = await rpc("link_objective", {
    ...base,
    expected_goal_updated_at: changed.goals[0].updated_at,
    expected_indicator_definition: changed.goals[0].indicator_definition,
  });
  assert.notEqual(second.id, first.id);
  assert.equal(
    (await rpc("links", { course_id: id(21) })).links[0].valid_for_snapshot,
    true,
  );
  await db.exec("RESET ROLE");
  const history = (
    await db.query(
      "SELECT * FROM vertice_planning.objective_goal_links ORDER BY linked_at,id",
    )
  ).rows;
  assert.equal(history.length, 2);
  const previous = history.find((l) => l.id === first.id);
  assert.ok(previous.unlinked_at);
  assert.equal(previous.unlinked_by, id(2));
  assert.equal(previous.indicator_snapshot.unit, "%");
});

test("definition tracks optional formula and population while ordinary goal progress preserves the association", async (t) => {
  const { db, auth, rpc } = await fixture(t);
  await db.exec(
    "ALTER TABLE vertice_goals ADD COLUMN indicator_formula text, ADD COLUMN indicator_population text",
  );
  await db.query(
    "UPDATE vertice_goals SET indicator_formula='acompanhados/participantes',indicator_population='Participantes do curso' WHERE id=$1",
    [id(41)],
  );
  await auth(2);
  const options = await rpc("links", { course_id: id(21) });
  await rpc("link_objective", {
    course_id: id(21),
    plan_id: options.plan.id,
    expected_updated_at: options.plan.updated_at,
    objective_index: 0,
    goal_id: id(41),
    expected_goal_updated_at: options.goals[0].updated_at,
    expected_indicator_definition: options.goals[0].indicator_definition,
    rationale: "Vínculo confirmado com fórmula e população declaradas",
  });
  await db.exec("RESET ROLE");
  await db.query(
    "UPDATE vertice_goals SET title='Título corrigido',target=85,updated_at=updated_at+interval '1 second' WHERE id=$1",
    [id(41)],
  );
  await auth(2);
  assert.equal(
    (await rpc("links", { course_id: id(21) })).links[0].valid_for_snapshot,
    true,
  );
  await db.exec("RESET ROLE");
  await db.query(
    "UPDATE vertice_goals SET indicator_population='Todos os matriculados',updated_at=updated_at+interval '1 second' WHERE id=$1",
    [id(41)],
  );
  await auth(2);
  assert.equal(
    (await rpc("links", { course_id: id(21) })).links[0].valid_for_snapshot,
    false,
  );
  await db.exec("RESET ROLE");
  await db.query(
    "UPDATE vertice_goals SET indicator_population='Participantes do curso',indicator_formula='aprovados/matriculados' WHERE id=$1",
    [id(41)],
  );
  await auth(2);
  assert.equal(
    (await rpc("links", { course_id: id(21) })).links[0].valid_for_snapshot,
    false,
  );
});

test("Sapiens freezes scoped validated teaching, PDI and evidence sources without measurements or private text", async (t) => {
  const { db, auth, rpc } = await fixture(t);
  await db.exec(`
    ALTER TABLE public.vertice_goals ADD COLUMN pdi_program_id uuid, ADD COLUMN pdi_expected_result text;
    CREATE TABLE public.vertice_pdi_programs(id uuid PRIMARY KEY, institution_id uuid, title text);
    CREATE TABLE public.vertice_teaching_activities(
      id uuid PRIMARY KEY, institution_id uuid, course_id uuid, title text, category text,
      activity_date date, status text, ods_goal integer, updated_at timestamptz DEFAULT now(),
      goal_id uuid, evidence_doc_id uuid, description text, ods_rationale text, exam_module text
    );
    CREATE TABLE public.synthetic_teaching_scope(user_id uuid, course_id uuid);
    CREATE FUNCTION vertice_private.teaching_access(p_institution uuid,p_course uuid,p_mode text)
    RETURNS boolean LANGUAGE sql AS $$
      SELECT vertice_planning.can_interpret(p_institution, p_course) AND
        (vertice_planning.can_interpret(p_institution, NULL) OR EXISTS(
          SELECT 1 FROM public.synthetic_teaching_scope s WHERE s.user_id=auth.uid() AND s.course_id=p_course
        ));
    $$;
    CREATE FUNCTION vertice_private.is_full_access(p_institution uuid)
    RETURNS boolean LANGUAGE sql AS $$SELECT vertice_planning.can_interpret(p_institution,NULL)$$;
    CREATE FUNCTION vertice_private.pdi_access(p_institution uuid,p_edit boolean)
    RETURNS boolean LANGUAGE sql AS $$
      SELECT coalesce(vertice_private.member_role(p_institution) IN ('reitor','coordenador'),false);
    $$;
    CREATE FUNCTION public.synthetic_reference_date() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN NEW.context:=NEW.context||'{"reference_date":"2026-11-18"}'::jsonb; RETURN NEW; END $$;
    CREATE TRIGGER zzy_synthetic_reference_date BEFORE INSERT ON public.vertice_sapiens_planning_analyses
      FOR EACH ROW EXECUTE FUNCTION public.synthetic_reference_date();
  `);
  await db.exec(
    await readFile(
      new URL(
        "../../../supabase/migrations/20261118131739_sapiens_teaching_pdi_context.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query(
    "INSERT INTO vertice_pdi_programs VALUES($1,$2,'Sustentabilidade'),($3,$4,'Programa de outra IES')",
    [id(71), id(11), id(72), id(12)],
  );
  await db.query(
    `INSERT INTO vertice_goals(id,institution_id,title,indicator,status,pdi_program_id,pdi_expected_result) VALUES
    ($1,$2,'Redução de resíduos','kg por semana','ativa',$3,'Reduzir volume'),
    ($4,$5,'Meta de outra IES','kg por semana','ativa',$6,'Outro resultado')`,
    [id(73), id(11), id(71), id(74), id(12), id(72)],
  );
  await db.query(
    `INSERT INTO vertice_documents(id,institution_id,course_id,status) VALUES
    ($1,$2,$3,'approved'),($4,$2,$5,'approved'),($6,$7,$8,'approved')`,
    [id(81), id(11), id(21), id(82), id(22), id(83), id(12), id(23)],
  );
  await db.query(
    `INSERT INTO vertice_documents(id,institution_id,course_id,status,superseded_by)
      VALUES($1,$2,$3,'approved',$4)`,
    [id(84), id(11), id(21), id(81)],
  );
  for (const [n, inst, course, label, day, status, goal, doc] of [
    [90, 11, 21, "Oficina validada", "2026-09-10", "validada", 73, 81],
    [91, 11, 21, "Oficina em rascunho", "2026-09-11", "rascunho", 73, 81],
    [92, 11, 22, "Atividade de outro curso", "2026-09-11", "validada", 73, 82],
    [93, 12, 23, "Atividade de outra IES", "2026-09-11", "validada", 74, 83],
    [
      94,
      11,
      21,
      "Atividade fora do semestre",
      "2026-06-30",
      "validada",
      73,
      81,
    ],
    [95, 11, 21, "Atividade futura", "2026-12-31", "validada", 73, 81],
    [96, 11, 21, "Vínculos fora do escopo", "2026-09-09", "validada", 74, 82],
    [97, 11, 21, "Evidência substituída", "2026-09-08", "validada", 73, 84],
  ]) {
    await db.query(
      `INSERT INTO vertice_teaching_activities
      (id,institution_id,course_id,title,category,activity_date,status,ods_goal,goal_id,evidence_doc_id,description,ods_rationale)
      VALUES($1,$2,$3,$4,'pratica',$5,$6,12,$7,$8,'PRIVADO_DESCRICAO','PRIVADO_JUSTIFICATIVA')`,
      [id(n), id(inst), id(course), label, day, status, id(goal), id(doc)],
    );
  }
  await auth(2);
  const noTeachingMembership = await rpc("start", {
    course_id: id(21),
    semester: "2026/2",
  });
  assert.equal(noTeachingMembership.context.teaching_pdi.eligible_count, 0);
  await db.exec("RESET ROLE");
  await db.exec("UPDATE vertice_sapiens_planning_analyses SET status='failed'");
  await db.query("INSERT INTO synthetic_teaching_scope VALUES($1,$2)", [
    id(2),
    id(21),
  ]);
  await auth(2);
  const job = await rpc("start", { course_id: id(21), semester: "2026/2" });
  const teaching = job.context.teaching_pdi;
  assert.equal(teaching.eligible_count, 3);
  assert.deepEqual(
    teaching.activities.map((r) => r.id),
    [id(90), id(96), id(97)],
  );
  assert.deepEqual(
    teaching.goals.map((r) => r.id),
    [id(73)],
  );
  assert.equal(teaching.activities[0].pdi_goal_id, id(73));
  assert.deepEqual(teaching.activities[0].evidence, {
    id: id(81),
    status: "approved",
  });
  assert.equal(teaching.activities[1].pdi_goal_id, null);
  assert.equal(teaching.activities[1].evidence, null);
  assert.equal(teaching.activities[2].evidence, null);
  assert.doesNotMatch(
    JSON.stringify(teaching),
    /PRIVADO_|measurements|Outra IES|Outro resultado/i,
  );
  await db.exec("RESET ROLE");
  const stored = await db.query(
    "SELECT context FROM vertice_sapiens_planning_analyses WHERE id=$1",
    [job.id],
  );
  assert.deepEqual(stored.rows[0].context, job.context);
  await db.exec("UPDATE vertice_sapiens_planning_analyses SET status='failed'");
  await auth(2);
  assert.deepEqual(
    (await rpc("list", { course_id: id(21) })).map((p) => p.id).sort(),
    [job.id, noTeachingMembership.id].sort(),
  );
  await db.exec("RESET ROLE");
  await db.exec("DELETE FROM public.synthetic_teaching_scope");
  await auth(2);
  assert.deepEqual(
    (await rpc("list", { course_id: id(21) })).map((p) => p.id),
    [noTeachingMembership.id],
  );
  await auth(1);
  const institutional = await rpc("start", { semester: "2026/2" });
  assert.deepEqual(
    institutional.context.teaching_pdi.activities.map((r) => r.id),
    [id(92), id(90), id(96), id(97)],
  );
  assert.deepEqual(
    institutional.context.teaching_pdi.goals.map((r) => r.id),
    [id(73)],
  );
});
