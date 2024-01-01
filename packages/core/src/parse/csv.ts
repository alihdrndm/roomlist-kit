import { CsvError, parse } from "csv-parse/sync";
import { makeIssue } from "../issues.js";
import type { Issue } from "../model.js";

const CANDIDATE_DELIMITERS = [",", ";", "\t"] as const;

export type CsvRead =
  | { kind: "rows"; rows: string[][] }
  | { kind: "rejected"; issue: Issue };

/**
 * Splits CSV text into rows of raw cell strings. Row i of the result is source row
 * i + 1, which is what a planner sees in a spreadsheet (a quoted multi-line cell
 * still counts as one row). Empty lines are kept so row numbers stay correct.
 */
export function readCsvRows(text: string): CsvRead {
  try {
    const rows: string[][] = parse(text, {
      delimiter: detectDelimiter(text),
      quote: '"',
      // A quote inside an unquoted cell (O"Brien) is kept as text instead of failing.
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: false,
      cast: false,
    });
    return { kind: "rows", rows };
  } catch (error) {
    // Only an opened-but-never-closed quote gets here: the rest of the file would be
    // one giant cell, so there is nothing sensible to recover. See docs/DECISIONS.md.
    if (!(error instanceof CsvError)) throw error;
    const where =
      typeof error.lines === "number" ? ` near row ${error.lines}` : "";
    return {
      kind: "rejected",
      issue: makeIssue(
        "F004",
        `The CSV is malformed${where}: a quote (") is opened and never closed. Fix the quotes or re-save the file from Excel.`,
      ),
    };
  }
}

/** European Excel saves CSV with ";", some exports use tabs; pick whichever dominates line one. */
export function detectDelimiter(text: string): string {
  const firstLine =
    text.split(/\r?\n/).find((line) => line.trim() !== "") ?? "";
  const counts = CANDIDATE_DELIMITERS.map((delimiter) =>
    count(firstLine, delimiter),
  );
  const highest = Math.max(...counts);
  const winners = CANDIDATE_DELIMITERS.filter(
    (_, index) => counts[index] === highest,
  );
  // Any tie for first place (including "no delimiter at all") falls back to a comma.
  return winners.length === 1 ? (winners[0] ?? ",") : ",";
}

function count(text: string, char: string): number {
  return text.split(char).length - 1;
}
