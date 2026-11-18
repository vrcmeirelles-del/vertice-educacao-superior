import { defineConfig } from "vitest/config";
import path from "node:path";
const build = path.resolve(process.env.VERTICE_BUILD || ".operations-build");
const repo = path.resolve(process.env.VERTICE_REPO || ".");
export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(build, "client/src"),
      "@shared": path.join(build, "shared"),
      "@operations-model": path.join(
        build,
        "client/src/components/enade-operations/model.ts",
      ),
      "@electric-sql/pglite": path.join(
        build,
        "node_modules/@electric-sql/pglite/dist/index.js",
      ),
      vitest: path.join(build, "node_modules/vitest/dist/index.js"),
    },
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: [
      path.join(
        build,
        "client/src/components/enade-operations/*.test.{ts,tsx}",
      ),
      path.join(repo, "scripts/enade360/operations.database.test.ts"),
    ],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
