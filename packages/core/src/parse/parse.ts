import { makeIssue, sortIssues } from "../issues.js";
import type {
  Issue,
  ParsedEntry,
  ParseOptions,
  ParseResult,
} from "../model.js";
import { readCsvRows } from "./csv.js";
import { DateOrderEvidence } from "./dates.js";
import { detectFormat } from "./detect-format.js";
import { findHeaderRow, isBlankRow, mapHeaders } from "./headers.js";
import { normalizeRow } from "./normalize.js";
import { readXlsxRows } from "./xlsx.js";

const DEFAULT_MAX_ROWS = 5000;

/**
 * Bytes of a CSV or XLSX rooming list → entries plus every problem found.
 * Async because exceljs can only read workbooks asynchronously
 * (docs/DECISIONS.md, 2026-10-06). File-level (F) errors stop parsing and
 * return no entries; cell problems are reported and parsing continues, so one
 * run shows the planner everything that needs fixing.
 */
export async function parseRoomingList(
  input: Uint8Array,
  options: ParseOptions = {},
): Promise<ParseResult> {
  const dateOrder = options.dateOrder ?? "MDY";
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;

  // Step 1–3: detect the format and read raw rows.
  const detected = detectFormat(input);
  if (detected.kind === "rejected") return failed("csv", [detected.issue]);
  const format = detected.kind;

  let rows: string[][];
  if (detected.kind === "xlsx") {
    const read = await readXlsxRows(input, options.sheetName);
    if (read.kind === "rejected") return failed(format, [read.issue]);
    rows = read.rows;
  } else {
    const read = readCsvRows(detected.text);
    if (read.kind === "rejected") return failed(format, [read.issue]);
    rows = read.rows;
  }

  // Step 4–6: find and map the header row, check required columns.
  const headerIndex = findHeaderRow(rows, options.columnMap);
  if (headerIndex === -1) {
    return failed(format, [
      makeIssue(
        "F001",
        "The file has no data. Add a header row and one row per guest.",
      ),
    ]);
  }
  const headerRowNumber = headerIndex + 1;
  const mapping = mapHeaders(
    rows[headerIndex] ?? [],
    options.columnMap,
    headerRowNumber,
  );
  const issues: Issue[] = [...mapping.issues];
  if (hasFileError(issues)) return failed(format, issues, mapping.columns);

  // Step 7: row limit. Blank rows are skipped but keep their row number.
  const dataRows: { cells: string[]; row: number }[] = [];
  rows.forEach((cells, index) => {
    if (index > headerIndex && !isBlankRow(cells))
      dataRows.push({ cells, row: index + 1 });
  });

  // A column with no header is padding unless it holds data; data would be lost silently.
  // CSV rows may also be longer than the header row; those extra cells have no header either.
  const headerWidth = rows[headerIndex]?.length ?? 0;
  const widest = Math.max(
    headerWidth,
    ...dataRows.map(({ cells }) => cells.length),
  );
  const headerless = [...mapping.blankHeaderIndexes];
  for (let index = headerWidth; index < widest; index++) headerless.push(index);
  for (const index of headerless) {
    if (dataRows.some(({ cells }) => (cells[index] ?? "").trim() !== "")) {
      issues.push(
        makeIssue(
          "W201",
          `Column ${index + 1} has no header, so its data is ignored. Add a header if it matters.`,
          { row: headerRowNumber },
        ),
      );
    }
  }
  if (dataRows.length > maxRows) {
    issues.push(
      makeIssue(
        "F007",
        `The file has ${dataRows.length} guest rows; the limit is ${maxRows}. Split it into smaller files.`,
      ),
    );
    return failed(format, issues, mapping.columns, dataRows.length);
  }

  // Step 8: normalise every row.
  const useFullName =
    !mapping.fieldIndex.has("lastName") && mapping.fieldIndex.has("fullName");
  if (useFullName) {
    issues.push(
      makeIssue(
        "W207",
        "Names were split from a single name column (last word = last name, or 'Last, First'). Check them, or use separate Last Name and First Name columns.",
        { field: "fullName" },
      ),
    );
  }
  const evidence = new DateOrderEvidence();
  const entries: ParsedEntry[] = [];
  dataRows.forEach(({ cells, row }, index) => {
    const result = normalizeRow(cells, {
      row,
      entryNumber: index + 1,
      fieldIndex: mapping.fieldIndex,
      dateOrder,
      useFullName,
      evidence,
    });
    entries.push(result.entry);
    issues.push(...result.issues);
  });
  if (evidence.isAmbiguous()) {
    issues.push(
      makeIssue(
        "W205",
        `Every date in the file could be read as month/day or day/month; it was read as ${dateOrder === "MDY" ? "month/day" : "day/month"}. Check the dates, or switch the date order.`,
      ),
    );
  }

  return {
    format,
    entries,
    issues: sortIssues(issues),
    columns: mapping.columns,
    rowCount: dataRows.length,
  };
}

function hasFileError(issues: Issue[]): boolean {
  return issues.some(
    (issue) => issue.severity === "error" && issue.ruleId.startsWith("F"),
  );
}

function failed(
  format: ParseResult["format"],
  issues: Issue[],
  columns: ParseResult["columns"] = [],
  rowCount = 0,
): ParseResult {
  return { format, entries: [], issues: sortIssues(issues), columns, rowCount };
}
