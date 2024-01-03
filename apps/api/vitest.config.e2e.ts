import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Vite resolves tsconfig paths natively; no plugin needed.
    tsconfigPaths: true,
    alias: {
      "@alihdrndm/roomlist-core": fileURLToPath(
        new URL("../../packages/core/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    root: "./",
    include: ["test/**/*.e2e.test.ts"],
    // Uploading a 6 MB file and spinning up Nest per test file needs room on slow CI machines.
    testTimeout: 30_000,
  },
});
