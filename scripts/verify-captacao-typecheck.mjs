// Require zero TypeScript diagnostics in the composed build.
// The 47 pre-existing errors were corrected in PR #91; this now enforces a clean check.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const buildArg = process.argv[2];
assert(buildArg, 'Usage: node scripts/verify-captacao-typecheck.mjs BUILD_DIR');
const cwd = resolve(buildArg);
const run = spawnSync(process.execPath, [resolve(cwd, 'node_modules/typescript/bin/tsc'), '--noEmit', '--incremental', 'false', '--pretty', 'false'], { cwd, encoding: 'utf8' });
if (run.error) throw run.error;
assert.equal(run.status, 0, `TypeScript check failed with ${(run.stdout.match(/error TS\d+:/g) || []).length} error(s):\n${run.stdout.slice(0, 2000)}`);
console.log('PASS: zero TypeScript diagnostics.');
