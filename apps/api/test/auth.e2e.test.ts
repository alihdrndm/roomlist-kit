import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { keysMatch } from "../src/api-key.guard.js";
import { NO_API_KEY_WARNING } from "../src/app.js";
import { fixtureBytes, startApp, type TestApp } from "./helpers.js";

// One app per file: see the note on startApp (log capture). The API_KEY-unset case
// is in auth-open.e2e.test.ts.
const KEY = "correct-horse-battery-staple";
let api: TestApp;

beforeAll(async () => {
  api = await startApp({ API_KEY: KEY });
});
afterAll(async () => {
  await api.close();
});

const validate = () =>
  request(api.app.getHttpServer())
    .post("/v1/rooming-lists/validate")
    .attach("file", fixtureBytes("input/we1.csv"), "we1.csv");

describe("auth: API_KEY set", () => {
  it("auth: a missing key is 401 UNAUTHORIZED as problem+json", async () => {
    const res = await validate();
    expect(res.status).toBe(401);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.body).toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      title: "Unauthorized",
    });
  });

  it("auth: a wrong key (any length) is 401 with the same message as a missing key", async () => {
    const missing = await validate();
    for (const wrong of ["x", `${KEY}x`, KEY.slice(1), "a".repeat(5000)]) {
      const res = await validate().set("x-api-key", wrong);
      expect(res.status).toBe(401);
      expect(res.body.detail).toBe(missing.body.detail);
    }
  });

  it("auth: the right key passes on every /v1 endpoint", async () => {
    expect((await validate().set("x-api-key", KEY)).status).toBe(200);
    await request(api.app.getHttpServer())
      .get("/v1/formats")
      .set("x-api-key", KEY)
      .expect(200);
    await request(api.app.getHttpServer()).get("/v1/formats").expect(401);
  });

  it("auth: the key is checked before the upload is read", async () => {
    // No file at all: a 401 (not FILE_REQUIRED) proves the guard ran first.
    const res = await request(api.app.getHttpServer()).post(
      "/v1/rooming-lists/convert",
    );
    expect(res.status).toBe(401);
  });

  it("auth: /healthz, /readyz, /docs and /docs-json never need the key", async () => {
    for (const path of ["/healthz", "/readyz", "/docs", "/docs-json"]) {
      const res = await request(api.app.getHttpServer()).get(path);
      expect(res.status, path).toBe(200);
    }
  });

  it("auth: the boot warning is not logged when a key is set", () => {
    expect(api.rawLogs()).not.toContain(NO_API_KEY_WARNING);
  });

  it("auth: keysMatch compares equal-length hashes, so different lengths neither throw nor match", () => {
    expect(keysMatch("a", "a")).toBe(true);
    expect(keysMatch("a", "b")).toBe(false);
    expect(() => keysMatch("short", "a much longer secret")).not.toThrow();
    expect(keysMatch("short", "a much longer secret")).toBe(false);
  });
});
