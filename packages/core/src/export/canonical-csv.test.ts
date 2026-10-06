import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ENTRY_FIELDS, type RoomingEntry } from "../model.js";
import { parseRoomingList } from "../parse/parse.js";
import { parseIsoDate } from "../plain-date.js";
import { summarize } from "../summarize.js";
import { canonicalCsv } from "./canonical-csv.js";
import { orderForExport } from "./ordering.js";
import type { ExportInput } from "./types.js";

const date = (text: string) => {
  const parsed = parseIsoDate(text);
  if (parsed === undefined) throw new Error(`bad date ${text}`);
  return parsed;
};

const base: RoomingEntry = {
  line: 1,
  lastName: "Okafor",
  arrivalDate: date("2026-11-10"),
  departureDate: date("2026-11-13"),
  rooms: 1,
  adults: 1,
  children: 0,
  infants: 0,
};

const inputOf = (entries: RoomingEntry[]): ExportInput => ({
  entries,
  block: undefined,
  summary: summarize({ entries }),
});

const encode = (text: string) => new TextEncoder().encode(text);

describe("canonical-csv", () => {
  it("canonical-csv: header equals the entry fields joined by commas", () => {
    const text = canonicalCsv(inputOf([base]));
    expect(text.split("\n")[0]).toBe(ENTRY_FIELDS.join(","));
  });

  it("canonical-csv: absent optional fields are empty cells", () => {
    const lines = canonicalCsv(inputOf([base])).split("\n");
    expect(lines[1]).toBe(
      "1,Okafor,,,,,2026-11-10,2026-11-13,,1,1,0,0,,,,,,,,,",
    );
    expect(lines[1]?.split(",")).toHaveLength(ENTRY_FIELDS.length);
  });

  it("canonical-csv: ends with exactly one newline and has no BOM", () => {
    const text = canonicalCsv(inputOf([base, { ...base, line: 2 }]));
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    expect(text).not.toContain("\r");
  });

  it("canonical-csv: quotes comma, double quote and newline in specialRequests", () => {
    const text = canonicalCsv(
      inputOf([
        { ...base, specialRequests: "a,b" },
        { ...base, line: 2, specialRequests: 'say "hi"' },
        { ...base, line: 3, specialRequests: "one\ntwo" },
      ]),
    );
    expect(text).toContain(',"a,b"');
    expect(text).toContain(',"say ""hi"""');
    expect(text).toContain(',"one\ntwo"');
  });

  it("canonical-csv: keeps the given entry order", () => {
    const text = canonicalCsv(
      inputOf([
        { ...base, line: 2, lastName: "Zed" },
        { ...base, line: 1, lastName: "Abe" },
      ]),
    );
    const rows = text.split("\n");
    expect(rows[1]?.startsWith("2,Zed")).toBe(true);
    expect(rows[2]?.startsWith("1,Abe")).toBe(true);
  });

  describe("round trip", () => {
    const roundTrip = async (entries: RoomingEntry[]) => {
      const ordered = orderForExport(entries).entries;
      const bytes = encode(canonicalCsv(inputOf(ordered)));
      const parsed = await parseRoomingList(bytes);
      return { ordered, parsed };
    };

    it("canonical-csv: clean-40 survives a round trip", async () => {
      const source = new Uint8Array(
        readFileSync(
          new URL("../../../../fixtures/input/clean-40.csv", import.meta.url),
        ),
      );
      const first = await parseRoomingList(source);
      expect(first.issues).toEqual([]);
      const strict: RoomingEntry[] = [];
      for (const item of first.entries) {
        const { lastName, arrivalDate, departureDate, ...rest } = item;
        if (
          lastName === undefined ||
          arrivalDate === undefined ||
          departureDate === undefined
        )
          throw new Error(`clean-40 line ${item.line} is incomplete`);
        strict.push({ ...rest, lastName, arrivalDate, departureDate });
      }
      const { ordered, parsed } = await roundTrip(strict);
      expect(parsed.issues).toEqual([]);
      expect(parsed.entries).toEqual(ordered);
    });

    it("canonical-csv: a list with every field set survives a round trip", async () => {
      const full: RoomingEntry = {
        line: 1,
        lastName: "Marchetti",
        firstName: "Elena",
        title: "Dr",
        email: "elena@example.com",
        phone: "+39 02 555 0100",
        arrivalDate: date("2026-11-10"),
        departureDate: date("2026-11-14"),
        roomType: "QQ",
        rooms: 2,
        adults: 2,
        children: 1,
        infants: 1,
        confirmationNumber: "CN-1001",
        gender: "X",
        dateOfBirth: date("1985-03-02"),
        nationality: "ITA",
        language: "IT",
        passport: "YA1234567",
        specialRequests: 'Late arrival, "quiet room"\nhigh floor',
        travelAgentLocator: "TA-77",
      };
      const sharer: RoomingEntry = {
        ...base,
        line: 2,
        lastName: "Rossi",
        sharesWithLine: 1,
      };
      const { ordered, parsed } = await roundTrip([
        sharer,
        full,
        { ...base, line: 3 },
      ]);
      expect(parsed.issues).toEqual([]);
      expect(parsed.entries).toEqual(ordered);
    });
  });
});
