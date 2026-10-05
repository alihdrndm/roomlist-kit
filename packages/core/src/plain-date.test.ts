import { describe, expect, it } from "vitest";
import {
  addDays,
  compareDates,
  dateParts,
  diffDays,
  eachNight,
  fromParts,
  type IsoDate,
  parseIsoDate,
} from "./plain-date.js";

const d = (text: string): IsoDate => {
  const date = parseIsoDate(text);
  if (date === undefined) throw new Error(`bad test date ${text}`);
  return date;
};

describe("parseIsoDate", () => {
  it("accepts a real YYYY-MM-DD date", () => {
    expect(parseIsoDate("2026-11-10")).toBe("2026-11-10");
    expect(parseIsoDate("2028-02-29")).toBe("2028-02-29");
  });

  it("rejects impossible dates and other shapes", () => {
    expect(parseIsoDate("2026-02-30")).toBeUndefined();
    expect(parseIsoDate("2026-13-01")).toBeUndefined();
    expect(parseIsoDate("2027-02-29")).toBeUndefined();
    expect(parseIsoDate("2026-1-5")).toBeUndefined();
    expect(parseIsoDate("2026-11-10T00:00:00Z")).toBeUndefined();
  });
});

describe("fromParts", () => {
  it("builds zero-padded dates and rejects out-of-range parts", () => {
    expect(fromParts(2026, 1, 5)).toBe("2026-01-05");
    expect(fromParts(0, 1, 1)).toBeUndefined();
    expect(fromParts(2026, 0, 1)).toBeUndefined();
    expect(fromParts(2026, 4, 31)).toBeUndefined();
    expect(fromParts(2026, 4, 0)).toBeUndefined();
  });
});

describe("date arithmetic", () => {
  it("addDays crosses month, year and DST boundaries", () => {
    expect(addDays(d("2026-11-30"), 1)).toBe("2026-12-01");
    expect(addDays(d("2026-12-31"), 1)).toBe("2027-01-01");
    expect(addDays(d("2026-03-08"), 1)).toBe("2026-03-09"); // US DST start
    expect(addDays(d("2026-11-10"), -1)).toBe("2026-11-09");
  });

  it("diffDays counts nights", () => {
    expect(diffDays(d("2026-11-10"), d("2026-11-13"))).toBe(3);
    expect(diffDays(d("2026-11-13"), d("2026-11-10"))).toBe(-3);
    expect(diffDays(d("2026-10-31"), d("2026-11-02"))).toBe(2); // EU DST end
  });

  it("compareDates orders dates", () => {
    expect(compareDates(d("2026-11-10"), d("2026-11-11"))).toBe(-1);
    expect(compareDates(d("2026-11-11"), d("2026-11-10"))).toBe(1);
    expect(compareDates(d("2026-11-10"), d("2026-11-10"))).toBe(0);
  });

  it("eachNight lists arrival up to but not including departure", () => {
    expect(eachNight(d("2026-11-10"), d("2026-11-13"))).toEqual([
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
    ]);
    expect(eachNight(d("2026-11-10"), d("2026-11-10"))).toEqual([]);
  });

  it("dateParts splits a date", () => {
    expect(dateParts(d("2026-11-05"))).toEqual({
      year: 2026,
      month: 11,
      day: 5,
    });
  });
});
