import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BlockContextSchema,
  parseRoomingList,
  validateRoomingList,
} from "./index.js";
import type { ParsedEntry } from "./model.js";

const readJson = (path: string): unknown =>
  JSON.parse(
    readFileSync(
      new URL(`../../../fixtures/${path}`, import.meta.url),
      "utf-8",
    ),
  );

const fixture = (name: string) =>
  new Uint8Array(
    readFileSync(new URL(`../../../fixtures/input/${name}`, import.meta.url)),
  );

describe("fixture files", () => {
  it("WE1: we1.csv parses with zero issues", async () => {
    const result = await parseRoomingList(fixture("we1.csv"));
    expect(result.issues).toEqual([]);
    expect(result.entries).toHaveLength(4);
    expect(result.entries[2]).toEqual({
      line: 3,
      lastName: "Marchetti",
      firstName: "Elena",
      email: "elena.marchetti@example.com",
      arrivalDate: "2026-11-10",
      departureDate: "2026-11-14",
      roomType: "QQ",
      rooms: 1,
      adults: 1,
      children: 0,
      infants: 0,
      sharesWithLine: 2,
    });
    expect(result.entries[3]).toMatchObject({
      arrivalDate: "2026-11-11",
      adults: 2,
      children: 1,
    });
  });

  it("clean-40: csv parses with zero issues", async () => {
    const result = await parseRoomingList(fixture("clean-40.csv"));
    expect(result.issues).toEqual([]);
    expect(result.entries).toHaveLength(40);
    expect(
      result.entries.filter((entry) => entry.sharesWithLine !== undefined),
    ).toHaveLength(6);
  });

  it("clean-40: csv and xlsx parse to deep-equal entries", async () => {
    const fromCsv = await parseRoomingList(fixture("clean-40.csv"));
    const fromXlsx = await parseRoomingList(fixture("clean-40.xlsx"));
    expect(fromXlsx.format).toBe("xlsx");
    expect(fromXlsx.issues).toEqual([]);
    expect(fromXlsx.entries).toEqual(fromCsv.entries);
  });

  describe("messy-headers", () => {
    // Only the fields messy-headers.csv carries; the rest are absent there by design.
    const comparable = (entry: ParsedEntry) => ({
      line: entry.line,
      lastName: entry.lastName,
      firstName: entry.firstName,
      email: entry.email,
      arrivalDate: entry.arrivalDate,
      departureDate: entry.departureDate,
      roomType: entry.roomType,
      adults: entry.adults,
      children: entry.children,
      sharesWithLine: entry.sharesWithLine,
    });

    it("with columnMap: one W201 (VIP Code) and W207, same entries as clean-40", async () => {
      const result = await parseRoomingList(fixture("messy-headers.csv"), {
        columnMap: { "Roommate Line": "sharesWithLine" },
      });
      expect(result.issues.map((issue) => [issue.ruleId, issue.value])).toEqual(
        [
          ["W207", undefined],
          ["W201", "VIP Code"],
        ],
      );
      const clean = await parseRoomingList(fixture("clean-40.csv"));
      expect(result.entries.map(comparable)).toEqual(
        clean.entries.map(comparable),
      );
    });

    it("maps every messy header as the spec lists", async () => {
      const result = await parseRoomingList(fixture("messy-headers.csv"));
      expect(result.columns).toEqual([
        { header: "Guest Name", field: "fullName" },
        { header: "Check-In", field: "arrivalDate" },
        { header: "Check Out", field: "departureDate" },
        { header: "Room", field: "roomType" },
        { header: "# Adults", field: "adults" },
        { header: "Kids", field: "children" },
        { header: "Roommate Line", field: null },
        { header: "E-mail", field: "email" },
        { header: "VIP Code", field: null },
      ]);
    });

    it("without columnMap: a second W201 for Roommate Line", async () => {
      const result = await parseRoomingList(fixture("messy-headers.csv"));
      expect(
        result.issues
          .filter((issue) => issue.ruleId === "W201")
          .map((issue) => issue.value),
      ).toEqual(["Roommate Line", "VIP Code"]);
    });
  });

  describe("dmy-dates", () => {
    it("parses cleanly with dateOrder DMY", async () => {
      const result = await parseRoomingList(fixture("dmy-dates.csv"), {
        dateOrder: "DMY",
      });
      expect(result.issues).toEqual([]);
      expect(result.entries[9]).toMatchObject({
        arrivalDate: "2026-11-13",
        departureDate: "2026-11-14",
      });
    });

    it("R002: with the default order, only rows with a day > 12 fail", async () => {
      const result = await parseRoomingList(fixture("dmy-dates.csv"));
      expect(result.issues.every((issue) => issue.ruleId === "R002")).toBe(
        true,
      );
      // Lines 5–10 (rows 6–11) have a departure day > 12; Lines 9–10 also an arrival day > 12.
      expect(
        result.issues.map((issue) => `${issue.row}:${issue.field}`),
      ).toEqual([
        "6:departureDate",
        "7:departureDate",
        "8:departureDate",
        "9:departureDate",
        "10:arrivalDate",
        "10:departureDate",
        "11:arrivalDate",
        "11:departureDate",
      ]);
    });
  });

  it("all-rules: parse + validate produce exactly the expected (ruleId, row) set", async () => {
    const block = BlockContextSchema.parse(readJson("blocks/tech26.json"));
    const parsed = await parseRoomingList(fixture("all-rules.csv"));
    const issues = [
      ...parsed.issues,
      ...validateRoomingList(
        { block, entries: parsed.entries },
        { entryRows: parsed.entryRows },
      ),
    ];
    const key = (pair: { ruleId: string; row: number | null }) =>
      `${pair.ruleId}@${pair.row ?? "-"}`;
    const actual = issues
      .map((issue) => key({ ruleId: issue.ruleId, row: issue.row ?? null }))
      .sort();
    const expected = (
      readJson("expected/all-rules.issues.json") as {
        ruleId: string;
        row: number | null;
      }[]
    )
      .map(key)
      .sort();
    expect(actual).toEqual(expected);
  });

  it("all-rules: every R- and W-rule in the spec (plus R015) appears", () => {
    const expected = readJson("expected/all-rules.issues.json") as {
      ruleId: string;
    }[];
    const ids = new Set(expected.map((pair) => pair.ruleId));
    for (let n = 1; n <= 15; n++)
      expect(ids).toContain(`R${String(n).padStart(3, "0")}`);
    for (let n = 201; n <= 208; n++) expect(ids).toContain(`W${n}`);
  });
});
