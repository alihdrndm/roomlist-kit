import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // The e2e tests spawn the built binary; give slow CI machines room.
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      // No thresholds: HANDOFF.md sets them for packages/core only, and code that
      // runs inside the spawned binary is not measured by in-process coverage.
    },
  },
});
