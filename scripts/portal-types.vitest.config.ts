import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '../client/src') } },
  test: { environment: 'node', include: ['client/src/lib/bi/reitor-summary.test.ts', 'client/src/components/bi/ReitorBI.ui.test.ts', 'client/src/components/bi/PortalBI.scope.ui.test.tsx', 'client/src/lib/academic-coverage.test.ts', 'client/src/lib/enrollment-summary.test.ts', 'client/src/lib/student-support-contracts.test.ts', 'client/src/lib/student-support.ui.test.ts'], environmentMatchGlobs: [['**/*.ui.test.{ts,tsx}', 'jsdom']], maxWorkers: 1, minWorkers: 1 },
});
