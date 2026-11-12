#!/usr/bin/env bash
# Run ONLY where local socket creation is explicitly permitted. Never a remote URL.
# Creates/removes its own disposable cluster; does not share production credentials.
set -euo pipefail
for x in initdb pg_ctl createdb node; do command -v "$x" >/dev/null || { echo "SKIP: $x missing"; exit 77; }; done
: "${PG_MODULE:?Path to locally installed pg/lib/index.js is required}"
root=$(cd "$(dirname "$0")/../.." && pwd)
tmp=$(mktemp -d /tmp/alumni-qa.XXXXXX)
trap 'pg_ctl -D "$tmp/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
mkdir "$tmp/socket"
initdb -D "$tmp/data" --auth-local=trust --auth-host=reject --no-locale >/dev/null
pg_ctl -D "$tmp/data" -l "$tmp/server.log" -o "-c listen_addresses='' -c unix_socket_directories='$tmp/socket' -p 55439" -w start >/dev/null || { cat "$tmp/server.log"; exit 1; }
createdb -h "$tmp/socket" -p 55439 alumni_qa_access
cd "$root"
PG_TEST_SOCKET="$tmp/socket" PG_TEST_PORT=55439 PG_TEST_DB=alumni_qa_access node scripts/tests/alumni-access.test.mjs

createdb -h "$tmp/socket" -p 55439 extension_qa_coverage
PG_TEST_SOCKET="$tmp/socket" PG_TEST_PORT=55439 PG_TEST_DB=extension_qa_coverage node scripts/tests/extension-coverage-contract.test.mjs
