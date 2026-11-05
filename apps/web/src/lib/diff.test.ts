import { describe, expect, it } from "vitest";
import { diffReport } from "@/test/reports";
import {
  changeCsvRows,
  changeRows,
  deltas,
  filterChanges,
  signedDelta,
  updateNote,
} from "./diff";

describe("deltas", () => {
  it("adds up to the diff's room-night change, per night and per room type", async () => {
    const report = await diffReport("input/list-v1.csv", "input/list-v2.csv");
    const { byNight, byRoomType } = deltas(report);
    const sum = (items: { delta: number }[]) =>
      items.reduce((total, item) => total + item.delta, 0);
    expect(sum(byRoomType)).toBe(report.summary.roomNightsDelta);
    expect(sum(byNight)).toBe(report.summary.roomNightsDelta);
    expect(byRoomType).toEqual([
      { roomType: "KING", delta: 5 },
      { roomType: "QQ", delta: -1 },
    ]);
  });

  it("is empty when nothing changed", async () => {
    const report = await diffReport("input/list-v1.csv", "input/list-v1.csv");
    expect(deltas(report)).toEqual({ byNight: [], byRoomType: [] });
  });
});

describe("change list", () => {
  it("lists added, removed and changed guests and filters them", async () => {
    const report = await diffReport("input/list-v1.csv", "input/list-v2.csv");
    const rows = changeRows(report);
    expect(rows).toHaveLength(9);
    expect(filterChanges(rows, "added", "")).toHaveLength(3);
    expect(
      filterChanges(rows, "all", "departure").map((row) => row.entry.lastName),
    ).toEqual(["Delacroix", "Smith"]);
  });

  it("writes the update for the hotel and the CSV", async () => {
    const report = await diffReport("input/list-v1.csv", "input/list-v2.csv");
    const note = updateNote(report, { before: "v1.csv", after: "v2.csv" });
    expect(note).toContain(
      "3 new guests, 2 cancellations, 4 changes. Room nights 28 → 32 (+4).",
    );
    expect(note).toContain("+ Pereira, Quinn, 11–13 Nov 2026, KING");
    expect(note).toContain("~ Gunnarsson, Pia: Room type QQ → KING");
    const rows = changeCsvRows(report);
    expect(rows[0]).toEqual([
      "Change",
      "Line",
      "Guest",
      "Confirmation",
      "Field",
      "Before",
      "After",
    ]);
    expect(rows.filter((row) => row[0] === "Changed")).toHaveLength(4);
  });

  it("signs a delta with a real minus", () => {
    expect([signedDelta(4), signedDelta(-2), signedDelta(0)]).toEqual([
      "+4",
      "−2",
      "0",
    ]);
  });
});
