// Compare complete TypeScript diagnostics against an unmodified base checkout.
// A green comparison means no new diagnostics; it does not mean global tsc passed.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const [baseArg, currentArg] = process.argv.slice(2);
assert(baseArg && currentArg, 'Usage: node scripts/verify-captacao-typecheck.mjs BASE_BUILD CURRENT_BUILD');
function check(directory) {
  const cwd = resolve(directory);
  const run = spawnSync(process.execPath, [resolve(cwd, 'node_modules/typescript/bin/tsc'), '--noEmit', '--incremental', 'false', '--pretty', 'false'], { cwd, encoding: 'utf8' });
  if (run.error) throw run.error;
  assert([0, 2].includes(run.status), `TypeScript invocation failed: ${run.status}\n${run.stderr}`);
  return { status: run.status, diagnostics: run.stdout.replaceAll(cwd, '<BUILD>').trim() };
}
const base = check(baseArg), current = check(currentArg);
assert.equal(current.diagnostics, base.diagnostics, 'TypeScript diagnostics changed; inspect new errors before review.');
const count = (current.diagnostics.match(/error TS\d+:/g) || []).length;
console.log(`PASS differential TypeScript: ${count} pre-existing diagnostics, no new diagnostics. Global typecheck ${current.status === 0 ? 'passed' : 'still fails'}.`);
