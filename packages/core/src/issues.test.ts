import { describe, expect, it } from "vitest";
import { makeIssue, sortIssues } from "./issues.js";

describe("makeIssue", () => {
  it("fills code and severity from the rule table and omits absent keys", () => {
    expect(makeIssue("F001", "empty")).toEqual({
      severity: "error",
      ruleId: "F001",
      code: "FILE_EMPTY",
      message: "empty",
    });
    expect(makeIssue("W201", "x").severity).toBe("warning");
  });

  it("truncates value to 80 characters", () => {
    const issue = makeIssue("R002", "bad", {
      row: 2,
      line: 1,
      field: "arrivalDate",
      value: "x".repeat(100),
    });
    expect(issue.value).toHaveLength(80);
    expect(issue).toMatchObject({ row: 2, line: 1, field: "arrivalDate" });
  });
});

describe("sortIssues", () => {
  it("sorts errors first, then row (no row first), then rule ID", () => {
    const sorted = sortIssues([
      makeIssue("W201", "w", { row: 1 }),
      makeIssue("R006", "e", { row: 5 }),
      makeIssue("R002", "e", { row: 5 }),
      makeIssue("F005", "e"),
      makeIssue("W207", "w"),
    ]);
    expect(sorted.map((issue) => issue.ruleId)).toEqual([
      "F005",
      "R002",
      "R006",
      "W207",
      "W201",
    ]);
  });
});
