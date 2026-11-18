import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '../client/src') } },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['client/src/components/area/Teaching*.ui.test.tsx'],
    maxWorkers: 1,
    minWorkers: 1,
  },
});
