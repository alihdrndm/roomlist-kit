import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { binaryParser } from "./binary.js";
import {
  fixtureBytes,
  fixtureText,
  startApp,
  type TestApp,
} from "./helpers.js";

type ReportIssue = {
  severity: string;
  ruleId: string;
  code: string;
  message: string;
};

describe("rooming-list endpoints, happy paths (e2e)", () => {
  let api: TestApp;
  const server = () => api.app.getHttpServer();
  const we1 = () => fixtureBytes("input/we1.csv");
  const block = () => fixtureText("blocks/tech26.json");
  const hasRule = (body: { issues: ReportIssue[] }, ruleId: string) =>
    body.issues.some((issue) => issue.ruleId === ruleId);

  beforeAll(async () => {
    api = await startApp({ API_KEY: "" });
  });
  afterAll(async () => {
    await api.close();
  });

  describe("validate", () => {
    it("validate: WE1 without a block gives the exact report", async () => {
      const res = await request(server())
        .post("/v1/rooming-lists/validate")
        .attach("file", we1(), "we1.csv");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      expect(res.body.ok).toBe(true);
      expect(res.body.format).toBe("csv");
      expect(res.body.rowCount).toBe(4);
      expect(res.body.entries).toHaveLength(4);
      expect(res.body.issues).toEqual([]);
      expect(res.body.summary).toEqual({
        entries: 4,
        primaries: 3,
        sharers: 1,
        rooms: 3,
        people: 6,
        roomNights: 9,
        firstArrival: "2026-11-10",
        lastDeparture: "2026-11-14",
        byRoomType: [
          { roomType: "KING", rooms: 2, roomNights: 5 },
          { roomType: "QQ", rooms: 1, roomNights: 4 },
        ],
        byNight: [
          { date: "2026-11-10", rooms: 2 },
          { date: "2026-11-11", rooms: 3 },
          { date: "2026-11-12", rooms: 3 },
          { date: "2026-11-13", rooms: 1 },
        ],
      });
      expect(res.body.columns).toContainEqual({
        header: "Last Name",
        field: "lastName",
      });
      for (const column of res.body.columns) {
        expect(column).toHaveProperty("header");
        expect(column).toHaveProperty("field");
      }
    });

    it("validate: WE1 with the tech26 block (text part) has no issues", async () => {
      const res = await request(server())
        .post("/v1/rooming-lists/validate")
        .attach("file", we1(), "we1.csv")
        .field("block", block());
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.issues).toEqual([]);
    });

    it("validate: all-rules.csv answers 200 with ok false and sorted issues", async () => {
      const res = await request(server())
        .post("/v1/rooming-lists/validate")
        .attach("file", fixtureBytes("input/all-rules.csv"), "all-rules.csv")
        .field("block", block());
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(false);
      const issues = res.body.issues as ReportIssue[];
      expect(issues.some((issue) => issue.severity === "error")).toBe(true);
      for (const issue of issues) {
        expect(typeof issue.severity).toBe("string");
        expect(typeof issue.ruleId).toBe("string");
        expect(typeof issue.code).toBe("string");
        expect(typeof issue.message).toBe("string");
      }
      const ranks = issues.map((issue) => (issue.severity === "error" ? 0 : 1));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    });

    it("validate: clean-40.xlsx with the block reads as xlsx with no issues", async () => {
      const res = await request(server())
        .post("/v1/rooming-lists/validate")
        .attach("file", fixtureBytes("input/clean-40.xlsx"), "clean-40.xlsx")
        .field("block", block());
      expect(res.status).toBe(200);
      expect(res.body.format).toBe("xlsx");
      expect(res.body.rowCount).toBe(40);
      expect(res.body.issues).toEqual([]);
    });

    it("validate: the dateOrder option decides how dmy-dates.csv reads", async () => {
      const file = fixtureBytes("input/dmy-dates.csv");
      const withOption = await request(server())
        .post("/v1/rooming-lists/validate")
        .attach("file", file, "dmy-dates.csv")
        .field("options", JSON.stringify({ dateOrder: "DMY" }));
      expect(withOption.status).toBe(200);
      expect(withOption.body.ok).toBe(true);

      const without = await request(server())
        .post("/v1/rooming-lists/validate")
        .attach("file", file, "dmy-dates.csv");
      expect(without.status).toBe(200);
      expect(without.body.ok).toBe(false);
      expect(hasRule(without.body, "R002")).toBe(true);
    });

    it("validate: an unknown sheet name is F003 (UNSUPPORTED_FORMAT) with status 200", async () => {
      const res = await request(server())
        .post("/v1/rooming-lists/validate")
        .attach("file", fixtureBytes("input/clean-40.xlsx"), "clean-40.xlsx")
        .field("options", JSON.stringify({ sheetName: "Nope" }));
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(false);
      const issue = (res.body.issues as ReportIssue[]).find(
        (found) => found.ruleId === "F003",
      );
      expect(issue?.code).toBe("UNSUPPORTED_FORMAT");
    });

    it("validate: an empty file is F001", async () => {
      const res = await request(server())
        .post("/v1/rooming-lists/validate")
        .attach("file", Buffer.alloc(0), "empty.csv");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(false);
      expect(hasRule(res.body, "F001")).toBe(true);
    });

    it("validate: legacy .xls bytes are F003", async () => {
      const res = await request(server())
        .post("/v1/rooming-lists/validate")
        .attach("file", Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), "old.xls");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(false);
      expect(hasRule(res.body, "F003")).toBe(true);
    });

    it("validate: invalid UTF-8 is F004", async () => {
      const res = await request(server())
        .post("/v1/rooming-lists/validate")
        .attach("file", Buffer.from([0xff, 0xfe, 0xfd, 0x80, 0x41]), "bad.csv");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(false);
      expect(hasRule(res.body, "F004")).toBe(true);
    });

    it("validate: more rows than MAX_ROWS is F007", async () => {
      const small = await startApp({ API_KEY: "", MAX_ROWS: 2 });
      try {
        const res = await request(small.app.getHttpServer())
          .post("/v1/rooming-lists/validate")
          .attach("file", we1(), "we1.csv");
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(false);
        expect(hasRule(res.body, "F007")).toBe(true);
      } finally {
        await small.close();
      }
    });
  });

  describe("convert", () => {
    const convert = (target: string, targetOptions?: object) => {
      const req = request(server())
        .post("/v1/rooming-lists/convert")
        .attach("file", we1(), "we1.csv")
        .field("block", block())
        .field("target", target);
      if (targetOptions !== undefined) {
        req.field("targetOptions", JSON.stringify(targetOptions));
      }
      return req.buffer(true).parse(binaryParser);
    };
    const sameBytes = (actual: Buffer, path: string) =>
      Buffer.compare(actual, fixtureBytes(path)) === 0;

    it("WE1 convert: maestro-csv matches the golden file and headers", async () => {
      const res = await convert("maestro-csv", { buildingCode: "MAIN" });
      expect(res.status).toBe(200);
      expect(sameBytes(res.body, "expected/we1.maestro.csv")).toBe(true);
      expect(res.headers["content-type"]).toBe("text/csv; charset=utf-8");
      expect(res.headers["content-disposition"]).toBe(
        'attachment; filename="rooming-list-maestro.csv"',
      );
      expect(res.headers["x-roomlist-warnings"]).toBe("0");
    });

    it("WE1 convert: opera5-xml matches the golden file", async () => {
      const res = await convert("opera5-xml");
      expect(res.status).toBe(200);
      expect(sameBytes(res.body, "expected/we1.opera5.xml")).toBe(true);
      expect(res.headers["content-type"]).toContain("application/xml");
      expect(res.headers["content-disposition"]).toContain(
        'filename="rooming-list-opera5.xml"',
      );
    });

    it("WE1 convert: canonical-json matches the golden file", async () => {
      const res = await convert("canonical-json");
      expect(res.status).toBe(200);
      expect(sameBytes(res.body, "expected/we1.canonical.json")).toBe(true);
    });

    it("WE1 convert: canonical-csv matches the golden file", async () => {
      const res = await convert("canonical-csv");
      expect(res.status).toBe(200);
      expect(sameBytes(res.body, "expected/we1.canonical.csv")).toBe(true);
    });

    it("WE1 convert: opera-cloud-xlsx returns a real xlsx file", async () => {
      const res = await convert("opera-cloud-xlsx");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      expect([...res.body.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
      expect(res.headers["content-disposition"]).toContain(
        'filename="rooming-list-opera-cloud.xlsx"',
      );
    });

    it("convert: x-roomlist-warnings equals the warnings /validate reports", async () => {
      const file = fixtureBytes("input/messy-headers.csv");
      const options = JSON.stringify({
        columnMap: { "Roommate Line": "sharesWithLine" },
      });
      const validated = await request(server())
        .post("/v1/rooming-lists/validate")
        .attach("file", file, "messy-headers.csv")
        .field("options", options);
      expect(validated.status).toBe(200);
      const warnings = (validated.body.issues as ReportIssue[]).filter(
        (issue) => issue.severity === "warning",
      ).length;
      expect(warnings).toBeGreaterThan(0);

      const res = await request(server())
        .post("/v1/rooming-lists/convert")
        .attach("file", file, "messy-headers.csv")
        .field("options", options)
        .field("target", "canonical-json")
        .buffer(true)
        .parse(binaryParser);
      expect(res.status).toBe(200);
      expect(res.headers["x-roomlist-warnings"]).toBe(String(warnings));
    });
  });

  describe("diff", () => {
    const diff = () =>
      request(server())
        .post("/v1/rooming-lists/diff")
        .attach("before", fixtureBytes("input/list-v1.csv"), "list-v1.csv")
        .attach("after", fixtureBytes("input/list-v2.csv"), "list-v2.csv");

    it("diff: list-v1 against list-v2 matches the expected report", async () => {
      const res = await diff();
      expect(res.status).toBe(200);
      expect(res.body.summary).toEqual(
        JSON.parse(fixtureText("expected/diff-v1-v2.json")),
      );
      const lines = (entries: { line: number }[]) =>
        entries.map((entry) => entry.line);
      expect(lines(res.body.added)).toEqual([17, 18, 19]);
      expect(lines(res.body.removed)).toEqual([13, 16]);
      const changed = (
        res.body.changed as {
          after: { line: number };
          changes: {
            field: string;
            before: string | null;
            after: string | null;
          }[];
        }[]
      ).find((entry) => entry.after.line === 7);
      expect(changed?.changes).toEqual([
        { field: "sharesWith", before: "Eze, Tobias", after: "Lopez, Marco" },
      ]);
    });

    it("diff: accepts an options text part", async () => {
      const res = await diff().field(
        "options",
        JSON.stringify({ dateOrder: "MDY" }),
      );
      expect(res.status).toBe(200);
      expect(res.body.summary.added).toBe(3);
    });
  });

  describe("formats", () => {
    it("formats: lists the five targets with provenance", async () => {
      const res = await request(server()).get("/v1/formats");
      expect(res.status).toBe(200);
      const targets = res.body.targets as {
        id: string;
        label: string;
        fileExtension: string;
        contentType: string;
        optionsSchema: unknown;
        provenance: { status: string; source: string }[];
      }[];
      expect(targets.map((t) => t.id)).toEqual([
        "opera5-xml",
        "opera-cloud-xlsx",
        "maestro-csv",
        "canonical-json",
        "canonical-csv",
      ]);
      for (const target of targets) {
        expect(target.label.length).toBeGreaterThan(0);
        expect(target.fileExtension.length).toBeGreaterThan(0);
        expect(target.contentType.length).toBeGreaterThan(0);
        expect(typeof target.optionsSchema).toBe("object");
        expect(target.optionsSchema).not.toBeNull();
        expect(Array.isArray(target.provenance)).toBe(true);
      }
      const maestro = targets.find((t) => t.id === "maestro-csv");
      const statuses = maestro?.provenance.map((p) => p.status) ?? [];
      expect(statuses).toContain("verified");
      expect(statuses).toContain("assumed");
      for (const entry of maestro?.provenance ?? []) {
        expect(entry.source.length).toBeGreaterThan(0);
      }
      for (const id of ["canonical-json", "canonical-csv"]) {
        expect(targets.find((t) => t.id === id)?.provenance).toEqual([]);
      }
    });
  });
});
