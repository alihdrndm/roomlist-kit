import { describe, expect, it } from "vitest";
import { tech26, validateReport } from "@/test/reports";
import {
  clientNote,
  countIssues,
  filterIssues,
  groupByRule,
  groupRooms,
  issueRows,
  makeGuestLookup,
  messageBody,
  nightGrid,
  skippedBlockChecks,
} from "./report";

describe("nightGrid", () => {
  it("matches core's summary: column totals = rooms per night, row totals = room nights per type", async () => {
    for (const path of [
      "input/we1.csv",
      "input/all-rules.csv",
      "input/clean-40.csv",
      "input/list-v2.csv",
    ]) {
      const report = await validateReport(path);
      const grid = nightGrid(report);
      const columnSums = grid.nights.map((_, index) =>
        grid.rows.reduce((sum, row) => sum + (row.cells[index] ?? 0), 0),
      );
      expect(columnSums, path).toEqual(
        report.summary.byNight.map((night) => night.rooms),
      );
      expect(
        grid.rows.map((row) => row.total),
        path,
      ).toEqual(report.summary.byRoomType.map((type) => type.roomNights));
    }
  });
});

describe("groupRooms", () => {
  it("puts each sharer in its primary's room and counts people", async () => {
    const report = await validateReport("input/we1.csv", tech26());
    const { rooms, orphans } = groupRooms(report.entries);
    expect(rooms).toHaveLength(report.summary.primaries);
    expect(orphans).toEqual([]);
    const shared = rooms.find((room) => room.sharers.length > 0);
    expect(shared?.primary.lastName).toBe("Lindqvist");
    expect(shared?.sharers.map((entry) => entry.lastName)).toEqual([
      "Marchetti",
    ]);
    expect(rooms.reduce((sum, room) => sum + room.people, 0)).toBe(
      report.summary.people,
    );
  });

  it("returns sharers whose line is missing as orphans", async () => {
    const report = await validateReport("input/all-rules.csv");
    const { orphans } = groupRooms(report.entries);
    expect(orphans.some((entry) => entry.sharesWithLine === 99)).toBe(true);
  });
});

describe("issue helpers", () => {
  it("finds the guest behind an issue, by line or through its row", async () => {
    const report = await validateReport("input/all-rules.csv");
    const guestOf = makeGuestLookup(report);
    const notFound = report.issues.find(
      (issue) => issue.code === "SHARER_NOT_FOUND",
    );
    expect(notFound && guestOf(notFound)?.lastName).toBe("Rossi");
    const fileLevel = report.issues.find(
      (issue) => issue.code === "AMBIGUOUS_DATE_ORDER",
    );
    expect(fileLevel && guestOf(fileLevel)).toBeUndefined();
  });

  it("filters by severity and by text, including the guest's name", async () => {
    const report = await validateReport("input/all-rules.csv");
    const guestOf = makeGuestLookup(report);
    const { errors, warnings } = countIssues(report.issues);
    expect(filterIssues(report.issues, "error", "", guestOf)).toHaveLength(
      errors,
    );
    expect(filterIssues(report.issues, "warning", "", guestOf)).toHaveLength(
      warnings,
    );
    const rossi = filterIssues(report.issues, "all", "rossi", guestOf);
    expect(rossi.map((issue) => issue.code)).toEqual(["SHARER_NOT_FOUND"]);
    expect(filterIssues(report.issues, "all", "row 12", guestOf)[0]?.row).toBe(
      12,
    );
  });

  it("groups by check in the API's order and strips the row prefix", async () => {
    const report = await validateReport("input/all-rules.csv");
    const groups = groupByRule(report.issues);
    expect(groups.reduce((sum, group) => sum + group.issues.length, 0)).toBe(
      report.issues.length,
    );
    expect(groups[0]?.issues[0]?.severity).toBe("error");
    expect(messageBody("Row 7: last name is empty.")).toBe(
      "last name is empty.",
    );
    expect(messageBody("Line 3: x")).toBe("x");
  });

  it("names the block checks that could not run", () => {
    expect(
      skippedBlockChecks({
        hasDates: false,
        hasRoomTypes: true,
        hasMaxOccupancy: false,
      }),
    ).toEqual(["stays against the block dates", "room occupancy"]);
    expect(
      skippedBlockChecks({
        hasDates: true,
        hasRoomTypes: true,
        hasMaxOccupancy: true,
      }),
    ).toEqual([]);
  });
});

describe("shareable outputs", () => {
  it("writes one CSV row per issue with readable fields", async () => {
    const report = await validateReport("input/all-rules.csv");
    const rows = issueRows(report);
    expect(rows[0]).toEqual([
      "Row",
      "Severity",
      "Guest",
      "Field",
      "Value",
      "Problem",
      "Check",
    ]);
    expect(rows).toHaveLength(report.issues.length + 1);
    expect(rows.find((row) => row[6] === "R010 SHARER_NOT_FOUND")).toEqual([
      12,
      "Error",
      "Rossi, Marco",
      "Shares with (line)",
      "99",
      "shares with line 99, but there is no line 99. Fix the line number.",
      "R010 SHARER_NOT_FOUND",
    ]);
  });

  it("drafts a note: corrections, confirmations and totals", async () => {
    const note = clientNote(
      await validateReport("input/all-rules.csv"),
      "v7.csv",
    );
    expect(note).toContain("Rooming list check: v7.csv");
    expect(note).toContain("Please correct (13 errors):");
    expect(note).toContain("Please confirm (6 warnings):");
    expect(note).toContain("- Row 12: shares with line 99");
    const clean = clientNote(
      await validateReport("input/we1.csv", tech26()),
      "we1.csv",
    );
    expect(clean).toContain(
      "4 guests, 3 rooms, 9 room nights, 10–14 Nov 2026.",
    );
    expect(clean).toContain("No issues found");
  });
});
