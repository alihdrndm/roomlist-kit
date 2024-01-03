import ExcelJS from "exceljs";
import { makeIssue } from "../issues.js";
import type { Issue } from "../model.js";
import { fromParts } from "../plain-date.js";
import { checkZipSizes } from "./zip-guard.js";

/**
 * Rows by position: row n of the sheet is `rows[n - 1]`. Rows with no cells are holes
 * (`undefined`), and a row holds `undefined` holes for empty cells, so the work and
 * memory follow what the file actually contains, not the size of its used range.
 */
export type SparseRows = (string[] | undefined)[];

export type XlsxRead =
  | { kind: "rows"; rows: SparseRows }
  | { kind: "rejected"; issue: Issue };

/** Reads one worksheet into rows of cell strings, in the same shape the CSV reader returns. */
export async function readXlsxRows(
  input: Uint8Array,
  sheetName?: string,
): Promise<XlsxRead> {
  const zip = checkZipSizes(input);
  if (!zip.ok) {
    return {
      kind: "rejected",
      issue: makeIssue(
        "F003",
        `The workbook is too large when unpacked (${zip.reason}). Save only the rooming list sheet and try again.`,
      ),
    };
  }
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs wants an ArrayBuffer; copy just our slice in case input is a view into a larger buffer.
    await workbook.xlsx.load(input.slice().buffer);
  } catch {
    return {
      kind: "rejected",
      issue: makeIssue(
        "F003",
        "The file looks like .xlsx but could not be opened. Re-save it in Excel and try again.",
      ),
    };
  }

  const sheet =
    sheetName === undefined
      ? workbook.worksheets[0]
      : workbook.getWorksheet(sheetName);
  if (sheet === undefined) {
    const available = workbook.worksheets
      .map((ws) => `"${ws.name}"`)
      .join(", ");
    const message =
      sheetName === undefined
        ? "The workbook has no worksheets."
        : `Sheet "${sheetName}" was not found. Available sheets: ${available}.`;
    return { kind: "rejected", issue: makeIssue("F003", message) };
  }

  // Only rows and cells that exist are visited. Looping over rowCount x columnCount
  // would let a tiny file with one cell far down and one far right cost millions of steps.
  const rows: SparseRows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      cells[columnNumber - 1] = cellToString(cell.value);
    });
    rows[rowNumber - 1] = cells;
  });
  return { kind: "rows", rows };
}

/** Turns any exceljs cell value into the text a planner would see. Exported for tests. */
export function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    // Excel stores a calendar date without a zone; exceljs gives it back as UTC midnight.
    return (
      fromParts(
        value.getUTCFullYear(),
        value.getUTCMonth() + 1,
        value.getUTCDate(),
      ) ?? ""
    );
  }
  // String(2) is "2" and String(2.5) is "2.5": no trailing ".0" ever appears.
  if (typeof value === "number") return String(value);
  if (typeof value === "string" || typeof value === "boolean")
    return String(value).trim();
  if ("formula" in value || "sharedFormula" in value) {
    return cellToString(value.result ?? null);
  }
  if ("richText" in value)
    return value.richText
      .map((part) => part.text)
      .join("")
      .trim();
  if ("hyperlink" in value) return cellToString(value.text);
  if ("error" in value) return value.error;
  return "";
}
