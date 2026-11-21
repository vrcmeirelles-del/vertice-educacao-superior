import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { blank, type Payload } from "@operations-model";
let db: PGlite;
const uid = "11111111-1111-4111-8111-111111111111",
  inst = "22222222-2222-4222-8222-222222222222",
  course = "33333333-3333-4333-8333-333333333333";
const migration = process.env.VERTICE_REPO
  ? `${process.env.VERTICE_REPO}/supabase/migrations/20261118092152_enade360_master_operations.sql`
  : "../vertice/supabase/migrations/20261118092152_enade360_master_operations.sql";
async function session(master = true, aal = "aal2") {
  await db.query(
    "select set_config('test.uid',$1,false),set_config('test.master',$2,false),set_config('test.aal',$3,false)",
    [uid, String(master), aal],
  );
}
async function rpc(action: string, body: Record<string, unknown> = {}) {
  const q = await db.query<{ result: unknown }>(
    "select public.vertice_enade360_operations($1,$2::jsonb) as result",
    [action, JSON.stringify({ environment: "Homologação", ...body })],
  );
  return q.rows[0].result as any;
}
function write(
  front: string,
  payload: Payload,
  extra: Record<string, unknown> = {},
) {
  return rpc("revision", {
    id: randomUUID(),
    front,
    payload,
    expected_seq: 0,
    ...extra,
  });
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema vertice_private;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('aal',current_setting('test.aal',true))$$;
create function vertice_private.is_master() returns boolean language sql as $$select coalesce(current_setting('test.master',true),'false')::boolean$$;
create table public.vertice_institutions(id uuid primary key);create table public.vertice_courses(id uuid primary key,institution_id uuid);
insert into public.vertice_institutions values('${inst}');insert into public.vertice_courses values('${course}','${inst}');
grant usage on schema public,vertice_private,auth to authenticated,anon;grant execute on all functions in schema auth to authenticated,anon;`);
  await db.exec(readFileSync(migration, "utf8"));
  await session();
}, 30000);
afterAll(async () => {
  await db.close();
});
it("nega anônimo, não Master e AAL1, inclusive consultas", async () => {
  await session(false);
  await expect(rpc("state")).rejects.toThrow("restrita");
  await session(true, "aal1");
  await expect(rpc("state")).rejects.toThrow("restrita");
  await session();
  await db.exec("set role anon");
  await expect(rpc("state")).rejects.toThrow("permission denied");
  await db.exec("reset role");
});
it("não concede acesso direto ao diário para authenticated", async () => {
  await db.exec("set role authenticated");
  await expect(
    db.query("select * from vertice_private.enade360_operation_events"),
  ).rejects.toThrow("permission denied");
  await db.exec("reset role");
});
it("persiste revisão, permite retry idêntico e recusa ID reaproveitado", async () => {
  const p = blank();
  p.note = "Teste sintético";
  const id = randomUUID();
  const a = await write("core", p, { id });
  expect(a.created_by).toBeUndefined();
  expect((await write("core", p, { id })).seq).toBe(a.seq);
  await expect(
    write("core", { ...p, note: "Outro conteúdo" }, { id }),
  ).rejects.toThrow("Identificador");
});
it("recusa revisão concorrente e preserva histórico append-only", async () => {
  const p = blank();
  p.note = "Revisão anterior";
  const a = await write("github", p);
  await expect(write("github", { ...p, note: "Conflito" })).rejects.toThrow(
    "outra sessão",
  );
  const b = await write(
    "github",
    { ...p, note: "Nova revisão" },
    { expected_seq: a.seq },
  );
  const state = await rpc("state");
  expect(state.current.find((r: any) => r.front === "github").seq).toBe(b.seq);
  expect(state.entries.some((r: any) => r.id === a.id)).toBe(true);
});
it("separa ambiente, IES e curso sem propagar aceite", async () => {
  const p = blank();
  p.note = "Escopo restrito";
  await write("sapiens", p, { institution_id: inst, course_id: course });
  expect(
    (await rpc("state")).current.some((r: any) => r.front === "sapiens"),
  ).toBe(false);
  expect((await rpc("state", { institution_id: inst })).current).toHaveLength(
    0,
  );
  expect(
    (await rpc("state", { institution_id: inst, course_id: course })).current,
  ).toHaveLength(1);
  expect(
    (
      await rpc("state", {
        institution_id: inst,
        course_id: course,
        environment: "Produção",
      })
    ).current,
  ).toHaveLength(0);
  await expect(write("sapiens", p, { course_id: course })).rejects.toThrow(
    "Curso",
  );
});
it("recusa validação sintética promovida a funcionamento real", async () => {
  const p = blank();
  Object.assign(p, {
    note: "Teste sintético",
    status: "comprovadamente funcional",
    version: "abc",
    url: "https://example.org",
  });
  await expect(write("r2", p)).rejects.toThrow("autenticados");
  p.tests = p.tests.map((t) => ({
    ...t,
    executed: true,
    validated: true,
    evidence: "https://example.org/test",
    result: "passou",
    outcome: "passou" as const,
  }));
  await expect(write("r2", p, { environment: "Demonstração" })).rejects.toThrow(
    "homologação ou produção",
  );
});
it("impede status forte com OCR, CPU, IA ou MFA pendentes", async () => {
  const p = blank();
  Object.assign(p, {
    note: "Teste real",
    status: "comprovadamente funcional",
    version: "abc",
    url: "https://example.org",
    dependencies: "OCR / CPU / IA / MFA / lote real pendentes",
  });
  p.tests = p.tests.map((t) => ({
    ...t,
    executed: true,
    validated: true,
    evidence: "https://example.org/test",
    result: "passou",
    outcome: "passou" as const,
  }));
  await expect(write("r3", p)).rejects.toThrow("pendentes");
});
it("homologação exige checklist completo e confirmação humana", async () => {
  const p = blank();
  Object.assign(p, {
    note: "Teste real sintético de contrato",
    status: "homologado",
    version: "abc",
    url: "https://example.org",
  });
  p.tests = p.tests.map((t) => ({
    ...t,
    executed: true,
    validated: true,
    evidence: "https://example.org/test",
    result: "passou",
    outcome: "passou" as const,
  }));
  await expect(write("r4", p)).rejects.toThrow("Conclua");
  p.checks = p.checks.map((c) => ({
    ...c,
    result: "atendido",
    note: "Conferido no teste",
    evidence: "https://example.org/check",
  }));
  await expect(write("r4", p)).rejects.toThrow("humano");
  p.confirmHuman = true;
  const saved = await write("r4", p);
  expect(saved.payload.status).toBe("homologado");
});
it("aprovação exige alvo, versão, fonte e aceite, sem alterar snapshot", async () => {
  const p = blank();
  Object.assign(p, {
    note: "Aprovação sintética",
    action: "merge",
    target: "PR-123",
    version: "abc",
    approvalReference: "https://example.org/approval",
  });
  await expect(
    rpc("approval", { id: randomUUID(), front: "render", payload: p }),
  ).rejects.toThrow("confirmação");
  p.confirmHuman = true;
  await rpc("approval", { id: randomUUID(), front: "render", payload: p });
  expect(
    (await rpc("state")).current.some((r: any) => r.front === "render"),
  ).toBe(false);
});
it("recusa links com credenciais, JSON inválido e checklists duplicados", async () => {
  const p = blank();
  p.note = "Teste negativo";
  p.url = "https://token@example.org";
  await expect(write("r5", p)).rejects.toThrow("credenciais");
  p.url = "";
  p.tests[0].validated = true;
  await expect(write("r5", p)).rejects.toThrow("Teste validado");
  p.tests = blank().tests;
  p.checks[0] = p.checks[1];
  await expect(write("r5", p)).rejects.toThrow("duplicados");
});
