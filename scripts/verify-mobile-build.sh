#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
test -f vertice-servidor-source.zip
rm -rf .mobile-ci
mkdir -p .mobile-ci/build
unzip -qo vertice-servidor-source.zip -d .mobile-ci/build
cp -a source-overrides/. .mobile-ci/build/
cd .mobile-ci/build
test -f package.json
npm ci --legacy-peer-deps --no-audit --no-fund
npm run check
npm test
npm run build:static
test -f dist/public/index.html
test -f dist/public/vertice-mobile.webmanifest
test -f dist/public/mobile-sw.js
test -f dist/public/mobile-icon.svg
printf '\nVértice Mobile: compilação e artefatos básicos verificados.\n'
