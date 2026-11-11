// Prepare only the dependency subset used by captação in a brand-new LOCAL Supabase.
// Never accepts a project reference, remote URL, database password or production source data.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const directory = path.resolve('.captacao-stack/supabase');
const configPath = path.join(directory, 'config.toml');
let config = readFileSync(configPath, 'utf8');
assert(config.includes('project_id = "captacao-stack"'));
config = config.replace(/(\[auth\.mfa\.totp\][\s\S]*?enroll_enabled = )false/, '$1true').replace(/(\[auth\.mfa\.totp\][\s\S]*?verify_enabled = )false/, '$1true');
assert(config.includes('major_version = 17'));
writeFileSync(configPath, config);
mkdirSync(path.join(directory, 'migrations'), { recursive: true });
const read = name => readFileSync('supabase/migrations/' + name, 'utf8');
writeFileSync(path.join(directory, 'migrations/20261026000100_access_foundation.sql'), read('202610260001_access_foundation.sql'));
const source = read('202610300001_area_real.sql');
function helper(name) {
  const start = source.indexOf('create or replace function vertice_private.' + name + '(');
  const end = source.indexOf('$$;', start);
  assert(start >= 0 && end >= 0);
  return source.slice(start, end + 3);
}
const status = source.split('\n').find(line => line.includes('add column if not exists status text')).trim().replace(/,$/, '');
writeFileSync(path.join(directory, 'migrations/20261030000100_captacao_dependencies.sql'),
  `begin;\nalter table public.vertice_institutions ${status};\n${helper('member_role')}\n${helper('has_role')}\nrevoke all on function vertice_private.member_role(uuid),vertice_private.has_role(uuid,text[]) from public,anon;\ngrant execute on function vertice_private.member_role(uuid),vertice_private.has_role(uuid,text[]) to authenticated;\ncommit;\n`);
const migration = readdirSync('supabase/migrations').find(name => name.endsWith('_captacao_integrada_preparacao.sql'));
assert(migration);
writeFileSync(path.join(directory, 'migrations', migration), read(migration));
writeFileSync(path.join(directory, 'seed.sql'), '-- Synthetic users are created through LOCAL Auth by the integration test.\n');
console.log('Prepared local PostgreSQL 17 + Auth/TOTP + REST; no remote project linked.');
