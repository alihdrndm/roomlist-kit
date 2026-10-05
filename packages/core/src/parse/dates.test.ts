import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { dateParts, fromParts } from "../plain-date.js";
import { DateOrderEvidence, parseDateText } from "./dates.js";

const ok = (text: string, order: "MDY" | "DMY" = "MDY") => {
  const result = parseDateText(text, order);
  return result.ok ? result.date : undefined;
};

describe("date table", () => {
  it("ISO: 2026-11-10 and 2026/11/10 are accepted as is", () => {
    expect(ok("2026-11-10")).toBe("2026-11-10");
    expect(ok("2026/11/10")).toBe("2026-11-10");
    expect(ok("2026-11-10", "DMY")).toBe("2026-11-10");
  });

  it("numeric with / - or . follows dateOrder", () => {
    expect(ok("11/10/2026", "MDY")).toBe("2026-11-10");
    expect(ok("11/10/2026", "DMY")).toBe("2026-10-11");
    expect(ok("10.11.2026", "DMY")).toBe("2026-11-10");
    expect(ok("1-5-2026", "MDY")).toBe("2026-01-05");
  });

  it("English month names, full or 3-letter, any case", () => {
    expect(ok("10 Nov 2026")).toBe("2026-11-10");
    expect(ok("Nov 10, 2026")).toBe("2026-11-10");
    expect(ok("10 November 2026")).toBe("2026-11-10");
    expect(ok("november 10 2026", "DMY")).toBe("2026-11-10");
    expect(ok("10 NOV. 2026")).toBe("2026-11-10");
  });

  it("R002 cases: 2-digit years, impossible dates, mixed separators, garbage", () => {
    for (const text of [
      "11/10/26",
      "02/30/2026",
      "13/01/2026",
      "11/10-2026",
      "10 Novem 2026",
      "Smarch 1, 2026",
      "soon",
      "2026-02-30",
    ]) {
      expect(parseDateText(text, "MDY").ok).toBe(false);
    }
    expect(parseDateText("soon", "MDY").form).toBe("unknown");
  });

  it("property: any valid date written as ISO, MDY or DMY parses back to itself", () => {
    const anyDate = fc
      .record({
        year: fc.integer({ min: 1000, max: 9999 }),
        month: fc.integer({ min: 1, max: 12 }),
        day: fc.integer({ min: 1, max: 31 }),
      })
      .map(({ year, month, day }) => fromParts(year, month, day))
      .filter((date) => date !== undefined);

    fc.assert(
      fc.property(
        anyDate,
        fc.constantFrom("/", "-", "."),
        fc.boolean(),
        (date, separator, pad) => {
          const { year, month, day } = dateParts(date);
          const two = (n: number) =>
            pad ? String(n).padStart(2, "0") : String(n);
          expect(ok(date, "MDY")).toBe(date);
          expect(
            ok(
              `${two(month)}${separator}${two(day)}${separator}${year}`,
              "MDY",
            ),
          ).toBe(date);
          expect(
            ok(
              `${two(day)}${separator}${two(month)}${separator}${year}`,
              "DMY",
            ),
          ).toBe(date);
        },
      ),
      { seed: 42, numRuns: 500 },
    );
  });
});

describe("W205 evidence", () => {
  const evidenceFor = (texts: string[]) => {
    const evidence = new DateOrderEvidence();
    for (const text of texts) evidence.record(parseDateText(text, "MDY"));
    return evidence.isAmbiguous();
  };

  it("W205: ambiguous when every numeric date has day and month ≤ 12", () => {
    expect(evidenceFor(["11/10/2026", "11/12/2026"])).toBe(true);
  });

  it("W205: not raised when one numeric date can only be read one way (WE1)", () => {
    expect(evidenceFor(["11/10/2026", "11/13/2026"])).toBe(false);
  });

  it("W205: not raised when an ISO or month-name date is present, or no numeric date", () => {
    expect(evidenceFor(["11/10/2026", "2026-11-12"])).toBe(false);
    expect(evidenceFor(["11/10/2026", "12 Nov 2026"])).toBe(false);
    expect(evidenceFor(["2026-11-12"])).toBe(false);
    expect(evidenceFor([])).toBe(false);
  });
});
