import ExcelJS from "exceljs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  fixtureBytes,
  fixtureText,
  startApp,
  type TestApp,
} from "./helpers.js";

// Behaviour added after the M6 review. Nothing here reads logs, so one file may
// start several apps (see the note on startApp).
let api: TestApp;
beforeAll(async () => {
  api = await startApp();
});
afterAll(async () => {
  await api.close();
});

const server = () => api.app.getHttpServer();
const we1 = () => fixtureBytes("input/we1.csv");

describe("error paths found in review", () => {
  it("VALIDATION_FAILED: a root-level targetOptions problem has the path 'targetOptions' with no trailing dot", async () => {
    for (const bad of ["5", "[]", '"text"']) {
      const res = await request(server())
        .post("/v1/rooming-lists/convert")
        .field("target", "canonical-json")
        .field("targetOptions", bad)
        .attach("file", we1(), "we1.csv");
      expect(res.status, bad).toBe(422);
      expect(
        res.body.errors.map((e: { path: string }) => e.path),
        bad,
      ).toEqual(["targetOptions"]);
    }
  });

  it("FILE_REQUIRED: a JSON body (of any size or shape) is never parsed; it is simply not a file upload", async () => {
    // The API takes multipart only, so the default JSON parser is off: a huge or malformed
    // JSON body cannot make the server buffer or parse anything, and cannot raise a framework error.
    for (const body of [
      JSON.stringify({ filler: "x".repeat(200_000) }),
      '{"a":',
    ]) {
      const res = await request(server())
        .post("/v1/rooming-lists/validate")
        .set("content-type", "application/json")
        .send(body);
      expect(res.status).toBe(400);
      expect(res.headers["content-type"]).toContain("application/problem+json");
      expect(res.body.code).toBe("FILE_REQUIRED");
    }
  });

  it("VALIDATION_FAILED: a malformed URL is a problem+json 422, not an HTML 500", async () => {
    const res = await request(server()).get("/v1/%E0%A4%A");
    expect(res.status).toBe(422);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.body.code).toBe("VALIDATION_FAILED");
    expect(res.body.instance).toBe(res.headers["x-request-id"]);
  });
});

describe("happy path with WE1 for diff", () => {
  it("WE1: diffing the worked example against itself reports four unchanged guests", async () => {
    const res = await request(server())
      .post("/v1/rooming-lists/diff")
      .attach("before", we1(), "we1.csv")
      .attach("after", we1(), "we1.csv");
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      added: 0,
      removed: 0,
      changed: 0,
      unchanged: 4,
      roomNightsBefore: 9,
      roomNightsAfter: 9,
      roomNightsDelta: 0,
    });
    expect(res.body.added).toEqual([]);
  });
});

describe("hostile uploads stay cheap", () => {
  it("an xlsx with one cell far down and one far right is answered with a report, fast", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Guests");
    sheet.addRow(["Last Name", "Arrival", "Departure"]);
    sheet.addRow(["Okafor", "2026-11-10", "2026-11-12"]);
    sheet.getCell("ALL1").value = "far right";
    sheet.getCell("A10000").value = "far down";
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    const started = performance.now();
    const res = await request(server())
      .post("/v1/rooming-lists/validate")
      .attach("file", bytes, "sparse.xlsx");
    expect(performance.now() - started).toBeLessThan(5000);
    expect(res.status).toBe(200);
    expect(res.body.format).toBe("xlsx");
    // The server stays responsive: a probe right after is answered.
    await request(server()).get("/healthz").expect(200);
  }, 30_000);

  it("an xlsx whose zip directory declares 200 MB unpacked is refused with F003 before it is unpacked", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Guests").addRow(["Last Name"]);
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    for (let at = bytes.length - 22; at >= 0; at--) {
      if (bytes.readUInt32LE(at) === 0x06054b50) {
        bytes.writeUInt32LE(
          200 * 1024 * 1024,
          bytes.readUInt32LE(at + 16) + 24,
        );
        break;
      }
    }
    const res = await request(server())
      .post("/v1/rooming-lists/validate")
      .attach("file", bytes, "bomb.xlsx");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.issues[0]).toMatchObject({
      ruleId: "F003",
      code: "UNSUPPORTED_FORMAT",
    });
    expect(res.body.issues[0].message).toContain("too large when unpacked");
  });

  it("a 5 MB CSV with one 2.5-million-cell row gets a small report: 50 warnings and one summary", async () => {
    const wide = `${"a,".repeat(2_400_000)}a`;
    const csv = `Last Name,Arrival,Departure\nOkafor,2026-11-10,2026-11-12,${wide}\n`;
    expect(csv.length).toBeLessThan(5 * 1024 * 1024);
    const res = await request(server())
      .post("/v1/rooming-lists/validate")
      .attach("file", Buffer.from(csv), "wide.csv");
    expect(res.status).toBe(200);
    const w201 = res.body.issues.filter(
      (issue: { ruleId: string }) => issue.ruleId === "W201",
    );
    expect(w201).toHaveLength(51);
    expect(JSON.stringify(res.body).length).toBeLessThan(100_000);
  }, 60_000);

  it("a very wide header row of unknown columns also gives a small report", async () => {
    const header = `Last Name,Arrival,Departure,${Array.from({ length: 200_000 }, (_, n) => `x${n}`).join(",")}`;
    const res = await request(server())
      .post("/v1/rooming-lists/validate")
      .attach(
        "file",
        Buffer.from(`${header}\nOkafor,2026-11-10,2026-11-12\n`),
        "wide-header.csv",
      );
    expect(res.status).toBe(200);
    expect(res.body.columns.length).toBeLessThanOrEqual(53);
    expect(JSON.stringify(res.body).length).toBeLessThan(100_000);
  }, 60_000);
});

describe("rate limit default", () => {
  it("RATE_LIMITED: the shipped limit is 120 requests per minute (the 121st request is refused)", async () => {
    const limited = await startApp();
    try {
      for (let i = 1; i <= 120; i++) {
        const res = await request(limited.app.getHttpServer()).get(
          "/v1/formats",
        );
        expect(res.status, `request ${i}`).toBe(200);
      }
      const res = await request(limited.app.getHttpServer()).get("/v1/formats");
      expect(res.status).toBe(429);
      expect(res.body.code).toBe("RATE_LIMITED");
    } finally {
      await limited.close();
    }
  }, 60_000);
});

describe("fixture sanity", () => {
  it("helpers read fixtures", () => {
    expect(fixtureText("blocks/tech26.json")).toContain("TECH26");
  });
});
