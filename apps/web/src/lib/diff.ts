import type { DiffReport, ParsedEntry } from "@alihdrndm/roomlist-core";
import {
  compareDates,
  dateRange,
  eachNight,
  type IsoDate,
  nightsOf,
} from "./dates";
import { fieldLabel } from "./fields";
import { guestName, plural } from "./report";

// Pure helpers behind the Compare page.

export type ChangeKind = "added" | "removed" | "changed";

export type ChangeRow = {
  kind: ChangeKind;
  key: string;
  entry: ParsedEntry;
  /** Only for "changed": the entry as it was. */
  before?: ParsedEntry;
  changes: DiffReport["changed"][number]["changes"];
};

/** Added, removed and changed guests as one list, in that order. */
export function changeRows(report: DiffReport): ChangeRow[] {
  return [
    ...report.added.map((entry, index) => ({
      kind: "added" as const,
      key: `a-${entry.line}-${index}`,
      entry,
      changes: [],
    })),
    ...report.removed.map((entry, index) => ({
      kind: "removed" as const,
      key: `r-${entry.line}-${index}`,
      entry,
      changes: [],
    })),
    ...report.changed.map((item, index) => ({
      kind: "changed" as const,
      key: `c-${item.after.line}-${index}`,
      entry: item.after,
      before: item.before,
      changes: item.changes,
    })),
  ];
}

export function filterChanges(
  rows: readonly ChangeRow[],
  kind: ChangeKind | "all",
  query: string,
): ChangeRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (kind !== "all" && row.kind !== kind) return false;
    if (needle === "") return true;
    return [
      guestName(row.entry),
      row.entry.roomType ?? "",
      row.entry.confirmationNumber ?? "",
      `line ${row.entry.line}`,
      ...row.changes.map((change) => fieldLabel(change.field)),
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}

/** Room nights a guest holds: nights × rooms for a primary, nothing for a sharer (as in core's summary). */
function roomNightsOf(entry: ParsedEntry): number {
  if (entry.sharesWithLine !== undefined) return 0;
  return nightsOf(entry.arrivalDate, entry.departureDate) * entry.rooms;
}

function nightsHeld(entry: ParsedEntry): IsoDate[] {
  if (entry.sharesWithLine !== undefined) return [];
  const { arrivalDate, departureDate } = entry;
  if (arrivalDate === undefined || departureDate === undefined) return [];
  return eachNight(arrivalDate, departureDate);
}

/**
 * Where the room-night change lands. Unchanged guests are left out of a diff, and
 * any change to dates, rooms, room type or sharing makes a guest "changed", so the
 * added, removed and changed guests account for the whole difference: the totals
 * here always add up to `summary.roomNightsDelta` (a unit test checks it).
 */
export function deltas(report: DiffReport): {
  byRoomType: { roomType: string; delta: number }[];
  byNight: { date: IsoDate; delta: number }[];
} {
  const types = new Map<string, number>();
  const nights = new Map<IsoDate, number>();
  const apply = (entry: ParsedEntry, sign: 1 | -1) => {
    const type = entry.roomType ?? "(none)";
    types.set(type, (types.get(type) ?? 0) + sign * roomNightsOf(entry));
    for (const night of nightsHeld(entry))
      nights.set(night, (nights.get(night) ?? 0) + sign * entry.rooms);
  };
  for (const entry of report.added) apply(entry, 1);
  for (const entry of report.removed) apply(entry, -1);
  for (const item of report.changed) {
    apply(item.before, -1);
    apply(item.after, 1);
  }
  const byRoomType = [...types.entries()]
    .filter(([, delta]) => delta !== 0)
    .map(([roomType, delta]) => ({ roomType, delta }))
    .sort((a, b) =>
      a.roomType < b.roomType ? -1 : a.roomType > b.roomType ? 1 : 0,
    );
  const byNight = [...nights.entries()]
    .filter(([, delta]) => delta !== 0)
    .map(([date, delta]) => ({ date, delta }))
    .sort((a, b) => compareDates(a.date, b.date));
  return { byRoomType, byNight };
}

/** "+4", "−2" (a real minus sign), "0". */
export function signedDelta(value: number): string {
  return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0";
}

function stayText(entry: ParsedEntry): string {
  const { arrivalDate, departureDate } = entry;
  if (arrivalDate === undefined || departureDate === undefined)
    return "dates missing";
  return dateRange(arrivalDate, departureDate);
}

/** A plain-text update for the hotel: what to add, cancel and change, plus the room-night effect. */
export function updateNote(
  report: DiffReport,
  names: { before: string; after: string },
): string {
  const { summary } = report;
  const lines = [
    `Rooming list update: ${names.before} → ${names.after}`,
    `${plural(summary.added, "new guest")}, ${plural(summary.removed, "cancellation")}, ${plural(summary.changed, "change")}. Room nights ${summary.roomNightsBefore} → ${summary.roomNightsAfter} (${signedDelta(summary.roomNightsDelta)}).`,
  ];
  const describe = (entry: ParsedEntry) =>
    `${guestName(entry)}, ${stayText(entry)}${entry.roomType === undefined ? "" : `, ${entry.roomType}`}${entry.confirmationNumber === undefined ? "" : ` (conf. ${entry.confirmationNumber})`}`;
  if (report.added.length > 0) {
    lines.push("", "Please add:");
    for (const entry of report.added) lines.push(`+ ${describe(entry)}`);
  }
  if (report.removed.length > 0) {
    lines.push("", "Please cancel:");
    for (const entry of report.removed) lines.push(`- ${describe(entry)}`);
  }
  if (report.changed.length > 0) {
    lines.push("", "Please change:");
    for (const item of report.changed) {
      const what = item.changes
        .map(
          (change) =>
            `${fieldLabel(change.field)} ${change.before ?? "(empty)"} → ${change.after ?? "(empty)"}`,
        )
        .join("; ");
      lines.push(`~ ${guestName(item.after)}: ${what}`);
    }
  }
  return lines.join("\n");
}

/** The changes as CSV rows: one row per added or removed guest, one per changed field. */
export function changeCsvRows(
  report: DiffReport,
): (string | number | undefined)[][] {
  const rows: (string | number | undefined)[][] = [
    ["Change", "Line", "Guest", "Confirmation", "Field", "Before", "After"],
  ];
  for (const entry of report.added)
    rows.push([
      "Added",
      entry.line,
      guestName(entry),
      entry.confirmationNumber,
      "",
      "",
      stayText(entry),
    ]);
  for (const entry of report.removed)
    rows.push([
      "Removed",
      entry.line,
      guestName(entry),
      entry.confirmationNumber,
      "",
      stayText(entry),
      "",
    ]);
  for (const item of report.changed)
    for (const change of item.changes)
      rows.push([
        "Changed",
        item.after.line,
        guestName(item.after),
        item.after.confirmationNumber,
        fieldLabel(change.field),
        change.before ?? "",
        change.after ?? "",
      ]);
  return rows;
}
