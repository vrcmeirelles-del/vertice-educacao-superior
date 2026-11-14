import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnostics, validateRun, newDiagnostics } from '../compare-typescript.mjs';

const first = `client/src/Workspace.tsx(576,11): error TS2367: Types '"tcc" | "ac"' and '"estagio"' have no overlap.\n`;
const reordered = `\x1b[31mclient/src/Workspace.tsx(576,11): error TS2367: Types '"ac" | "tcc"'\x1b[0m\r\n  and '"estagio"' have no overlap.\r\n`;
test('ignores union order, message formatting, colors and CRLF', () => {
  assert.deepEqual(newDiagnostics(diagnostics(first), diagnostics(reordered)), []);
});
test('does not treat fixes as new errors', () => {
  assert.deepEqual(newDiagnostics(diagnostics(first), diagnostics('')), []);
});
test('detects another position even with the same file and code', () => {
  assert.equal(newDiagnostics(diagnostics(first), diagnostics(first + first.replace('576,11', '582,11'))).length, 1);
});
test('detects changed TS codes and files', () => {
  for (const changed of [first.replace('TS2367', 'TS2304'), first.replace('Workspace', 'Other')]) {
    assert.equal(newDiagnostics(diagnostics(first), diagnostics(changed)).length, 1);
  }
});
test('preserves multiplicity rather than deduplicating errors', () => {
  assert.equal(newDiagnostics(diagnostics(first), diagnostics(first + first)).length, 1);
});
test('normalizes relative path spelling and handles global config diagnostics', () => {
  assert.deepEqual(diagnostics(first), diagnostics(first.replace('client/src/', './client\\src\\')));
  assert.equal(diagnostics('error TS18003: No inputs were found.').get('error TS18003'), 1);
});
test('fails closed for compiler startup failures, signals and inconsistent status', () => {
  for (const run of [
    { status: 1, stdout: 'Cannot find tsc' },
    { status: null, signal: 'SIGTERM', stdout: '' },
    { status: 127, stdout: first },
    { status: 0, stdout: first },
    { error: new Error('ENOENT') },
  ]) assert.throws(() => validateRun(run, 'fixture'));
  assert.throws(() => diagnostics('unexpected prefix error TS2304: failure'));
});
test('accepts clean builds and genuine compiler diagnostics', () => {
  assert.equal(validateRun({ status: 0, stdout: '' }, 'fixture').size, 0);
  assert.equal(validateRun({ status: 2, stdout: first }, 'fixture').size, 1);
});
