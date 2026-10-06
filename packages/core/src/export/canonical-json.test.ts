import { describe, expect, it } from "vitest";
import { ENTRY_FIELDS, type RoomingEntry } from "../model.js";
import { parseIsoDate } from "../plain-date.js";
import { summarize } from "../summarize.js";
import { canonicalJson } from "./canonical-json.js";
import type { ExportInput } from "./types.js";

const date = (text: string) => {
  const parsed = parseIsoDate(text);
  if (parsed === undefined) throw new Error(`bad date ${text}`);
  return parsed;
};

const entry: RoomingEntry = {
  line: 1,
  lastName: "Okafor",
  arrivalDate: date("2026-11-10"),
  departureDate: date("2026-11-13"),
  rooms: 1,
  adults: 1,
  children: 0,
  infants: 0,
};

const inputOf = (
  entries: RoomingEntry[],
  block: ExportInput["block"] = undefined,
): ExportInput => ({ entries, block, summary: summarize({ entries }) });

describe("canonical-json", () => {
  it("canonical-json: ends with exactly one newline", () => {
    const text = canonicalJson(inputOf([entry]));
    expect(text.endsWith("}\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
  });

  it("canonical-json: omits an absent block", () => {
    const parsed: Record<string, unknown> = JSON.parse(
      canonicalJson(inputOf([entry])),
    );
    expect(Object.keys(parsed)).toEqual(["entries", "summary"]);
  });

  it("canonical-json: writes the block first when present", () => {
    const parsed: Record<string, unknown> = JSON.parse(
      canonicalJson(inputOf([entry], { blockCode: "B1", shoulderDays: 0 })),
    );
    expect(Object.keys(parsed)).toEqual(["block", "entries", "summary"]);
    expect(parsed.block).toEqual({ blockCode: "B1", shoulderDays: 0 });
  });

  it("canonical-json: entry keys follow the table order whatever the input order", () => {
    const shuffled: RoomingEntry = {
      infants: 0,
      children: 0,
      adults: 2,
      rooms: 1,
      departureDate: date("2026-11-13"),
      arrivalDate: date("2026-11-10"),
      gender: "X",
      email: "a@example.com",
      lastName: "Okafor",
      line: 1,
    };
    const parsed: { entries: Record<string, unknown>[] } = JSON.parse(
      canonicalJson(inputOf([shuffled])),
    );
    const keys = Object.keys(parsed.entries[0] ?? {});
    expect(keys).toEqual(ENTRY_FIELDS.filter((field) => field in shuffled));
  });

  it("canonical-json: has no null values and skips undefined fields", () => {
    const withUndefined: RoomingEntry = { ...entry, firstName: undefined };
    const text = canonicalJson(inputOf([withUndefined]));
    expect(text).not.toContain("null");
    expect(text).not.toContain("firstName");
  });

  it("canonical-json: keeps the given entry order", () => {
    const second: RoomingEntry = { ...entry, line: 2, lastName: "Adams" };
    const parsed: { entries: { line: number }[] } = JSON.parse(
      canonicalJson(inputOf([second, entry])),
    );
    expect(parsed.entries.map((item) => item.line)).toEqual([2, 1]);
  });
});
