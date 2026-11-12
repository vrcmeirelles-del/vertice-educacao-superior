import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '../client/src') } },
  test: { environment: 'node', include: ['client/src/lib/bi/reitor-summary.test.ts', 'client/src/components/bi/ReitorBI.ui.test.ts', 'client/src/lib/preanalysis.ui.test.ts'], environmentMatchGlobs: [['**/*.ui.test.ts', 'jsdom']], maxWorkers: 1, minWorkers: 1 },
});
