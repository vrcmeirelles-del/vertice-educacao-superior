// Compare diagnostic identities, never compiler prose (union order is unstable).
// Positions are retained deliberately: a new error in the same file/code must fail.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function diagnostics(output) {
  const counts = new Map();
  const plain = output.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');
  for (const line of plain.split('\n')) {
    const match = line.match(/^(?:(.+)\((\d+),(\d+)\):\s*|\s*)error TS(\d+):/);
    if (!match) {
      if (/error TS\d+:/i.test(line)) throw new Error(`Unrecognized TypeScript diagnostic: ${line}`);
      continue;
    }
    const [, file, row, column, code] = match;
    const key = file ? `${file.replaceAll('\\', '/').replace(/^\.\//, '')}(${row},${column}): error TS${code}` : `error TS${code}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function validateRun(run, label) {
  if (run.error) throw run.error;
  if (run.signal || ![0, 1, 2].includes(run.status)) throw new Error(`${label}: compiler failed (status ${run.status}, signal ${run.signal})`);
  const found = diagnostics((run.stdout ?? '') + (run.stderr ?? ''));
  if ((run.status === 0) !== (found.size === 0)) throw new Error(`${label}: compiler status and diagnostics disagree`);
  return found;
}

export function newDiagnostics(base, head) {
  return [...head].sort(([a], [b]) => a.localeCompare(b)).flatMap(([key, count]) =>
    Array(Math.max(0, count - (base.get(key) ?? 0))).fill(key));
}

export function compareBuilds(baseDir, headDir, logDir) {
  mkdirSync(logDir, { recursive: true });
  const results = [baseDir, headDir].map((dir, index) => {
    const cwd = resolve(dir);
    const run = spawnSync(process.execPath, [resolve(cwd, 'node_modules/typescript/bin/tsc'), '--noEmit', '--pretty', 'false', '--incremental', 'false'], { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const label = index === 0 ? 'base' : 'head';
    writeFileSync(resolve(logDir, `typecheck-${label}.log`), (run.stdout ?? '') + (run.stderr ?? ''));
    return { run, label };
  });
  const [base, head] = results.map(({ run, label }) => validateRun(run, label));
  const added = newDiagnostics(base, head);
  const count = entries => [...entries.values()].reduce((sum, n) => sum + n, 0);
  const summary = { baseExit: results[0].run.status, headExit: results[1].run.status, baseErrors: count(base), headErrors: count(head), newErrors: added };
  writeFileSync(resolve(logDir, 'typecheck-comparison.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
  if (added.length) throw new Error('New TypeScript diagnostics introduced.');
  if (head.size) console.warn('Legacy diagnostics remain; comparison is not a clean typecheck.');
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [, , base, head, logs] = process.argv;
  if (!base || !head || !logs) throw new Error('Usage: node scripts/compare-typescript.mjs BASE_BUILD HEAD_BUILD LOG_DIR');
  compareBuilds(base, head, logs);
}
