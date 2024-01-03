import request from "supertest";
import { describe, expect, it } from "vitest";
import { startApp } from "./helpers.js";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

describe("size limit (e2e)", () => {
  it("FILE_TOO_LARGE: a 6 MB upload is rejected with the default config", async () => {
    const api = await startApp();
    try {
      const res = await request(api.app.getHttpServer())
        .post("/v1/rooming-lists/validate")
        .attach("file", Buffer.alloc(6 * 1024 * 1024, "a"), "big.csv");
      expect(res.status).toBe(413);
      expect(res.headers["content-type"]).toContain("application/problem+json");
      expect(res.body.code).toBe("FILE_TOO_LARGE");
    } finally {
      await api.close();
    }
  });

  it("FILE_TOO_LARGE: a file of exactly MAX_UPLOAD_BYTES passes the size limit", async () => {
    const header = "Last Name,Arrival,Departure\n";
    const row = "A,2026-11-10,2026-11-11\n";
    const text = (
      header + row.repeat(Math.ceil(MAX_UPLOAD_BYTES / row.length))
    ).slice(0, MAX_UPLOAD_BYTES);
    const bytes = Buffer.from(text);
    expect(bytes.length).toBe(MAX_UPLOAD_BYTES);

    const api = await startApp();
    try {
      const res = await request(api.app.getHttpServer())
        .post("/v1/rooming-lists/validate")
        .attach("file", bytes, "exact.csv");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(false);
      expect(
        (res.body.issues as { ruleId: string }[]).some(
          (issue) => issue.ruleId === "F007",
        ),
      ).toBe(true);
    } finally {
      await api.close();
    }
  });
});

describe("rate limit (e2e)", () => {
  it("RATE_LIMITED: the 4th request in a window is 429, health checks are exempt", async () => {
    const api = await startApp({}, { throttle: { limit: 3, ttlMs: 60_000 } });
    try {
      const server = api.app.getHttpServer();
      for (let i = 0; i < 3; i += 1) {
        await request(server).get("/v1/formats").expect(200);
      }
      const limited = await request(server).get("/v1/formats");
      expect(limited.status).toBe(429);
      expect(limited.headers["content-type"]).toContain(
        "application/problem+json",
      );
      expect(limited.body.code).toBe("RATE_LIMITED");
      expect(typeof limited.body.title).toBe("string");
      expect(limited.body.title.length).toBeGreaterThan(0);

      for (const path of ["/healthz", "/readyz"]) {
        for (let i = 0; i < 10; i += 1) {
          await request(server).get(path).expect(200);
        }
      }
    } finally {
      await api.close();
    }

    const fresh = await startApp({}, { throttle: { limit: 3, ttlMs: 60_000 } });
    try {
      await request(fresh.app.getHttpServer()).get("/v1/formats").expect(200);
    } finally {
      await fresh.close();
    }
  });
});
