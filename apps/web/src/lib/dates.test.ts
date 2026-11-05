import { describe, expect, it } from "vitest";
import {
  dateRange,
  dayMonth,
  type IsoDate,
  isoOrUndefined,
  nightKind,
  nightsOf,
  parseIsoDate,
  weekday,
} from "./dates";

const d = (text: string): IsoDate => {
  const date = parseIsoDate(text);
  if (date === undefined) throw new Error(text);
  return date;
};

describe("date display", () => {
  it("labels nights day-before-month, with the weekday", () => {
    expect(weekday(d("2026-11-10"))).toBe("Tue");
    expect(dayMonth(d("2026-11-10"))).toBe("10 Nov");
  });

  it("writes ranges compactly", () => {
    expect(dateRange(d("2026-11-10"), d("2026-11-14"))).toBe("10–14 Nov 2026");
    expect(dateRange(d("2026-11-28"), d("2026-12-02"))).toBe(
      "28 Nov – 2 Dec 2026",
    );
    expect(dateRange(d("2026-12-30"), d("2027-01-02"))).toBe(
      "30 Dec 2026 – 2 Jan 2027",
    );
  });

  it("reads form dates and counts nights", () => {
    expect(isoOrUndefined(" 2026-11-10 ")).toBe("2026-11-10");
    expect(isoOrUndefined("")).toBeUndefined();
    expect(isoOrUndefined("2026-02-30")).toBeUndefined();
    expect(nightsOf(d("2026-11-10"), d("2026-11-13"))).toBe(3);
    expect(nightsOf(d("2026-11-13"), d("2026-11-10"))).toBe(0);
    expect(nightsOf(undefined, d("2026-11-10"))).toBe(0);
  });
});

describe("nightKind", () => {
  // TECH26: start 10 Nov, end (last departure) 14 Nov, one shoulder day: the same window rules R004/W202 use.
  const window = {
    start: d("2026-11-10"),
    end: d("2026-11-14"),
    shoulderDays: 1,
  };
  it("marks block, shoulder and outside nights like the validator", () => {
    expect(nightKind(d("2026-11-08"), window)).toBe("outside");
    expect(nightKind(d("2026-11-09"), window)).toBe("shoulder");
    expect(nightKind(d("2026-11-10"), window)).toBe("block");
    expect(nightKind(d("2026-11-13"), window)).toBe("block");
    expect(nightKind(d("2026-11-14"), window)).toBe("shoulder");
    expect(nightKind(d("2026-11-15"), window)).toBe("outside");
  });
  it("is unknown without block dates, and one-sided with one date", () => {
    expect(nightKind(d("2026-11-10"), { shoulderDays: 0 })).toBe("unknown");
    expect(
      nightKind(d("2026-11-01"), { start: d("2026-11-10"), shoulderDays: 0 }),
    ).toBe("outside");
    expect(
      nightKind(d("2026-12-01"), { start: d("2026-11-10"), shoulderDays: 0 }),
    ).toBe("block");
  });
});
