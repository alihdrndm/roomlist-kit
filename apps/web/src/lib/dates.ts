import {
  addDays,
  compareDates,
  dateParts,
  dayOfWeek,
  diffDays,
  eachNight,
  type IsoDate,
  parseIsoDate,
} from "@alihdrndm/roomlist-core/plain-date";

// Display helpers for calendar dates. All date math goes through core's
// plain-date.ts (a pure module with no imports, safe for the browser bundle).

export { compareDates, diffDays, eachNight, type IsoDate, parseIsoDate };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "Tue" for 2026-11-10. */
export function weekday(date: IsoDate): string {
  return WEEKDAYS[dayOfWeek(date)] ?? "";
}

/** "10 Nov" — day before month, so it reads the same to US and European planners. */
export function dayMonth(date: IsoDate): string {
  const { month, day } = dateParts(date);
  return `${day} ${MONTHS[month - 1] ?? ""}`;
}

/** "10 Nov 2026". */
export function longDate(date: IsoDate): string {
  return `${dayMonth(date)} ${dateParts(date).year}`;
}

/** "10–14 Nov 2026", "28 Nov – 2 Dec 2026", "28 Dec 2026 – 2 Jan 2027". */
export function dateRange(from: IsoDate, to: IsoDate): string {
  const a = dateParts(from);
  const b = dateParts(to);
  if (a.year !== b.year) return `${longDate(from)} – ${longDate(to)}`;
  if (a.month !== b.month) return `${dayMonth(from)} – ${longDate(to)}`;
  return `${a.day}–${longDate(to)}`;
}

/** A date typed into the block form, or undefined when it is blank or not a real date. */
export function isoOrUndefined(text: string): IsoDate | undefined {
  return text.trim() === "" ? undefined : parseIsoDate(text.trim());
}

export type NightKind = "block" | "shoulder" | "outside" | "unknown";

/** The block window as the validator sees it (rules.ts): nights from start to end, plus shoulder days on each side. */
export type BlockWindow = {
  start?: IsoDate | undefined;
  end?: IsoDate | undefined;
  shoulderDays: number;
};

/**
 * Where a night falls relative to the block: inside it, on a shoulder night (allowed,
 * W202 asks to check the rate), or outside (R004). "unknown" when there is no block
 * date to compare with. The end date is the last departure, so its night is not a
 * block night.
 */
export function nightKind(night: IsoDate, window: BlockWindow): NightKind {
  const { start, end, shoulderDays } = window;
  if (start === undefined && end === undefined) return "unknown";
  if (start !== undefined && compareDates(night, start) < 0) {
    return compareDates(night, addDays(start, -shoulderDays)) >= 0
      ? "shoulder"
      : "outside";
  }
  if (end !== undefined && compareDates(night, end) >= 0) {
    return compareDates(night, addDays(end, shoulderDays)) < 0
      ? "shoulder"
      : "outside";
  }
  return "block";
}

/** Nights of a stay, or 0 when a date is missing or the stay is not at least one night. */
export function nightsOf(
  arrival: IsoDate | undefined,
  departure: IsoDate | undefined,
): number {
  if (arrival === undefined || departure === undefined) return 0;
  return Math.max(0, diffDays(arrival, departure));
}
