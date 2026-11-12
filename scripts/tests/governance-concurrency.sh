#!/usr/bin/env bash
# Creates its OWN disposable local cluster. Never accepts a remote URL or production database.
set -euo pipefail
for tool in initdb pg_ctl psql createdb; do
  command -v "$tool" >/dev/null || { echo "SKIP: local PostgreSQL binary missing: $tool (not a passing test)"; exit 77; }
done
unset PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGPASSFILE PGSERVICE PGSERVICEFILE PGHOSTADDR PGOPTIONS
root=$(cd "$(dirname "$0")/../.." && pwd)
tmp=$(mktemp -d)
cleanup(){ pg_ctl -D "$tmp/data" -m fast stop >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT
initdb -D "$tmp/data" --auth-local=trust --auth-host=reject > "$tmp/init.log"
if ! pg_ctl -D "$tmp/data" -o "-h '' -k '$tmp' -p 55439" -l "$tmp/server.log" start >/dev/null; then
  cat "$tmp/server.log" >&2
  echo "BLOCKED: local PostgreSQL did not start; concurrency test did not run." >&2
  exit 1
fi
export PGHOST="$tmp" PGPORT=55439 PGDATABASE=governance_contract_test
unset PGSERVICE PGHOSTADDR
createdb "$PGDATABASE"
psql -X -v ON_ERROR_STOP=1 -f "$root/scripts/tests/governance-concurrency-fixture.sql" >/dev/null
psql -X -v ON_ERROR_STOP=1 -f "$root/supabase/migrations/20261112110000_governance_action_contract.sql" >/dev/null
cat > "$tmp/common.sql" <<'SQL'
begin;
set role authenticated;
set test.uid='00000000-0000-4000-8000-000000000003';
set test.aal='aal2';
select public.governance_create_action('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000006');
SQL
{ cat "$tmp/common.sql"; printf 'select pg_sleep(1);\ncommit;\n'; } > "$tmp/a.sql"
{ cat "$tmp/common.sql"; printf 'commit;\n'; } > "$tmp/b.sql"
psql -XAtq -v ON_ERROR_STOP=1 -f "$tmp/a.sql" > "$tmp/a.out" & a=$!
sleep .1
psql -XAtq -v ON_ERROR_STOP=1 -f "$tmp/b.sql" > "$tmp/b.out" & b=$!
wait "$a"; wait "$b"
test "$(grep -E '^[0-9a-f-]{36}$' "$tmp/a.out")" = "$(grep -E '^[0-9a-f-]{36}$' "$tmp/b.out")"
psql -Xq -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select count(*) from public.vertice_actions) <> 1 then raise exception 'Duplicate action';end if;
 if not exists(select 1 from public.governance_deliberations d join public.vertice_actions a on a.id=d.action_id and a.deliberation_id=d.id and a.institution_id=d.institution_id)then raise exception 'Broken link';end if;
end $$;
SQL
printf 'PASS: two concurrent PostgreSQL sessions returned one action and one consistent link.\n'
