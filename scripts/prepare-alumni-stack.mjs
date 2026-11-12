// Disposable test subset only. No remote project reference, data dump or credentials accepted.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=path.resolve('.alumni-stack/supabase');
let config=readFileSync(path.join(base,'config.toml'),'utf8');
assert(config.includes('project_id = "alumni-stack"'));
assert(config.includes('major_version = 17'));
config=config.replace(/(\[auth\.mfa\.totp\][\s\S]*?enroll_enabled = )false/,'$1true').replace(/(\[auth\.mfa\.totp\][\s\S]*?verify_enabled = )false/,'$1true');
assert(/\[auth\.mfa\.totp\][\s\S]*?enroll_enabled = true/.test(config));
assert(/\[auth\.mfa\.totp\][\s\S]*?verify_enabled = true/.test(config));
writeFileSync(path.join(base,'config.toml'),config);
mkdirSync(path.join(base,'migrations'),{recursive:true});
const copy=(source,name)=>writeFileSync(path.join(base,'migrations',name),readFileSync(source,'utf8'));
copy('supabase/migrations/202610260001_access_foundation.sql','20261026000100_access_foundation.sql');
copy('supabase/migrations/202610300001_area_real.sql','20261030000100_area_real.sql');
const modality=readFileSync('supabase/migrations/20261029220000_unitop_area.sql','utf8').split('\n')[1];
assert(modality.includes('alter table')&&modality.includes('modality')&&!/insert|update|delete/i.test(modality));
writeFileSync(path.join(base,'migrations/20261110000000_modality_ddl_only.sql'),modality+'\n');
copy('supabase/migrations/20261111000000_alumni_360_phase1.sql','20261111000000_alumni_360_phase1.sql');
writeFileSync(path.join(base,'migrations/20261111120000_observed_browser_grants_fixture.sql'),
 'grant all on public.vertice_alumni_profiles,public.vertice_alumni_education,public.vertice_alumni_overview to anon,authenticated;\n');
writeFileSync(path.join(base,'migrations/20261111125000_observed_membership_read_fixture.sql'),
 `drop policy vertice_membership_read on public.vertice_memberships;
 create policy vertice_membership_read on public.vertice_memberships for select to authenticated using
 ((select auth.jwt()->>'aal')='aal2' and (user_id=(select auth.uid()) or vertice_private.has_role(institution_id,array['gestor'])));
`);
copy('supabase/migrations/20261112130000_alumni_atomic_import.sql','20261112130000_alumni_atomic_import.sql');
copy('supabase/proposals/alumni_write_boundary.sql','20261112140000_alumni_write_boundary.sql');
copy('supabase/proposals/alumni_nominal_scope.sql','20261112150000_alumni_nominal_scope.sql');
copy('supabase/proposals/alumni_course_scope.sql','20261112160000_alumni_course_scope.sql');
writeFileSync(path.join(base,'seed.sql'),'-- Only local Auth-created identities and synthetic fixtures are created by test script.\n');
console.log('Prepared isolated PostgreSQL17/Auth TOTP/PostgREST schema, no hosted project.');
