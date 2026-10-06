import { excelSerialToDate, isoDateTimeToDate } from "../plain-date.js";
import {
  collectText,
  type DateStyles,
  type SharedStrings,
} from "./xlsx-parts.js";
import { attr, nextTag, textAfter } from "./xlsx-xml.js";
import { YIELD_EVERY, yieldToEventLoop } from "./yield.js";

/**
 * Rows by position: row n of the sheet is `rows[n - 1]`. Rows with no cells are holes
 * (`undefined`), and a row holds holes for empty cells, so work and memory follow
 * what the file actually contains, not the size of its used range.
 */
export type SparseRows = (string[] | undefined)[];

export type SheetContext = {
  sharedStrings: SharedStrings | undefined;
  dateStyles: DateStyles;
  date1904: boolean;
};

export type SheetRows = {
  rows: SparseRows;
  /** True when reading stopped early because the sheet has more non-blank rows than `stopAfter`. */
  truncated: boolean;
};

/**
 * Reads a worksheet's XML into rows of cell text. Stops as soon as more than
 * `stopAfter` non-blank rows have been seen: the caller only needs to know the list
 * is too long, so a million-row sheet costs a few thousand rows of work.
 */
export async function readSheetRows(
  xml: string,
  context: SheetContext,
  stopAfter: number,
): Promise<SheetRows> {
  const rows: SparseRows = [];
  let rowNumber = 0;
  let columnNumber = 0;
  let cells: string[] | undefined;
  let nonBlankRows = 0;
  let nextYield = YIELD_EVERY;
  let position = 0;

  while (true) {
    const tag = nextTag(xml, position);
    if (tag === undefined) break;
    position = tag.end;
    if (position > nextYield) {
      nextYield = position + YIELD_EVERY;
      await yieldToEventLoop();
    }

    if (tag.name === "row") {
      if (!tag.closing) {
        rowNumber = positiveInt(attr(tag.attrs, "r")) ?? rowNumber + 1;
        columnNumber = 0;
        cells = [];
        if (!tag.selfClosing) continue;
      }
      // End of a row (or an empty <row/>): keep it only if it has cells.
      if (cells !== undefined && cells.length > 0) {
        rows[rowNumber - 1] = cells;
        if (cells.some((cell) => cell.trim() !== "")) {
          nonBlankRows++;
          if (nonBlankRows > stopAfter) return { rows, truncated: true };
        }
      }
      cells = undefined;
      continue;
    }

    if (tag.name === "c" && !tag.closing && cells !== undefined) {
      columnNumber =
        columnFromReference(attr(tag.attrs, "r")) ?? columnNumber + 1;
      if (tag.selfClosing) continue; // a styled but empty cell
      const close = xml.indexOf(`</${tag.rawName}>`, tag.end);
      const end = close === -1 ? xml.length : close;
      const text = cellText(xml, tag.attrs, tag.end, end, context);
      if (text !== undefined) cells[columnNumber - 1] = text;
      // Continue after the cell: its inner tags (<v>, <is>, <t>) have been read.
      position = end;
    }
  }
  return { rows, truncated: false };
}

/**
 * The text a planner sees in one cell, converted the way exceljs did before this
 * reader replaced it (docs/DECISIONS.md): shared and inline strings trimmed, numbers
 * without a trailing ".0", dates as YYYY-MM-DD, booleans as true/false, errors as
 * their code. A formula cell shows its cached result. Undefined = no value.
 */
function cellText(
  xml: string,
  attrs: string,
  start: number,
  end: number,
  context: SheetContext,
): string | undefined {
  const type = attr(attrs, "t") ?? "n";
  let value: string | undefined;
  for (
    let tag = nextTag(xml, start);
    tag !== undefined && tag.start < end;
    tag = nextTag(xml, tag.end)
  ) {
    if (tag.closing) continue;
    if (tag.name === "v") {
      value = textAfter(xml, tag);
    } else if (tag.name === "is") {
      const close = xml.indexOf(`</${tag.rawName}>`, tag.end);
      return collectText(
        xml,
        tag.end,
        close === -1 || close > end ? end : close,
      ).trim();
    }
  }
  if (value === undefined) return undefined;

  switch (type) {
    case "s": {
      const index = positiveIntOrZero(value);
      const text =
        index === undefined ? undefined : context.sharedStrings?.get(index);
      return text?.trim();
    }
    case "str":
    case "inlineStr":
      return value.trim();
    case "b":
      return Number.parseInt(value, 10) !== 0 ? "true" : "false";
    case "e":
      return value;
    case "d":
      return isoDateTimeToDate(value) ?? "";
    default: {
      if (value.trim() === "") return undefined;
      const number = Number(value);
      const style = positiveIntOrZero(attr(attrs, "s") ?? "0") ?? 0;
      if (context.dateStyles.isDate(style))
        return excelSerialToDate(number, context.date1904) ?? "";
      return String(number);
    }
  }
}

/** "AB12" → 28 (column AB). Undefined when there is no usable reference. */
export function columnFromReference(
  reference: string | undefined,
): number | undefined {
  if (reference === undefined) return undefined;
  let column = 0;
  let index = 0;
  for (; index < reference.length; index++) {
    const code = reference.charCodeAt(index);
    if (code >= 65 && code <= 90) column = column * 26 + (code - 64);
    else if (code >= 97 && code <= 122) column = column * 26 + (code - 96);
    else break;
  }
  // Excel has at most 16,384 columns (XFD); anything beyond is not a real reference.
  return index === 0 || column > 16_384 ? undefined : column;
}

function positiveInt(text: string | undefined): number | undefined {
  if (text === undefined || !/^\d{1,7}$/.test(text)) return undefined;
  const value = Number(text);
  // Excel has at most 1,048,576 rows.
  return value >= 1 && value <= 1_048_576 ? value : undefined;
}

function positiveIntOrZero(text: string): number | undefined {
  return /^\d{1,9}$/.test(text.trim()) ? Number(text.trim()) : undefined;
}
