import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startApp, type TestApp } from "./helpers.js";

describe("health endpoints (e2e)", () => {
  let api: TestApp;

  beforeAll(async () => {
    api = await startApp();
  });

  afterAll(async () => {
    await api.close();
  });

  it("GET /healthz returns {status: ok}", async () => {
    const res = await request(api.app.getHttpServer())
      .get("/healthz")
      .expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /readyz returns 200 (no backing services)", async () => {
    await request(api.app.getHttpServer()).get("/readyz").expect(200);
  });
});
