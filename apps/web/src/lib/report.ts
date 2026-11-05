import type {
  Issue,
  ParsedEntry,
  ValidateReport,
} from "@alihdrndm/roomlist-core";
import { dateRange, eachNight, type IsoDate, nightsOf } from "./dates";
import { fieldLabel } from "./fields";
import { ruleGuide } from "./rules";

// Pure helpers that turn a validate report into what the pages show. No React, so
// every function is unit-tested against core's own results.

export type IssueFilter = "all" | "error" | "warning";

export function countIssues(issues: readonly Issue[]): {
  errors: number;
  warnings: number;
} {
  const errors = issues.filter((issue) => issue.severity === "error").length;
  return { errors, warnings: issues.length - errors };
}

/** "1 error", "3 warnings". */
export function plural(count: number, noun: string, many = `${noun}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? noun : many}`;
}

/** "Okafor, Ada"; "(no last name)" when the cell was empty. */
export function guestName(
  entry: Pick<ParsedEntry, "lastName" | "firstName">,
): string {
  const last = entry.lastName ?? "(no last name)";
  return entry.firstName ? `${last}, ${entry.firstName}` : last;
}

/**
 * Finds the guest an issue is about. Validator issues carry the entry's line;
 * parser issues carry only the spreadsheet row, which is matched through the rows
 * other issues name together with a line. Undefined for file-level issues.
 */
export function makeGuestLookup(report: ValidateReport) {
  const byLine = new Map<number, ParsedEntry>();
  for (const entry of report.entries) {
    if (!byLine.has(entry.line)) byLine.set(entry.line, entry);
  }
  const lineByRow = new Map<number, number>();
  for (const issue of report.issues) {
    if (issue.row !== undefined && issue.line !== undefined)
      lineByRow.set(issue.row, issue.line);
  }
  return (issue: Issue): ParsedEntry | undefined => {
    const line =
      issue.line ??
      (issue.row === undefined ? undefined : lineByRow.get(issue.row));
    return line === undefined ? undefined : byLine.get(line);
  };
}

/** The message without the "Row 7: " / "Line 7: " prefix the row column already shows. */
export function messageBody(message: string): string {
  return message.replace(/^(Row|Line) \d+: /, "");
}

/** Issues matching the severity filter and a free-text query (row, field, code, name, message). */
export function filterIssues(
  issues: readonly Issue[],
  filter: IssueFilter,
  query: string,
  guestOf: (issue: Issue) => ParsedEntry | undefined,
): Issue[] {
  const needle = query.trim().toLowerCase();
  return issues.filter((issue) => {
    if (filter !== "all" && issue.severity !== filter) return false;
    if (needle === "") return true;
    const guest = guestOf(issue);
    const haystack = [
      issue.row === undefined ? "" : `row ${issue.row}`,
      issue.field ?? "",
      issue.field === undefined ? "" : fieldLabel(issue.field),
      issue.code,
      issue.ruleId,
      issue.value ?? "",
      issue.message,
      ruleGuide(issue.ruleId).title,
      guest === undefined ? "" : guestName(guest),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export type IssueGroup = { ruleId: string; code: string; issues: Issue[] };

/** Issues grouped by check, errors first, in the order the API sorted them. */
export function groupByRule(issues: readonly Issue[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>();
  for (const issue of issues) {
    const group = groups.get(issue.ruleId) ?? {
      ruleId: issue.ruleId,
      code: issue.code,
      issues: [],
    };
    group.issues.push(issue);
    groups.set(issue.ruleId, group);
  }
  return [...groups.values()];
}

/** Which checks need block details that are missing, so "no errors" is not read as "fully checked". */
export function skippedBlockChecks(block: {
  hasDates: boolean;
  hasRoomTypes: boolean;
  hasMaxOccupancy: boolean;
}): string[] {
  const skipped: string[] = [];
  if (!block.hasDates) skipped.push("stays against the block dates");
  if (!block.hasRoomTypes) skipped.push("room types");
  if (!block.hasMaxOccupancy) skipped.push("room occupancy");
  return skipped;
}

export type Room = {
  primary: ParsedEntry;
  sharers: ParsedEntry[];
  people: number;
  nights: number;
};

/**
 * Who sleeps together: each primary (a guest who shares with nobody) with the
 * sharers that point at its line, as rule R013 and the exports see them. Sharers
 * whose line does not exist are returned apart.
 */
export function groupRooms(entries: readonly ParsedEntry[]): {
  rooms: Room[];
  orphans: ParsedEntry[];
} {
  const rooms: Room[] = [];
  const byLine = new Map<number, Room>();
  for (const entry of entries) {
    if (entry.sharesWithLine !== undefined) continue;
    const room: Room = {
      primary: entry,
      sharers: [],
      people: entry.adults + entry.children + entry.infants,
      nights: nightsOf(entry.arrivalDate, entry.departureDate),
    };
    rooms.push(room);
    if (!byLine.has(entry.line)) byLine.set(entry.line, room);
  }
  const orphans: ParsedEntry[] = [];
  for (const entry of entries) {
    if (entry.sharesWithLine === undefined) continue;
    const room = byLine.get(entry.sharesWithLine);
    if (room === undefined || room.primary === entry) {
      orphans.push(entry);
      continue;
    }
    room.sharers.push(entry);
    room.people += entry.adults + entry.children + entry.infants;
  }
  return { rooms, orphans };
}

export type NightGrid = {
  nights: IsoDate[];
  rows: { roomType: string; cells: number[]; total: number }[];
  totals: number[];
};

const NO_ROOM_TYPE = "(none)";

/**
 * Rooms per night and room type, the shape of a hotel's block grid. Counts primaries
 * only, `rooms` each, for every night from arrival up to departure, exactly like
 * core's summary; its column totals equal `summary.byNight` and its row totals equal
 * `summary.byRoomType[].roomNights` (a unit test checks both).
 */
export function nightGrid(report: ValidateReport): NightGrid {
  const nights = report.summary.byNight.map((night) => night.date);
  const index = new Map(nights.map((night, position) => [night, position]));
  const rows = report.summary.byRoomType.map((type) => ({
    roomType: type.roomType,
    cells: nights.map(() => 0),
    total: 0,
  }));
  const rowOf = new Map(rows.map((row) => [row.roomType, row]));
  for (const entry of report.entries) {
    if (entry.sharesWithLine !== undefined) continue;
    const { arrivalDate, departureDate } = entry;
    if (arrivalDate === undefined || departureDate === undefined) continue;
    const row = rowOf.get(entry.roomType ?? NO_ROOM_TYPE);
    if (row === undefined) continue;
    for (const night of eachNight(arrivalDate, departureDate)) {
      const position = index.get(night);
      if (position === undefined) continue;
      row.cells[position] = (row.cells[position] ?? 0) + entry.rooms;
      row.total += entry.rooms;
    }
  }
  return {
    nights,
    rows,
    totals: report.summary.byNight.map((night) => night.rooms),
  };
}

/** The issue list as rows for a CSV the planner can send back to whoever owns the spreadsheet. */
export function issueRows(
  report: ValidateReport,
): (string | number | undefined)[][] {
  const guestOf = makeGuestLookup(report);
  return [
    ["Row", "Severity", "Guest", "Field", "Value", "Problem", "Check"],
    ...report.issues.map((issue) => {
      const guest = guestOf(issue);
      return [
        issue.row,
        issue.severity === "error" ? "Error" : "Warning",
        guest === undefined ? "" : guestName(guest),
        issue.field === undefined ? "" : fieldLabel(issue.field),
        issue.value,
        messageBody(issue.message),
        `${issue.ruleId} ${issue.code}`,
      ];
    }),
  ];
}

/**
 * A plain-text note to paste into an email to the list's owner: what must be
 * corrected (errors) and what to confirm (warnings), by row, plus the totals.
 */
export function clientNote(report: ValidateReport, fileName: string): string {
  const { errors, warnings } = countIssues(report.issues);
  const summary = report.summary;
  const lines: string[] = [];
  lines.push(`Rooming list check: ${fileName}`);
  const stay =
    summary.firstArrival !== undefined && summary.lastDeparture !== undefined
      ? `, ${dateRange(summary.firstArrival, summary.lastDeparture)}`
      : "";
  lines.push(
    `${plural(summary.entries, "guest")}, ${plural(summary.rooms, "room")}, ${plural(summary.roomNights, "room night")}${stay}.`,
  );
  const section = (title: string, severity: "error" | "warning") => {
    const items = report.issues.filter((issue) => issue.severity === severity);
    if (items.length === 0) return;
    lines.push("", title);
    for (const issue of items) {
      const where = issue.row === undefined ? "File" : `Row ${issue.row}`;
      lines.push(`- ${where}: ${messageBody(issue.message)}`);
    }
  };
  if (errors === 0 && warnings === 0) {
    lines.push("", "No issues found: the list is ready for the hotel.");
  } else {
    section(`Please correct (${plural(errors, "error")}):`, "error");
    section(`Please confirm (${plural(warnings, "warning")}):`, "warning");
  }
  return lines.join("\n");
}
