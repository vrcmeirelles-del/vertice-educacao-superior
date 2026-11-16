import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root,
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: [
      { find: "@/lib/supabase", replacement: path.join(root, "mock.ts") },
      { find: "@", replacement: path.resolve(root, "../../../client/src") },
    ],
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT || 3000),
    allowedHosts: true,
    fs: { allow: [path.resolve(root, "../../..")] },
  },
  build: {
    outDir: path.resolve(root, "../../../planning-review-dist"),
    emptyOutDir: true,
  },
});
