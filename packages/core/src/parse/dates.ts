import type { DateOrder } from "../model.js";
import { fromParts, type IsoDate } from "../plain-date.js";

/**
 * How a date cell was written. W205 needs to know whether the file contained any
 * unambiguous form (ISO, month name, Excel date cell) and whether every numeric
 * date could be read either way round.
 */
export type DateForm = "iso" | "numeric" | "monthName";

export type DateParse =
  | { ok: true; date: IsoDate; form: DateForm; ambiguous: boolean }
  | { ok: false; form: DateForm | "unknown"; ambiguous: boolean };

const ISO = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
// Same separator twice (\2), so "11/10-2026" is rejected rather than guessed at.
const NUMERIC = /^(\d{1,2})([/.-])(\d{1,2})\2(\d{4})$/;
const DAY_MONTH_YEAR = /^(\d{1,2})\s+([a-z]+)\.?,?\s+(\d{4})$/i;
const MONTH_DAY_YEAR = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** Full name or 3-letter abbreviation, any case → 1–12; otherwise undefined. */
function monthNumber(name: string): number | undefined {
  const lower = name.toLowerCase();
  const index = MONTHS.findIndex(
    (month) => month === lower || month.slice(0, 3) === lower,
  );
  return index === -1 ? undefined : index + 1;
}

/** Parses one date cell. Anything not in the HANDOFF.md date table (2-digit years, Feb 30, …) is `ok: false`. */
export function parseDateText(raw: string, order: DateOrder): DateParse {
  const text = raw.trim();

  const iso = ISO.exec(text);
  if (iso)
    return result(
      fromParts(Number(iso[1]), Number(iso[2]), Number(iso[3])),
      "iso",
      false,
    );

  const numeric = NUMERIC.exec(text);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[3]);
    const year = Number(numeric[4]);
    const ambiguous = first <= 12 && second <= 12;
    const date =
      order === "MDY"
        ? fromParts(year, first, second)
        : fromParts(year, second, first);
    return result(date, "numeric", ambiguous);
  }

  const dmy = DAY_MONTH_YEAR.exec(text);
  if (dmy) {
    const month = monthNumber(dmy[2] ?? "");
    const date =
      month === undefined
        ? undefined
        : fromParts(Number(dmy[3]), month, Number(dmy[1]));
    return result(date, "monthName", false);
  }

  const mdy = MONTH_DAY_YEAR.exec(text);
  if (mdy) {
    const month = monthNumber(mdy[1] ?? "");
    const date =
      month === undefined
        ? undefined
        : fromParts(Number(mdy[3]), month, Number(mdy[2]));
    return result(date, "monthName", false);
  }

  return { ok: false, form: "unknown", ambiguous: false };
}

function result(
  date: IsoDate | undefined,
  form: DateForm,
  ambiguous: boolean,
): DateParse {
  return date === undefined
    ? { ok: false, form, ambiguous }
    : { ok: true, date, form, ambiguous };
}

/**
 * Tracks every date cell in a file to decide W205: at least one numeric date,
 * no unambiguous form, and every numeric date readable either way round.
 */
export class DateOrderEvidence {
  private numericCount = 0;
  private sawUnambiguousForm = false;
  private sawUnambiguousNumeric = false;

  record(parsed: DateParse): void {
    if (parsed.form === "iso" || parsed.form === "monthName")
      this.sawUnambiguousForm = true;
    if (parsed.form === "numeric") {
      this.numericCount++;
      if (!parsed.ambiguous) this.sawUnambiguousNumeric = true;
    }
  }

  isAmbiguous(): boolean {
    return (
      this.numericCount > 0 &&
      !this.sawUnambiguousForm &&
      !this.sawUnambiguousNumeric
    );
  }
}
