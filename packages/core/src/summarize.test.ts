import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ParsedEntry, RoomingList } from "./model.js";
import { parseRoomingList } from "./parse/parse.js";
import { type IsoDate, parseIsoDate } from "./plain-date.js";
import { summarize } from "./summarize.js";

const d = (text: string): IsoDate => {
  const date = parseIsoDate(text);
  if (date === undefined) throw new Error(`bad test date ${text}`);
  return date;
};

const entry = (
  overrides: Partial<ParsedEntry> & { line: number },
): ParsedEntry => ({
  lastName: "Okafor",
  arrivalDate: d("2026-11-10"),
  departureDate: d("2026-11-12"),
  rooms: 1,
  adults: 1,
  children: 0,
  infants: 0,
  ...overrides,
});

describe("summarize", () => {
  it("WE1: summary matches the worked example exactly", async () => {
    const input = new Uint8Array(
      readFileSync(new URL("../../../fixtures/input/we1.csv", import.meta.url)),
    );
    const parsed = await parseRoomingList(input);
    expect(summarize({ entries: parsed.entries })).toEqual({
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
  });

  it("counts rooms × nights, groups missing room types under (none) last", () => {
    const list: RoomingList = {
      entries: [
        entry({ line: 1, roomType: "QQ", rooms: 2 }),
        entry({ line: 2 }),
        entry({ line: 3, roomType: "KING", infants: 1 }),
      ],
    };
    const summary = summarize(list);
    expect(summary.rooms).toBe(4);
    expect(summary.roomNights).toBe(8);
    expect(summary.people).toBe(4);
    expect(summary.byRoomType.map((row) => row.roomType)).toEqual([
      "KING",
      "QQ",
      "(none)",
    ]);
    expect(summary.byRoomType[1]).toEqual({
      roomType: "QQ",
      rooms: 2,
      roomNights: 4,
    });
  });

  it("leaves entries with missing or backwards dates out of night figures", () => {
    const { departureDate: _dropped, ...noDeparture } = entry({ line: 2 });
    const list: RoomingList = {
      entries: [
        entry({ line: 1 }),
        noDeparture,
        entry({
          line: 3,
          arrivalDate: d("2026-11-12"),
          departureDate: d("2026-11-10"),
        }),
      ],
    };
    const summary = summarize(list);
    expect(summary.rooms).toBe(3);
    expect(summary.roomNights).toBe(2);
    expect(summary.byNight).toEqual([
      { date: "2026-11-10", rooms: 1 },
      { date: "2026-11-11", rooms: 1 },
    ]);
  });

  it("fills gaps between stays with zero-room nights", () => {
    const list: RoomingList = {
      entries: [
        entry({
          line: 1,
          arrivalDate: d("2026-11-10"),
          departureDate: d("2026-11-11"),
        }),
        entry({
          line: 2,
          arrivalDate: d("2026-11-13"),
          departureDate: d("2026-11-14"),
        }),
      ],
    };
    expect(summarize(list).byNight.map((night) => night.rooms)).toEqual([
      1, 0, 0, 1,
    ]);
  });

  it("an empty list has no first arrival, last departure or nights", () => {
    expect(summarize({ entries: [] })).toEqual({
      entries: 0,
      primaries: 0,
      sharers: 0,
      rooms: 0,
      people: 0,
      roomNights: 0,
      byRoomType: [],
      byNight: [],
    });
  });
});
