// Calendar dates ("2026-11-10") are not instants, so they never live in a JS Date
// outside this file. Internally we use UTC midnight, which has no DST jumps, and
// convert back to a string immediately.

declare const isoDateBrand: unique symbol;

/** A calendar date as `YYYY-MM-DD`. Only `parseIsoDate` and the helpers here create one. */
export type IsoDate = string & { readonly [isoDateBrand]: true };

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** Returns the date if `text` is a real calendar date in `YYYY-MM-DD` form, else `undefined`. */
export function parseIsoDate(text: string): IsoDate | undefined {
  const match = ISO_PATTERN.exec(text);
  if (!match) return undefined;
  return fromParts(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** Builds a date from year/month/day numbers; `undefined` for impossible dates like Feb 30. */
export function fromParts(
  year: number,
  month: number,
  day: number,
): IsoDate | undefined {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1)
    return undefined;
  const utc = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC silently rolls Feb 30 over to Mar 2; a round-trip check catches that.
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return undefined;
  }
  return toIso(utc);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return toIso(new Date(toUtc(date).getTime() + days * MS_PER_DAY));
}

/** Whole days from `from` to `to` (positive when `to` is later). Nights stayed = diffDays(arrival, departure). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / MS_PER_DAY);
}

/** Negative, zero or positive, like a sort comparator. */
export function compareDates(a: IsoDate, b: IsoDate): number {
  // ISO strings sort lexically in date order, so no Date object is needed.
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Every night of a stay: from `arrival` up to but not including `departure`. */
export function eachNight(arrival: IsoDate, departure: IsoDate): IsoDate[] {
  const nights: IsoDate[] = [];
  for (
    let date = arrival;
    compareDates(date, departure) < 0;
    date = addDays(date, 1)
  ) {
    nights.push(date);
  }
  return nights;
}

/** Year, month (1–12) and day of a date. */
export function dateParts(date: IsoDate): {
  year: number;
  month: number;
  day: number;
} {
  const utc = toUtc(date);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

const MS_PER_DAY_EXCEL = 24 * 3600 * 1000;

/**
 * The calendar date of an Excel date number. Excel counts days from 1900 (or from
 * 1904 when the workbook says so); the formula is the one exceljs uses, so a date
 * cell reads the same as it did with exceljs. A time of day is dropped.
 */
export function excelSerialToDate(
  serial: number,
  date1904: boolean,
): IsoDate | undefined {
  if (!Number.isFinite(serial)) return undefined;
  const ms = Math.round(
    (serial - 25569 + (date1904 ? 1462 : 0)) * MS_PER_DAY_EXCEL,
  );
  const utc = new Date(ms);
  return fromParts(
    utc.getUTCFullYear(),
    utc.getUTCMonth() + 1,
    utc.getUTCDate(),
  );
}

/** The calendar date part of an ISO 8601 date-time written in a cell (`t="d"`), read in UTC. */
export function isoDateTimeToDate(text: string): IsoDate | undefined {
  const utc = new Date(text);
  if (Number.isNaN(utc.getTime())) return undefined;
  return fromParts(
    utc.getUTCFullYear(),
    utc.getUTCMonth() + 1,
    utc.getUTCDate(),
  );
}

function toUtc(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

function toIso(utc: Date): IsoDate {
  const year = String(utc.getUTCFullYear()).padStart(4, "0");
  const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as IsoDate;
}
