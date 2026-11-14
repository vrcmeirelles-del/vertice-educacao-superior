import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '../client/src') } },
  test: {
    environment: 'jsdom',
    include: ['client/src/components/bi/TypeScriptRegression.ui.test.tsx'],
    maxWorkers: 1, minWorkers: 1,
  },
});
