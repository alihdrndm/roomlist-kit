import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Vite resolves tsconfig paths natively; no plugin needed.
    tsconfigPaths: true,
    alias: {
      // Run against core's source so `pnpm test` works before core is built
      // (the same idea as the "@alihdrndm/source" condition used for typechecking).
      "@alihdrndm/roomlist-core": fileURLToPath(
        new URL("../../packages/core/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    root: "./",
    include: ["src/**/*.test.ts"],
    // Unit tests arrive with the first pure helpers; the HTTP behaviour is covered by e2e.
    passWithNoTests: true,
  },
});
