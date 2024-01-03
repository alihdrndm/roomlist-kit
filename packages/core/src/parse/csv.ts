import { makeIssue } from "../issues.js";
import type { Issue } from "../model.js";
import { YIELD_EVERY, yieldToEventLoop } from "./yield.js";

const CANDIDATE_DELIMITERS = [",", ";", "\t"] as const;
const QUOTE = 0x22; // "

// Every blank line is stored as this one shared row. Blank lines do not count toward
// the row limit, so a file of millions of them must not cost an array each.
const BLANK_ROW: string[] = [""];
const isBlank = (row: string[]) => row.every((cell) => cell.trim() === "");

export type CsvRead =
  | {
      kind: "rows";
      rows: string[][];
      /** Reading stopped early: more non-blank rows than `stopAfter`. */
      truncated: boolean;
    }
  | { kind: "rejected"; issue: Issue };

/**
 * Splits CSV text into rows of raw cell strings, in one linear pass. Row i of the
 * result is source row i + 1 (a quoted multi-line cell still counts as one row), and
 * empty lines are kept as [""] so row numbers stay correct.
 *
 * Written for this project instead of csv-parse, which took about 0.13 ms per row
 * shorter than the header: a 5 MB file of one-cell rows blocked the server for
 * minutes (docs/DECISIONS.md, M6 review). A test checks it gives the same rows as
 * csv-parse on well-formed CSV.
 *
 * Rules: a field that starts with " is quoted ("" inside is one "), and anything
 * after its closing quote up to the next delimiter is kept as text; a " inside an
 * unquoted field is kept as text; records end at \n, \r\n or \r; nothing is trimmed
 * or converted. A quote that is opened and never closed rejects the file (F004).
 */
export async function readCsvRows(
  text: string,
  stopAfter = Number.POSITIVE_INFINITY,
): Promise<CsvRead> {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  if (text.length === 0) return { kind: "rows", rows, truncated: false };

  // Next position of each boundary character, re-searched only once passed, so the
  // whole scan stays linear even for one row with millions of cells.
  const next = { delimiter: -1, lf: -1, cr: -1 };
  const find = (key: keyof typeof next, char: string, from: number) => {
    if (next[key] !== Number.POSITIVE_INFINITY && next[key] < from) {
      const found = text.indexOf(char, from);
      next[key] = found === -1 ? Number.POSITIVE_INFINITY : found;
    }
    return next[key];
  };
  const boundary = (from: number) =>
    Math.min(
      find("delimiter", delimiter, from),
      find("lf", "\n", from),
      find("cr", "\r", from),
      text.length,
    );

  let row: string[] = [];
  let nonBlankRows = 0;
  let position = 0;
  let nextYield = YIELD_EVERY;

  while (true) {
    // Checked per field, so even one enormous row gives the event loop its turns.
    if (position > nextYield) {
      nextYield = position + YIELD_EVERY;
      await yieldToEventLoop();
    }
    let field: string;
    if (text.charCodeAt(position) === QUOTE) {
      // Quoted field: copy up to each quote; a doubled quote is an escaped one.
      let value = "";
      let cursor = position + 1;
      while (true) {
        const quote = text.indexOf('"', cursor);
        if (quote === -1) return unclosedQuote(rows.length + 1);
        value += text.slice(cursor, quote);
        if (text.charCodeAt(quote + 1) === QUOTE) {
          value += '"';
          cursor = quote + 2;
          continue;
        }
        cursor = quote + 1;
        break;
      }
      // Text after the closing quote (as in "Ada"Grace) is kept rather than rejected.
      const end = boundary(cursor);
      field = value + text.slice(cursor, end);
      position = end;
    } else {
      const end = boundary(position);
      field = text.slice(position, end);
      position = end;
    }
    row.push(field);

    if (position >= text.length) break;
    if (text[position] === delimiter) {
      position++;
      if (position >= text.length) {
        row.push(""); // "a," at the very end: an empty last cell
        break;
      }
      continue;
    }

    // End of a record.
    position += text[position] === "\r" && text[position + 1] === "\n" ? 2 : 1;
    if (isBlank(row)) {
      rows.push(BLANK_ROW);
    } else {
      rows.push(row);
      nonBlankRows++;
      if (nonBlankRows > stopAfter)
        return { kind: "rows", rows, truncated: true };
    }
    row = [];
    // A newline right at the end does not start another (empty) record.
    if (position >= text.length)
      return { kind: "rows", rows, truncated: false };
  }

  if (isBlank(row)) {
    rows.push(BLANK_ROW);
    return { kind: "rows", rows, truncated: false };
  }
  rows.push(row);
  return { kind: "rows", rows, truncated: nonBlankRows + 1 > stopAfter };
}

function unclosedQuote(row: number): CsvRead {
  return {
    kind: "rejected",
    issue: makeIssue(
      "F004",
      `The CSV is malformed near row ${row}: a quote (") is opened and never closed. Fix the quotes or re-save the file from Excel.`,
    ),
  };
}

/** European Excel saves CSV with ";", some exports use tabs; pick whichever dominates line one. */
export function detectDelimiter(text: string): string {
  const firstLine = firstNonEmptyLine(text);
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

/** The first line with something other than whitespace, found without splitting the whole text. */
function firstNonEmptyLine(text: string): string {
  let start = 0;
  while (start < text.length) {
    const lf = text.indexOf("\n", start);
    const end = lf === -1 ? text.length : lf;
    const line = text.slice(start, end).replace(/\r$/, "");
    if (line.trim() !== "") return line;
    start = end + 1;
  }
  return "";
}

function count(text: string, char: string): number {
  let total = 0;
  for (let at = text.indexOf(char); at !== -1; at = text.indexOf(char, at + 1))
    total++;
  return total;
}
