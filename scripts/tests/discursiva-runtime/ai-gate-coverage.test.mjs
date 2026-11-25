// Política de IA: nenhum código de servidor fala com provedor de IA sem a chave de suspensão.
// Varre o código-fonte (sem executar nada) e falha se:
//  1. uma função publicada (index.ts) cita o endereço de um provedor e não tem o bloqueio de rede
//     (__aiHosts + __AI_FN_FEATURES.some(aiAllowed)) com AI_SUSPENDED desligando por padrão;
//  2. qualquer outro arquivo cita um provedor sem estar na lista de bibliotecas abaixo, ou é importado
//     por código que não seja uma função com o bloqueio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';

const root = resolve(new URL('../../..', import.meta.url).pathname);
const DIRS = ['supabase/functions', 'source-overrides/supabase/functions', 'source-overrides/ai-backend', 'source-overrides/server', 'source-overrides/shared'];
const HOST = /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com/;
const IS_TEST = /\.(test|spec)\.|[\\/](__tests__|tests?)[\\/]/;
// Bibliotecas que citam provedor e a função (pasta com index.ts com bloqueio) a que pertencem.
// Só módulos dessa mesma pasta podem importá-las.
const LIBS = { 'source-overrides/ai-backend/core.ts': 'source-overrides/ai-backend' };

function walk(dir, out = []) {
  let names = [];
  try { names = readdirSync(join(root, dir)); } catch { return out; }
  for (const n of names) {
    if (n === 'node_modules') continue;
    const rel = join(dir, n);
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(n) && !IS_TEST.test(rel)) out.push(rel);
  }
  return out;
}
const files = [...new Set(DIRS.flatMap((d) => walk(d)))];
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const gated = (src) => /const __aiHosts=\/.*api\\\.anthropic\\\.com.*api\\\.openai\\\.com.*generativelanguage/.test(src)
  && /__AI_FN_FEATURES\.some\(aiAllowed\)/.test(src)
  && /get\("AI_SUSPENDED"\)\?\?"true"/.test(src);
const importsOf = (rel) => [...read(rel).matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)]
  .map((m) => relative(root, resolve(join(root, dirname(rel)), m[1])));

test('toda função publicada que cita provedor de IA tem o bloqueio de rede e a chave de suspensão', () => {
  const offenders = files.filter((f) => HOST.test(read(f)) && /(^|[\\/])index\.ts$/.test(f) && !gated(read(f)));
  assert.deepEqual(offenders, []);
});

test('fora das funções, só bibliotecas declaradas citam provedor de IA', () => {
  const offenders = files.filter((f) => HOST.test(read(f)) && !/(^|[\\/])index\.ts$/.test(f) && !Object.hasOwn(LIBS, f));
  assert.deepEqual(offenders, [], 'arquivo fala com provedor de IA sem passar pela política: remova-o ou declare-o aqui com quem pode importá-lo');
});

test('bibliotecas que citam provedor só são importadas dentro da função com bloqueio', () => {
  for (const [lib, fnDir] of Object.entries(LIBS)) {
    assert.ok(gated(read(join(fnDir, 'index.ts'))), fnDir + '/index.ts sem bloqueio');
    const outside = files.filter((f) => importsOf(f).includes(lib) && dirname(f) !== fnDir);
    assert.deepEqual(outside, [], lib + ' importada fora da função ' + fnDir);
  }
});

test('a varredura enxerga os arquivos que já sabemos citar provedor (sanidade)', () => {
  const seen = files.filter((f) => HOST.test(read(f)));
  for (const f of ['supabase/functions/vertice-discursiva/index.ts', 'source-overrides/supabase/functions/vertice-cpa-report/index.ts']) assert.ok(seen.includes(f), f);
});
