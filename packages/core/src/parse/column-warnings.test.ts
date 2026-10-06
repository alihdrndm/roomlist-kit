import { describe, expect, it } from "vitest";
import { makeIssue } from "../issues.js";
import {
  ColumnWarnings,
  findHeaderRow,
  isBlankRow,
  MAX_COLUMN_WARNINGS,
  mapHeaders,
} from "./headers.js";

const warn = (n: number) => () => makeIssue("W201", `column ${n}`, { row: 1 });

describe("W201 column warning budget", () => {
  it("W201: the first 50 columns are reported one by one, exactly as the spec says", () => {
    const warnings = new ColumnWarnings();
    for (let n = 1; n <= MAX_COLUMN_WARNINGS; n++)
      expect(warnings.add(warn(n))).toBe(true);
    const issues = warnings.finish(1);
    expect(issues).toHaveLength(MAX_COLUMN_WARNINGS);
    expect(issues.at(-1)?.message).toBe("column 50");
  });

  it("W201: after 50, one extra warning counts the rest and no more issue objects are created", () => {
    const warnings = new ColumnWarnings();
    let made = 0;
    for (let n = 1; n <= 2_500_000; n++) {
      warnings.add(() => {
        made++;
        return warn(n)();
      });
    }
    const issues = warnings.finish(7);
    expect(made).toBe(MAX_COLUMN_WARNINGS);
    expect(issues).toHaveLength(MAX_COLUMN_WARNINGS + 1);
    expect(issues.at(-1)).toMatchObject({ ruleId: "W201", row: 7 });
    expect(issues.at(-1)?.message).toBe(
      "2499950 more columns are ignored (not recognised, or without a header).",
    );
  });

  it("W201: a single skipped column is worded in the singular", () => {
    const warnings = new ColumnWarnings();
    for (let n = 1; n <= MAX_COLUMN_WARNINGS + 1; n++) warnings.add(warn(n));
    expect(warnings.finish(1).at(-1)?.message).toBe(
      "1 more column is ignored (not recognised, or without a header).",
    );
  });

  it("mapHeaders: a header row of 100 unknown columns lists 50 of them and warns about the other 50", () => {
    const header = [
      "Last Name",
      "Arrival",
      "Departure",
      ...Array.from({ length: 100 }, (_, n) => `Extra ${n}`),
    ];
    const result = mapHeaders(header, undefined, 1);
    expect(result.columns).toHaveLength(3 + MAX_COLUMN_WARNINGS);
    const warnings = result.warnings.finish(1);
    expect(warnings).toHaveLength(MAX_COLUMN_WARNINGS + 1);
    expect(warnings.at(-1)?.message).toContain("50 more columns");
  });

  it("isBlankRow treats a missing (unused) row as blank", () => {
    expect(isBlankRow(undefined)).toBe(true);
  });

  it("findHeaderRow skips the holes of a sparse row list", () => {
    const rows: (string[] | undefined)[] = [];
    rows[4] = ["Last Name", "Arrival", "Departure"];
    expect(findHeaderRow(rows, undefined)).toBe(4);
    expect(findHeaderRow([undefined, undefined], undefined)).toBe(-1);
  });
});
