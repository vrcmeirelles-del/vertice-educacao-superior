# Reproducible Edge packaging

This packaging route resolves the pinned npm packages with npm, then emits one
self-contained ESM function. The Deno npm registry resolver is not used when
loading the resulting deployment artifact. No parser or handler is rewritten.
It does not deploy, read credentials, upload documents, or run paid inference.

## Build and check

From the repository root, with Node 24 or newer:

```sh
npm ci --prefix scripts/build/preanalysis-edge --ignore-scripts --no-audit --no-fund
node scripts/build-preanalysis-edge.mjs
node scripts/build-preanalysis-edge.mjs --check
```

`npm ci` verifies the npm registry tarballs against the committed package-lock
integrities. Exact direct versions are esbuild 0.25.12, fflate 0.8.3,
fast-xml-parser 5.12.0 and unpdf 2.1.0. Transitive versions are also locked.
The build itself is offline. It selects ESM exports without the Node condition,
so the fflate Node worker_threads implementation is not selected. All static
imports are bundled. The builder fails if any external import remains.

Generated and gitignored files in `supabase/functions/vertice-doc-prevalidate/`:

- `index.bundle.mjs`: the complete endpoint, catalog, release manifest and
  dependency code, with third-party license notices embedded as legal comments.
- `THIRD_PARTY_NOTICES.txt`: the same full notices in readable form.
- `bundle-manifest.json`: SHA-256, byte size, exact dependency versions, original
  registry integrities, license origins/hashes and hashes of every build input.

No source map is emitted. No timestamps or machine-specific absolute paths are
included, so a clean build from the same sources and lock has identical bytes.
Run the build again after **any** source, catalog, release manifest, lock or build
script change, then run `--check`. The latter rebuilds in memory and rejects any
missing, edited or stale artifact, including a bundle containing an old release
manifest. Do not edit the generated bundle by hand.

## Offline local Deno smoke

Install the separate test runtime using its own lock, or provide the path to an
already installed Deno 2.9.6 binary using `DENO_BIN`:

```sh
npm ci --prefix scripts/tests/preanalysis-runtime --no-audit --no-fund
node scripts/build-preanalysis-edge.mjs --check --smoke
```

Optional known public IFPB canary fixture, materialized separately:

```sh
node scripts/build-preanalysis-edge.mjs --check --smoke \
  --public-pdf /absolute/path/ifpb-instrumento-reconhecimento-2017-download.pdf
```

Only SHA-256
`bbac97390a8f7a878fda6b50e92aa41e3f19d2cb3657fe05009050980aa77768`
is accepted. The script does not download it or accept arbitrary institutional
PDFs. The smoke launches Deno with remote/npm imports disabled, no network or
environment permissions, and read access only to the bundle and optional public
fixture. It replaces fetch and Worker with throwing sentinels, asserts zero
attempts, tests boot/auth, TXT, DOCX/ZIP/XML, PDF page gaps and lossless chunks.
The public fixture must contain 54 pages, with pages 6, 10, 44, 52 and 53 flagged
for manual review. No credentials or real service calls are involved.

`deno check` of the generated JavaScript is a module/syntax check, **not** a
replacement for strict typechecking the original TypeScript or the broader
synthetic suite. Those remain separate release checks.

## Deployment contract and limits

`supabase/config.toml` points only `vertice-doc-prevalidate` at
`./functions/vertice-doc-prevalidate/index.bundle.mjs`; JWT verification stays
enabled. Supabase CLI supports `.mjs` entrypoints. A deploy tool must honor that
entrypoint or explicitly use the generated file as its entrypoint and upload its
exact verified bytes. Do not upload only `index.ts`, which still uses npm imports.
The bundle contains all executed code, JSON and legal notices, so there are no
runtime npm dependencies, separately fetched fonts/CMaps, or static asset files
to upload. Keep the readable notices and manifest alongside the release record.
Rebuilding/checking is mandatory before any separately authorized deployment.

No hosted Supabase execution has been validated by this packaging check. The
current documented limits remain **2s CPU per request**, **256MB memory** and
**20MB bundled function size**, with no Web Worker API or Node vm. A cooperative
15s parser timer does not extend the 2s CPU allowance. Local timings and Deno
success are not proof of production CPU/memory compatibility. Keep release
activation off until an authorized public canary passes in the actual runtime.

Sources checked 2026-11-12:

- https://supabase.com/docs/guides/functions/limits
- https://supabase.com/docs/guides/functions/function-configuration

## Supplemental license provenance

The npm tarball for `@nodable/entities@3.1.0` declares MIT but omits its LICENSE.
The committed supplemental copy comes from the npm registry's `gitHead`
`ac48e7ea591da372be023a481875c747535812b3`:

https://raw.githubusercontent.com/nodable/val-parsers/ac48e7ea591da372be023a481875c747535812b3/LICENSE

Its SHA-256 is
`750cb3fb6362804957ef52caaf9b5c824015be44d494637330d7cd8834d31d40`.
The build verifies this hash and includes the original full notice. PDF.js,
JBIG2 and OpenJPEG notices shipped by unpdf are preserved too.
