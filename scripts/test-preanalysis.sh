#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
RUNTIME="$PWD/scripts/tests/preanalysis-runtime"
node scripts/build-preanalysis-catalog.mjs --check
node scripts/build-preanalysis-sources.mjs --check
node scripts/build-preanalysis-migration.mjs --check
PREANALYSIS_PARSER_PACKAGE_JSON="$RUNTIME/package.json" \
PGLITE_MODULE="$RUNTIME/node_modules/@electric-sql/pglite/dist/index.js" \
node --experimental-transform-types --test supabase/tests/preanalysis-*.test.*
# Strict source checking uses the same installed, pinned npm packages without registry access.
EDGE="$PWD/supabase/functions/vertice-doc-prevalidate"
if [ -e "$EDGE/node_modules" ] || [ -L "$EDGE/node_modules" ]; then
  echo "Refusing to replace an existing Edge node_modules path" >&2
  exit 1
fi
ln -s "$RUNTIME/node_modules" "$EDGE/node_modules"
trap 'rm -f "$EDGE/node_modules"' EXIT
"$RUNTIME/node_modules/.bin/deno" check --cached-only --node-modules-dir=manual --config "$EDGE/deno.json" "$EDGE/index.ts"
