import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseCompilerResult, compareDiagnostics } from '../compare-typescript-diagnostics.mjs';

const diagnostic = (message = "Types 'a | b' and 'c' have no overlap.", file = 'client/Workspace.tsx', line = 576, column = 11, code = 2367) => `${file}(${line},${column}): error TS${code}: ${message}`;
const parse = (stdout, status = stdout ? 2 : 0) => parseCompilerResult({ stdout, stderr: '', status }, 'fixture');

describe('TypeScript regression identities', () => {
  it('ignores union order and message wording at the same source position/code', () => {
    assert.deepEqual(compareDiagnostics(parse(diagnostic()), parse(diagnostic("Types 'b | a' and 'c' have no overlap."))), { added: [], removed: [] });
  });
  it('allows fixed diagnostics and a clean compiler', () => {
    assert.equal(compareDiagnostics(parse(diagnostic()), parse('')).removed.length, 1);
    assert.deepEqual(parse(''), []);
  });
  for (const [name, changed] of [
    ['file', diagnostic('new', 'client/Other.tsx')],
    ['line', diagnostic('new', 'client/Workspace.tsx', 577)],
    ['column', diagnostic('new', 'client/Workspace.tsx', 576, 12)],
    ['code', diagnostic('new', 'client/Workspace.tsx', 576, 11, 2304)],
  ]) it(`blocks a new ${name} even when total error count is unchanged`, () => {
    assert.equal(compareDiagnostics(parse(diagnostic()), parse(changed)).added.length, 1);
  });
  it('preserves multiplicity, including new errors at an existing key', () => {
    const key = diagnostic();
    assert.equal(compareDiagnostics(parse(key), parse(`${key}\n${key}`)).added.length, 1);
  });
  it('accepts multiline diagnostics, CRLF, Windows separators and colons in paths', () => {
    assert.deepEqual(parse(diagnostic('message', 'C:\\repo\\file.ts') + '\r\n  Detail.\r\n'), ['C:/repo/file.ts(576,11): error TS2367']);
  });
  for (const [name, run] of [
    ['failed compiler without diagnostics', { stdout: '', status: 2 }],
    ['successful compiler with diagnostics', { stdout: diagnostic(), status: 0 }],
    ['global/config diagnostic', { stdout: 'error TS18003: No inputs were found.', status: 2 }],
    ['missing module', { stderr: 'Error: Cannot find module typescript', status: 1 }],
    ['crash with diagnostics', { stdout: diagnostic(), status: 137 }],
    ['signal', { stdout: '', status: null, signal: 'SIGTERM' }],
    ['spawn error', { error: new Error('ENOENT') }],
  ]) it(`fails closed on ${name}`, () => assert.throws(() => parseCompilerResult(run, 'fixture')));
  it('accepts Node runtime warnings without masking a compiler failure', () => {
    const stderr = '(node:42) [UNDICI-EHPA] Warning: Proxy agent is experimental.\n(Use `node --trace-warnings ...` to show where the warning was created)';
    assert.deepEqual(parseCompilerResult({stdout:'',stderr,status:0}, 'fixture'), []);
    assert.throws(() => parseCompilerResult({stdout:'',stderr,status:2}, 'fixture'));
  });
  it('runs the CLI with controlled compiler processes and propagates failure', () => {
    const root = mkdtempSync(join(tmpdir(), 'vertice-ts-'));
    try {
      const base = join(root, 'base'), branch = join(root, 'branch'), evidence = join(root, 'evidence');
      function compiler(dir, stdout, exitCode) {
        const compilerDir = join(dir, 'node_modules/typescript/bin');
        mkdirSync(compilerDir, {recursive: true});
        writeFileSync(join(compilerDir, 'tsc'), `process.stdout.write(${JSON.stringify(stdout)}); process.exitCode=${exitCode};`);
      }
      const script = new URL('../compare-typescript-diagnostics.mjs', import.meta.url).pathname;
      const run = () => spawnSync(process.execPath, [script, base, branch, evidence], {encoding:'utf8'});
      compiler(base, diagnostic(), 2);
      compiler(branch, diagnostic('union reordered'), 2);
      assert.equal(run().status, 0);
      compiler(branch, diagnostic('new', 'client/New.tsx'), 2);
      assert.equal(run().status, 1);
      assert.equal(JSON.parse(readFileSync(join(evidence,'summary.json'))).newErrors, 1);
      compiler(branch, '', 0);
      assert.equal(run().status, 0);
      compiler(base, '', 2);
      assert.equal(run().status, 1);
    } finally { rmSync(root, {recursive:true,force:true}); }
  });
});
