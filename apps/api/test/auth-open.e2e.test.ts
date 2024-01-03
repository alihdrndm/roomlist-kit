import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NO_API_KEY_WARNING } from "../src/app.js";
import { fixtureBytes, startApp, type TestApp } from "./helpers.js";

// Its own file (one app, one log stream): see the note on startApp.
describe("auth: API_KEY unset", () => {
  let api: TestApp;
  beforeAll(async () => {
    api = await startApp({ API_KEY: "" });
  });
  afterAll(async () => {
    await api.close();
  });

  it("auth: /v1 is open and the warning is logged exactly once at boot", async () => {
    for (let i = 0; i < 2; i++) {
      await request(api.app.getHttpServer())
        .post("/v1/rooming-lists/validate")
        .attach("file", fixtureBytes("input/we1.csv"), "we1.csv")
        .expect(200);
    }
    const warnings = api
      .logs()
      .filter((line) => line.msg === NO_API_KEY_WARNING);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.level).toBe(40);
  });

  it("auth: an x-api-key header is simply ignored when no key is configured", async () => {
    await request(api.app.getHttpServer())
      .get("/v1/formats")
      .set("x-api-key", "anything")
      .expect(200);
  });
});
