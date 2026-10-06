import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  fixtureBytes,
  fixtureText,
  startApp,
  type TestApp,
} from "./helpers.js";

type FieldError = { path: string; code: string; message: string };
type ProblemIssue = {
  severity: string;
  ruleId: string;
  code: string;
  message: string;
  field?: string;
  side?: string;
};

function hasKey(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasKey(item, key));
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).some(
      ([name, child]) => name === key || hasKey(child, key),
    );
  }
  return false;
}

function expectProblem(
  res: request.Response,
  status: number,
  code: string,
): void {
  expect(res.status).toBe(status);
  expect(res.headers["content-type"]).toContain("application/problem+json");
  expect(res.body.status).toBe(status);
  expect(res.body.code).toBe(code);
  expect(typeof res.body.title).toBe("string");
  expect(res.body.title.length).toBeGreaterThan(0);
  expect(typeof res.body.detail).toBe("string");
  expect(res.body.detail.length).toBeGreaterThan(0);
  expect(String(res.body.type).endsWith(`docs/ERRORS.md#${code}`)).toBe(true);
  expect(res.body.instance).toBe(res.headers["x-request-id"]);
  expect(hasKey(res.body, "stack")).toBe(false);
}

const errorsOf = (res: request.Response) => res.body.errors as FieldError[];
const issuesOf = (res: request.Response) => res.body.issues as ProblemIssue[];

describe("error responses (e2e)", () => {
  let api: TestApp;
  const server = () => api.app.getHttpServer();
  const we1 = () => fixtureBytes("input/we1.csv");
  const block = () => fixtureText("blocks/tech26.json");
  const validate = () =>
    request(server())
      .post("/v1/rooming-lists/validate")
      .attach("file", we1(), "we1.csv");
  const convert = (target?: string) => {
    const req = request(server())
      .post("/v1/rooming-lists/convert")
      .attach("file", we1(), "we1.csv");
    if (target !== undefined) req.field("target", target);
    return req;
  };

  beforeAll(async () => {
    api = await startApp({ API_KEY: "" });
  });
  afterAll(async () => {
    await api.close();
  });

  describe("FILE_REQUIRED", () => {
    it("FILE_REQUIRED: validate without a file", async () => {
      const res = await request(server()).post("/v1/rooming-lists/validate");
      expectProblem(res, 400, "FILE_REQUIRED");
    });

    it("FILE_REQUIRED: convert without a file", async () => {
      const res = await request(server())
        .post("/v1/rooming-lists/convert")
        .field("target", "canonical-json");
      expectProblem(res, 400, "FILE_REQUIRED");
    });

    it("FILE_REQUIRED: diff with only before", async () => {
      const res = await request(server())
        .post("/v1/rooming-lists/diff")
        .attach("before", we1(), "we1.csv");
      expectProblem(res, 400, "FILE_REQUIRED");
    });

    it("FILE_REQUIRED: diff with only after", async () => {
      const res = await request(server())
        .post("/v1/rooming-lists/diff")
        .attach("after", we1(), "we1.csv");
      expectProblem(res, 400, "FILE_REQUIRED");
    });

    it("FILE_REQUIRED: a plain JSON body", async () => {
      const res = await request(server())
        .post("/v1/rooming-lists/validate")
        .set("content-type", "application/json")
        .send({});
      expectProblem(res, 400, "FILE_REQUIRED");
    });
  });

  describe("VALIDATION_FAILED", () => {
    it("VALIDATION_FAILED: unknown target", async () => {
      const res = await convert("pms-9000");
      expectProblem(res, 422, "VALIDATION_FAILED");
      expect(errorsOf(res).map((e) => e.path)).toContain("target");
    });

    it("VALIDATION_FAILED: missing target", async () => {
      const res = await convert();
      expectProblem(res, 422, "VALIDATION_FAILED");
      expect(errorsOf(res).map((e) => e.path)).toContain("target");
    });

    it("VALIDATION_FAILED: block that is not JSON", async () => {
      const res = await validate().field("block", "{not json");
      expectProblem(res, 422, "VALIDATION_FAILED");
      expect(errorsOf(res)).toContainEqual(
        expect.objectContaining({ path: "block", code: "custom" }),
      );
    });

    it("VALIDATION_FAILED: block with shoulderDays out of range", async () => {
      const res = await validate().field(
        "block",
        JSON.stringify({ shoulderDays: 9 }),
      );
      expectProblem(res, 422, "VALIDATION_FAILED");
      expect(errorsOf(res).map((e) => e.path)).toContain("block.shoulderDays");
    });

    it("VALIDATION_FAILED: block with endDate but no startDate", async () => {
      const res = await validate().field(
        "block",
        JSON.stringify({ endDate: "2026-11-14" }),
      );
      expectProblem(res, 422, "VALIDATION_FAILED");
      expect(errorsOf(res).map((e) => e.path)).toContain("block.startDate");
    });

    it("VALIDATION_FAILED: options may not set maxRows", async () => {
      const res = await validate().field(
        "options",
        JSON.stringify({ maxRows: 10 }),
      );
      expectProblem(res, 422, "VALIDATION_FAILED");
      expect(errorsOf(res)).toContainEqual(
        expect.objectContaining({
          path: "options.maxRows",
          code: "unrecognized_keys",
        }),
      );
    });

    it("VALIDATION_FAILED: options with a bad dateOrder", async () => {
      const res = await validate().field(
        "options",
        JSON.stringify({ dateOrder: "YMD" }),
      );
      expectProblem(res, 422, "VALIDATION_FAILED");
      expect(errorsOf(res).map((e) => e.path)).toContain("options.dateOrder");
    });

    it("VALIDATION_FAILED: unknown text part", async () => {
      const res = await validate().field("surprise", "1");
      expectProblem(res, 422, "VALIDATION_FAILED");
      expect(errorsOf(res)).toContainEqual(
        expect.objectContaining({
          path: "surprise",
          code: "unrecognized_keys",
        }),
      );
    });

    it("VALIDATION_FAILED: two bad parts report two errors", async () => {
      const res = await validate()
        .field("block", "{not json")
        .field("options", JSON.stringify({ maxRows: 10 }));
      expectProblem(res, 422, "VALIDATION_FAILED");
      expect(errorsOf(res)).toHaveLength(2);
    });

    it("VALIDATION_FAILED: opera5-xml targetOptions", async () => {
      const res = await convert("opera5-xml").field(
        "targetOptions",
        JSON.stringify({ rootElement: "has space" }),
      );
      expectProblem(res, 422, "VALIDATION_FAILED");
      expect(errorsOf(res).map((e) => e.path)).toContain(
        "targetOptions.rootElement",
      );
    });

    it("VALIDATION_FAILED: maestro-csv targetOptions", async () => {
      const res = await convert("maestro-csv").field(
        "targetOptions",
        JSON.stringify({ includeHeader: "yes" }),
      );
      expectProblem(res, 422, "VALIDATION_FAILED");
      expect(errorsOf(res).map((e) => e.path)).toContain(
        "targetOptions.includeHeader",
      );
    });

    it("VALIDATION_FAILED: canonical-json takes no targetOptions", async () => {
      const res = await convert("canonical-json").field(
        "targetOptions",
        JSON.stringify({ a: 1 }),
      );
      expectProblem(res, 422, "VALIDATION_FAILED");
      expect(errorsOf(res)).toContainEqual(
        expect.objectContaining({
          path: "targetOptions.a",
          code: "unrecognized_keys",
        }),
      );
    });

    it("VALIDATION_FAILED: targetOptions that is not JSON", async () => {
      const res = await convert("canonical-json").field(
        "targetOptions",
        "{not json",
      );
      expectProblem(res, 422, "VALIDATION_FAILED");
      expect(errorsOf(res).map((e) => e.path)).toContain("targetOptions");
    });

    it("VALIDATION_FAILED: a JSON part sent as a file upload", async () => {
      const res = await validate().attach("block", Buffer.from("{}"), "b.json");
      expectProblem(res, 422, "VALIDATION_FAILED");
      // Nest's own wording names the field; the hint tells the caller what to do instead.
      expect(res.body.detail).toContain("Unexpected file field - block");
      expect(res.body.detail).toContain("plain text fields, not file uploads");
    });

    it("VALIDATION_FAILED: a third file part name", async () => {
      const res = await validate().attach("extra", we1(), "extra.csv");
      expectProblem(res, 422, "VALIDATION_FAILED");
    });
  });

  describe("LIST_INVALID", () => {
    it("LIST_INVALID: convert of all-rules.csv returns the issues as JSON", async () => {
      const res = await request(server())
        .post("/v1/rooming-lists/convert")
        .attach("file", fixtureBytes("input/all-rules.csv"), "all-rules.csv")
        .field("block", block())
        .field("target", "canonical-json");
      expectProblem(res, 422, "LIST_INVALID");
      const issues = issuesOf(res);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((issue) => issue.ruleId === "R003")).toBe(true);
      for (const issue of issues) {
        expect(typeof issue.severity).toBe("string");
        expect(typeof issue.ruleId).toBe("string");
        expect(typeof issue.code).toBe("string");
        expect(typeof issue.message).toBe("string");
      }
      expect(issues.some((issue) => issue.severity === "error")).toBe(true);
    });

    it("LIST_INVALID: a parser-only error also blocks convert", async () => {
      const csv = Buffer.from(
        "Last Name,Arrival,Departure,Rooms\nOkafor,2026-11-10,2026-11-12,abc\n",
      );
      const res = await request(server())
        .post("/v1/rooming-lists/convert")
        .attach("file", csv, "bad.csv")
        .field("target", "canonical-json");
      expectProblem(res, 422, "LIST_INVALID");
      expect(issuesOf(res).some((issue) => issue.ruleId === "R006")).toBe(true);
    });

    it("LIST_INVALID: diff tags each issue with its side", async () => {
      const res = await request(server())
        .post("/v1/rooming-lists/diff")
        .attach("before", fixtureBytes("input/all-rules.csv"), "all-rules.csv")
        .attach("after", fixtureBytes("input/list-v2.csv"), "list-v2.csv");
      expectProblem(res, 422, "LIST_INVALID");
      const issues = issuesOf(res);
      expect(issues.length).toBeGreaterThan(0);
      for (const issue of issues) expect(issue.side).toBeDefined();
      expect(issues.some((issue) => issue.side === "before")).toBe(true);
      expect(issues.every((issue) => issue.side === "before")).toBe(true);
    });

    it("LIST_INVALID: diff with both lists invalid reports both sides", async () => {
      const bytes = fixtureBytes("input/all-rules.csv");
      const res = await request(server())
        .post("/v1/rooming-lists/diff")
        .attach("before", bytes, "all-rules.csv")
        .attach("after", bytes, "all-rules.csv");
      expectProblem(res, 422, "LIST_INVALID");
      const sides = new Set(issuesOf(res).map((issue) => issue.side));
      expect(sides).toEqual(new Set(["before", "after"]));
    });
  });

  describe("EXPORT_PRECONDITION_FAILED", () => {
    it("EXPORT_PRECONDITION_FAILED: maestro-csv without a block needs the group reservation number", async () => {
      const res = await convert("maestro-csv");
      expectProblem(res, 422, "EXPORT_PRECONDITION_FAILED");
      const issues = issuesOf(res);
      expect(
        issues.some(
          (i) => i.ruleId === "X001" && i.field === "groupReservationNumber",
        ),
      ).toBe(true);
      for (const issue of issues)
        expect(issue.code).toBe("EXPORT_FIELD_REQUIRED");
    });

    it("EXPORT_PRECONDITION_FAILED: maestro-csv with a block but no buildingCode", async () => {
      const res = await convert("maestro-csv").field("block", block());
      expectProblem(res, 422, "EXPORT_PRECONDITION_FAILED");
      const issues = issuesOf(res);
      expect(
        issues.some((i) => i.ruleId === "X001" && i.field === "buildingCode"),
      ).toBe(true);
      for (const issue of issues)
        expect(issue.code).toBe("EXPORT_FIELD_REQUIRED");
    });

    it("EXPORT_PRECONDITION_FAILED: opera-cloud-xlsx needs a first name", async () => {
      const csv = Buffer.from(
        "Last Name,Arrival,Departure,Room Type\nOkafor,2026-11-10,2026-11-12,KING\n",
      );
      const res = await request(server())
        .post("/v1/rooming-lists/convert")
        .attach("file", csv, "no-first-name.csv")
        .field("target", "opera-cloud-xlsx");
      expectProblem(res, 422, "EXPORT_PRECONDITION_FAILED");
      const issues = issuesOf(res);
      expect(
        issues.some((i) => i.ruleId === "X001" && i.field === "firstName"),
      ).toBe(true);
      for (const issue of issues)
        expect(issue.code).toBe("EXPORT_FIELD_REQUIRED");
    });
  });

  describe("NOT_FOUND", () => {
    it("NOT_FOUND: unknown GET path", async () => {
      const res = await request(server()).get("/nope");
      expectProblem(res, 404, "NOT_FOUND");
      expect(res.body.detail).toContain("GET");
      expect(res.body.detail).toContain("/nope");
    });

    it("NOT_FOUND: unknown POST path", async () => {
      const res = await request(server()).post("/v1/nope");
      expectProblem(res, 404, "NOT_FOUND");
      expect(res.body.detail).toContain("POST");
      expect(res.body.detail).toContain("/v1/nope");
    });

    it("NOT_FOUND: wrong method on a real path", async () => {
      const res = await request(server()).get("/v1/rooming-lists/validate");
      expectProblem(res, 404, "NOT_FOUND");
      expect(res.body.detail).toContain("GET");
      expect(res.body.detail).toContain("/v1/rooming-lists/validate");
    });
  });

  describe("FILE_TOO_LARGE with a small limit", () => {
    let small: TestApp;
    beforeAll(async () => {
      small = await startApp({ API_KEY: "", MAX_UPLOAD_BYTES: 1024 });
    });
    afterAll(async () => {
      await small.close();
    });
    const smallServer = () => small.app.getHttpServer();
    const big = () => Buffer.alloc(2000, "a");

    it("FILE_TOO_LARGE: validate", async () => {
      const res = await request(smallServer())
        .post("/v1/rooming-lists/validate")
        .attach("file", big(), "big.csv");
      expectProblem(res, 413, "FILE_TOO_LARGE");
    });

    it("FILE_TOO_LARGE: convert", async () => {
      const res = await request(smallServer())
        .post("/v1/rooming-lists/convert")
        .field("target", "canonical-json")
        .attach("file", big(), "big.csv");
      expectProblem(res, 413, "FILE_TOO_LARGE");
    });

    it("FILE_TOO_LARGE: diff before", async () => {
      const res = await request(smallServer())
        .post("/v1/rooming-lists/diff")
        .attach("before", big(), "big.csv")
        .attach("after", we1(), "we1.csv");
      expectProblem(res, 413, "FILE_TOO_LARGE");
    });

    it("FILE_TOO_LARGE: a file of exactly the limit is not rejected as too large", async () => {
      const res = await request(smallServer())
        .post("/v1/rooming-lists/validate")
        .attach("file", Buffer.alloc(1024, "a"), "exact.csv");
      expect(res.status).not.toBe(413);
    });
  });
});
