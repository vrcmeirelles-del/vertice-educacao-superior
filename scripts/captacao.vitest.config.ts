import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '../client/src') } },
  test: { environment: 'node', include: ['client/src/lib/captacao-integrada*.test.ts'], environmentMatchGlobs: [['**/*.ui.test.ts', 'jsdom']], maxWorkers: 1, minWorkers: 1 },
});
