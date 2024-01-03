import { defineConfig, devices } from "@playwright/test";

// The smoke test runs the real stack: the API on 4010 and the web app on 3010, both
// with the same throwaway key, so the web app's proxy and the API's key check are
// both exercised. A server already running on the port is reused (in CI none is, so
// both start fresh). No process.env here: env is read only in config.ts and env.ts.
const API_KEY = "e2e-key";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3010",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // `nest start` compiles against core's dist/, which a fresh clone does not have
      // yet (`pnpm verify` runs e2e before build), so core is built first.
      command:
        "pnpm --filter @alihdrndm/roomlist-core build && pnpm --filter api start",
      url: "http://localhost:4010/healthz",
      env: { API_KEY, PORT: "4010" },
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "pnpm exec next dev --port 3010",
      url: "http://localhost:3010",
      env: { API_KEY, API_BASE_URL: "http://localhost:4010" },
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
