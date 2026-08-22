import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Mirrors tsconfig.json's "@jstack/*" -> "../*" mapping. tsc and Next's own bundler already
      // resolve this (see src/lib/config-reader.ts, src/app/reports/page.tsx); vitest has its own
      // resolver and needs the same alias explicitly, or any test importing a module that touches
      // "@jstack/*" -- even transitively -- fails with "Cannot find package" despite the real app
      // working fine. No existing test happened to exercise that import path, so this went unnoticed.
      "@jstack": path.resolve(__dirname, ".."),
    },
  },
});
