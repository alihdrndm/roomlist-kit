import { dateParts, type IsoDate } from "../plain-date.js";

export const DATE_FORMATS = [
  "MM/DD/YYYY",
  "DD/MM/YYYY",
  "YYYY-MM-DD",
  "DD-MM-YYYY",
] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

/** Writes a calendar date in one of the layouts hotels ask for, always zero-padded. */
export function formatDate(date: IsoDate, format: DateFormat): string {
  const { year, month, day } = dateParts(date);
  const yyyy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  switch (format) {
    case "MM/DD/YYYY":
      return `${mm}/${dd}/${yyyy}`;
    case "DD/MM/YYYY":
      return `${dd}/${mm}/${yyyy}`;
    case "YYYY-MM-DD":
      return `${yyyy}-${mm}-${dd}`;
    case "DD-MM-YYYY":
      return `${dd}-${mm}-${yyyy}`;
  }
}
