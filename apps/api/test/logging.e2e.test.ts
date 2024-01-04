import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtureBytes, startApp, type TestApp } from "./helpers.js";

const KEY = "log-test-secret-key";

describe("logging and request ids", () => {
  let api: TestApp;
  beforeAll(async () => {
    api = await startApp({ API_KEY: KEY });
  });
  afterAll(async () => {
    await api.close();
  });

  it("logging: no log line contains guest data (Okafor) or the API key after a validate call", async () => {
    await request(api.app.getHttpServer())
      .post("/v1/rooming-lists/validate?note=Okafor")
      .set("x-api-key", KEY)
      .set("authorization", "Bearer Okafor-token")
      .field("block", JSON.stringify({ propertyCode: "DEMO" }))
      .attach("file", fixtureBytes("input/we1.csv"), "Okafor-list.csv")
      .expect(200);
    const raw = api.rawLogs();
    expect(raw).not.toContain("Okafor");
    expect(raw).not.toContain("ada.okafor");
    expect(raw).not.toContain(KEY);
    expect(raw).not.toContain("DEMO");
  });

  it("logging: one line per request with method, path, status, duration and request id, and nothing else from the request", async () => {
    await request(api.app.getHttpServer())
      .get("/v1/formats?secret=1")
      .set("x-api-key", KEY)
      .set("user-agent", "e2e-agent/1.0")
      .expect(200);
    const line = api
      .logs()
      .filter(
        (entry) =>
          (entry.req as { path?: string } | undefined)?.path === "/v1/formats",
      )
      .at(-1);
    expect(line).toBeDefined();
    expect(line?.req).toEqual({
      id: expect.any(String),
      method: "GET",
      path: "/v1/formats",
      userAgent: "e2e-agent/1.0",
    });
    expect(line?.res).toEqual({ statusCode: 200 });
    expect(typeof line?.responseTime).toBe("number");
    expect(JSON.stringify(line)).not.toContain("secret=1");
  });

  it("request id: generated (UUID v7) when none is sent, echoed in the header", async () => {
    const res = await request(api.app.getHttpServer()).get("/healthz");
    expect(res.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("request id: a safe incoming id is kept, appears in the access log and as the problem instance", async () => {
    const res = await request(api.app.getHttpServer())
      .get("/v1/formats")
      .set("x-request-id", "trace-123.abc_DEF");
    expect(res.status).toBe(401);
    expect(res.headers["x-request-id"]).toBe("trace-123.abc_DEF");
    expect(res.body.instance).toBe("trace-123.abc_DEF");
    expect(
      api
        .logs()
        .some(
          (entry) =>
            (entry.req as { id?: string } | undefined)?.id ===
            "trace-123.abc_DEF",
        ),
    ).toBe(true);
  });

  it("request id: an unsafe or oversized id is replaced, never echoed", async () => {
    for (const unsafe of [
      "has space",
      "semi;colon",
      "x".repeat(129),
      "<script>",
    ]) {
      const res = await request(api.app.getHttpServer())
        .get("/healthz")
        .set("x-request-id", unsafe);
      expect(res.headers["x-request-id"], unsafe).not.toBe(unsafe);
      expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it("logging: a request rejected before the router (malformed URL) still gets exactly one access-log line with its id", async () => {
    const res = await request(api.app.getHttpServer())
      .get("/v1/%E0%A4%A")
      .set("x-request-id", "early-failure-1");
    expect(res.status).toBe(422);
    const lines = api
      .logs()
      .filter(
        (entry) =>
          (entry.req as { id?: string } | undefined)?.id === "early-failure-1",
      );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 40,
      req: { id: "early-failure-1", method: "GET" },
      res: { statusCode: 422 },
    });
    expect(typeof lines[0]?.responseTime).toBe("number");
    // Only the allowed request fields are present, as for every other request
    // (supertest sends no user agent, so that key is absent from the JSON line).
    const loggedFields = Object.keys(lines[0]?.req ?? {}).sort();
    expect(loggedFields).toEqual(["id", "method", "path"]);
  });

  it("security headers: helmet defaults are present and CORS is disabled", async () => {
    const res = await request(api.app.getHttpServer())
      .get("/healthz")
      .set("origin", "https://evil.example");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("security headers: the CSP has no upgrade-insecure-requests (the load balancer is plain HTTP)", async () => {
    const res = await request(api.app.getHttpServer()).get("/healthz");
    const csp = String(res.headers["content-security-policy"]);
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});
