// Compare diagnostic identities, never compiler message text or just error counts.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function parseCompilerResult(run, label) {
  if (run.error) throw new Error(`${label}: compiler could not run: ${run.error.message}`);
  if (run.signal || ![0, 1, 2].includes(run.status)) {
    throw new Error(`${label}: compiler terminated unexpectedly (status=${run.status}, signal=${run.signal ?? 'none'}).`);
  }
  const diagnostics = [];
  const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^(.+)\((\d+),(\d+)\): error (TS\d+):/);
    if (match) {
      diagnostics.push(`${match[1].replaceAll('\\', '/')}(${match[2]},${match[3]}): error ${match[4]}`);
    } else if (/^\(node:\d+\) (?:\[[A-Z0-9_-]+\] )?(?:ExperimentalWarning|DeprecationWarning|Warning): /.test(line)
      || /^\(Use `node .+` to show where the warning was created\)$/.test(line)) {
      // Runtime warnings are not compiler diagnostics; status checks below still apply.
      continue;
    } else if (line.trim() && !/^\s/.test(line)) {
      // Configuration/global diagnostics and crashes have no stable source position.
      // They must fail the job, never become an empty successful baseline.
      throw new Error(`${label}: unrecognized compiler output: ${line}`);
    }
  }
  if ((run.status === 0) !== (diagnostics.length === 0)) {
    throw new Error(`${label}: compiler exit status and diagnostics disagree (status=${run.status}, diagnostics=${diagnostics.length}).`);
  }
  return diagnostics.sort();
}

export function compareDiagnostics(base, branch) {
  const remaining = new Map();
  for (const key of base) remaining.set(key, (remaining.get(key) ?? 0) + 1);
  const added = [];
  for (const key of branch) {
    const count = remaining.get(key) ?? 0;
    if (count > 0) remaining.set(key, count - 1);
    else added.push(key);
  }
  const removed = [...remaining].flatMap(([key, count]) => Array(count).fill(key));
  return { added: added.sort(), removed: removed.sort() };
}

export function runCompiler(buildDirectory) {
  const cwd = resolve(buildDirectory);
  return spawnSync(process.execPath, [resolve(cwd, 'node_modules/typescript/bin/tsc'),
    '--noEmit', '--incremental', 'false', '--pretty', 'false'],
  { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

export function main(args = process.argv.slice(2)) {
  const [baseDirectory, branchDirectory, evidenceDirectory] = args;
  if (!baseDirectory || !branchDirectory || args.length > 3) {
    throw new Error('Usage: node scripts/compare-typescript-diagnostics.mjs BASE_BUILD BRANCH_BUILD [EVIDENCE_DIR]');
  }
  const baseRun = runCompiler(baseDirectory);
  const branchRun = runCompiler(branchDirectory);
  if (evidenceDirectory) {
    mkdirSync(evidenceDirectory, { recursive: true });
    for (const [label, run] of [['base', baseRun], ['branch', branchRun]]) {
      writeFileSync(resolve(evidenceDirectory, `${label}.log`), `${run.stdout ?? ''}${run.stderr ?? ''}`);
      writeFileSync(resolve(evidenceDirectory, `${label}-exit.json`), JSON.stringify({status: run.status, signal: run.signal, error: run.error?.message}) + '\n');
    }
  }
  const base = parseCompilerResult(baseRun, 'base');
  const branch = parseCompilerResult(branchRun, 'branch');
  const { added, removed } = compareDiagnostics(base, branch);
  const summary = { node: process.version, baseErrors: base.length, branchErrors: branch.length, newErrors: added.length, resolvedErrors: removed.length };
  if (evidenceDirectory) writeFileSync(resolve(evidenceDirectory, 'summary.json'), JSON.stringify({...summary, added, removed}, null, 2) + '\n');
  console.log(JSON.stringify(summary));
  if (added.length) {
    console.error(added.join('\n'));
    console.error('New TypeScript diagnostics detected.');
    return 1;
  }
  if (branch.length) console.warn('Legacy diagnostics remain; the strict portal check still requires zero errors.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
