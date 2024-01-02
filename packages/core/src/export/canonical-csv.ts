import { stringify } from "csv-stringify/sync";
import { ENTRY_FIELDS } from "../model.js";
import type { ExportInput } from "./types.js";

/** Header row first, then one row per entry; absent optional fields become empty cells. */
export function canonicalCsv(input: ExportInput): string {
  const rows = input.entries.map((entry) =>
    ENTRY_FIELDS.map((field) => entry[field] ?? ""),
  );
  return stringify([[...ENTRY_FIELDS], ...rows], { record_delimiter: "\n" });
}
