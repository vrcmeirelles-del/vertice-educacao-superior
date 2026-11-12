import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Render the same public React entry with a Node-compatible bundle. CSS is
// already emitted by Vite; server rendering does not execute stylesheet imports.
// Keep dependencies external so React and its renderer share one installation.
const temporary = await mkdtemp(resolve('.prerender-'));
try {
  const outfile = join(temporary, 'entry.mjs');
  await build({
    entryPoints: [resolve('scripts/prerender.tsx')],
    outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external',
    jsx: 'automatic', loader: { '.css': 'empty' },
    alias: { '@': resolve('client/src'), '@shared': resolve('shared') },
  });
  await import(pathToFileURL(outfile).href);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
