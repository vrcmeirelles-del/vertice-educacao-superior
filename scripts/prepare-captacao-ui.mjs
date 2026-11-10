import { cpSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
const build = path.resolve(process.argv[2] || '.captacao-build');
const source = path.resolve(import.meta.dirname, 'tests/captacao-ui');
const destination = path.join(build, 'captacao-ui');
cpSync(source, destination, { recursive: true });
for (const name of readdirSync(destination)) {
  if (!/\.(tsx?|mjs)$/.test(name)) continue;
  const file = path.join(destination, name);
  writeFileSync(file, readFileSync(file, 'utf8').replaceAll('../../client/src', '../client/src'));
}
console.log('Synthetic UI harness prepared. Not a production route.');
