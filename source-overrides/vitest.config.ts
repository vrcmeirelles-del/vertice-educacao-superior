import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@shared": path.resolve(import.meta.dirname, "shared"), "@": path.resolve(import.meta.dirname, "client/src") } },
  esbuild: { jsx: "automatic" },
  test: { environment: "node", include: ["server/**/*.test.ts", "client/src/components/area/InstitutionTabs.test.tsx"] },
});
