import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createApp } from "../src/app.js";
import type { AppOverrides } from "../src/app.module.js";
import { type Config, defaultConfig } from "../src/config.js";

/**
 * An app plus the log lines it wrote, so tests can look at (and search) the logs.
 *
 * nestjs-pino keeps ONE logger per process (by design: production runs one app).
 * Only the first app started in a test file therefore writes to its own capture
 * stream. Tests that read logs must live in a file that starts exactly one app;
 * Vitest gives every test file a fresh process state.
 */
export type TestApp = {
  app: NestExpressApplication;
  /** Parsed JSON log lines written so far. */
  logs: () => Record<string, unknown>[];
  /** The raw log output, for "this text never appears" checks. */
  rawLogs: () => string;
  close: () => Promise<void>;
};

export async function startApp(
  config: Partial<Config> = {},
  overrides: Omit<AppOverrides, "logStream"> = {},
): Promise<TestApp> {
  let raw = "";
  const logStream = new Writable({
    write(chunk, _encoding, done) {
      raw += String(chunk);
      done();
    },
  });
  const app = await createApp(defaultConfig({ NODE_ENV: "test", ...config }), {
    ...overrides,
    logStream,
  });
  await app.init();
  return {
    app,
    logs: () =>
      raw
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => JSON.parse(line) as Record<string, unknown>),
    rawLogs: () => raw,
    close: () => app.close(),
  };
}

const fixtureUrl = (path: string) =>
  new URL(`../../../fixtures/${path}`, import.meta.url);

/** Bytes of a file under fixtures/. */
export function fixtureBytes(path: string): Buffer {
  return readFileSync(fixtureUrl(path));
}

/** Text of a file under fixtures/. */
export function fixtureText(path: string): string {
  return readFileSync(fixtureUrl(path), "utf-8");
}
