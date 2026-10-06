import { makeIssue } from "../issues.js";
import type { Issue } from "../model.js";
import {
  DateStyles,
  readRelationships,
  readWorkbook,
  SharedStrings,
} from "./xlsx-parts.js";
import { readSheetRows, type SparseRows } from "./xlsx-sheet.js";
import { extractEntry, readZipDirectory, type ZipEntry } from "./zip.js";

export type { SparseRows } from "./xlsx-sheet.js";

export type XlsxRead =
  | {
      kind: "rows";
      rows: SparseRows;
      /** Reading stopped early: the sheet has far more non-blank rows than the limit allows. */
      truncated: boolean;
    }
  | { kind: "rejected"; issue: Issue };

// The most each part may unpack to. A rooming list of 5,000 rows is a few MB of
// sheet XML; these limits are generous for that and still keep memory bounded.
const PART_LIMITS = {
  sheet: 48 * 1024 * 1024,
  sharedStrings: 24 * 1024 * 1024,
  styles: 8 * 1024 * 1024,
  small: 2 * 1024 * 1024,
} as const;

/** Rows beyond the limit that are still read, for title rows above the header. */
export const TITLE_ROW_ALLOWANCE = 100;

const unreadable = (): XlsxRead => ({
  kind: "rejected",
  issue: makeIssue(
    "F003",
    "The file looks like .xlsx but could not be opened. Re-save it in Excel and try again.",
  ),
});

const tooLarge = (reason: string): XlsxRead => ({
  kind: "rejected",
  issue: makeIssue(
    "F003",
    `The workbook is too large when unpacked (${reason}). Save only the rooming list sheet and try again.`,
  ),
});

class PartError extends Error {
  constructor(readonly result: XlsxRead) {
    super("part could not be read");
  }
}

/**
 * Reads one worksheet into rows of cell strings, in the same shape the CSV reader
 * returns. A small reader of its own (docs/DECISIONS.md, M6 review): it unpacks only
 * the parts it needs, each with a size limit enforced while unpacking, never touches
 * the disk, and stops reading the sheet once it is clearly over `maxRows`.
 */
export async function readXlsxRows(
  input: Uint8Array,
  sheetName?: string,
  maxRows = 5000,
): Promise<XlsxRead> {
  const directory = readZipDirectory(input);
  if (directory.kind === "unreadable") return unreadable();
  if (directory.kind === "too-large") return tooLarge(directory.reason);
  const entries = directory.entries;

  const text = async (
    entry: ZipEntry | undefined,
    limit: number,
    label: string,
  ): Promise<string | undefined> => {
    if (entry === undefined) return undefined;
    const extracted = await extractEntry(input, entry, limit);
    if (extracted.kind === "too-large") {
      throw new PartError(
        tooLarge(`the ${label} part is over ${limit / 1024 / 1024} MB`),
      );
    }
    if (extracted.kind === "forged") {
      throw new PartError(
        tooLarge(`the ${label} part unpacks to more than the archive says`),
      );
    }
    if (extracted.kind === "unreadable") throw new PartError(unreadable());
    return new TextDecoder().decode(extracted.data);
  };

  try {
    const workbookXml = await text(
      entries.get("xl/workbook.xml"),
      PART_LIMITS.small,
      "workbook",
    );
    const relationshipsXml = await text(
      entries.get("xl/_rels/workbook.xml.rels"),
      PART_LIMITS.small,
      "relationships",
    );
    if (workbookXml === undefined || relationshipsXml === undefined)
      return unreadable();

    const workbook = readWorkbook(workbookXml);
    const relationships = readRelationships(relationshipsXml);
    const sheet =
      sheetName === undefined
        ? workbook.sheets[0]
        : workbook.sheets.find((candidate) => candidate.name === sheetName);
    if (sheet === undefined) {
      const available = workbook.sheets
        .map((candidate) => `"${candidate.name}"`)
        .join(", ");
      const message =
        sheetName === undefined
          ? "The workbook has no worksheets."
          : `Sheet "${sheetName}" was not found. Available sheets: ${available}.`;
      return { kind: "rejected", issue: makeIssue("F003", message) };
    }
    const sheetPath = relationships.get(sheet.relationshipId);
    const sheetEntry =
      sheetPath === undefined ? undefined : entries.get(sheetPath);
    if (sheetEntry === undefined) return unreadable();

    const sharedStringsXml = await text(
      entries.get("xl/sharedStrings.xml"),
      PART_LIMITS.sharedStrings,
      "shared strings",
    );
    const stylesXml = await text(
      entries.get("xl/styles.xml"),
      PART_LIMITS.styles,
      "styles",
    );
    const sheetXml = await text(sheetEntry, PART_LIMITS.sheet, "worksheet");
    if (sheetXml === undefined) return unreadable();

    const read = await readSheetRows(
      sheetXml,
      {
        sharedStrings:
          sharedStringsXml === undefined
            ? undefined
            : new SharedStrings(sharedStringsXml),
        dateStyles: new DateStyles(stylesXml),
        date1904: workbook.date1904,
      },
      maxRows + TITLE_ROW_ALLOWANCE,
    );
    return { kind: "rows", rows: read.rows, truncated: read.truncated };
  } catch (error) {
    if (error instanceof PartError) return error.result;
    throw error;
  }
}
