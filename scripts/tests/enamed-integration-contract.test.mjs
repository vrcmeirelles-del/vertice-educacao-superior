import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL("../../"+p,import.meta.url),"utf8");
const metrics = read("source-overrides/client/src/components/area/EnamedFatoOrdemMetrics.tsx");
const environment = read("source-overrides/client/src/components/area/EnamedEnvironment.tsx");
const enade = read("source-overrides/client/src/components/area/Enade360.tsx");

test("existing ENADE 360 exposes an ENAMED environment without replacing legacy component",()=>{
  assert.match(enade,/import EnamedEnvironment from/);
  assert.match(enade,/<EnadeCross/);
  assert.match(enade,/<EnamedEnvironment institutionId=/);
});
test("ENAMED view references the existing read-only institutional bridge",()=>{
  assert.match(environment,/EnamedFatoOrdemMetrics/);
  assert.match(metrics,/from\("vertice_learning_course_metrics"\)/);
  assert.doesNotMatch(metrics,/fo_enamed_items|createClient\(|service_role/);
});
test("query scopes institution, course, modules; limited read and no writes",()=>{
  assert.match(metrics,/\.eq\("institution_id",institutionId\)/);
  assert.match(metrics,/\.eq\("course_id",courseId\)/);
  assert.match(metrics,/\.in\("module",\["enade","enamed","residencia"\]\)/);
  assert.match(metrics,/\.limit\(1001\)/);
  assert.doesNotMatch(metrics,/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
});
test("small cohorts, official vs internal and stale request protection explicit",()=>{
  assert.match(metrics,/r\.participants>=5/);
  assert.match(metrics,/if\(!active\)return/);
  assert.match(metrics,/Não são pontuações TRI ou resultados oficiais do Inep/);
  assert.match(metrics,/Ausência de dados não representa desempenho zero/);
});
