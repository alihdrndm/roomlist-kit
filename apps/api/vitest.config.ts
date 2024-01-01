import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: "./",
    include: ["src/**/*.test.ts"],
    // Nothing to unit-test yet in M0; the health endpoints are covered by e2e.
    passWithNoTests: true,
  },
});
