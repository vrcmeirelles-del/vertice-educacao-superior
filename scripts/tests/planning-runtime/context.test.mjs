import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function fixture(t) {
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
  await db.exec(
    await read(
      "../../../supabase/migrations/20261116004315_planning_interpretation_traceability.sql",
    ),
  );
  await db.exec(
    "CREATE TRIGGER zz_sapiens_module_context BEFORE INSERT ON public.vertice_sapiens_planning_analyses FOR EACH ROW EXECUTE FUNCTION vertice_private.sapiens_module_context()",
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
