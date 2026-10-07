import { makeIssue } from "../issues.js";
import {
  type CanonicalField,
  CanonicalFieldSchema,
  type Column,
  type Issue,
} from "../model.js";

// Normalised header text → canonical field (the spec's alias table).
const ALIASES: Record<CanonicalField, string[]> = {
  line: [
    "line",
    "lineno",
    "linenumber",
    "no",
    "number",
    "record",
    "recordnumber",
    "suffix",
    "suffixno",
    "rowid",
  ],
  lastName: ["lastname", "last", "surname", "familyname", "guestlastname"],
  firstName: ["firstname", "first", "givenname", "forename", "guestfirstname"],
  fullName: ["name", "fullname", "guestname", "guest"],
  title: ["title", "salutation", "prefix", "guesttitle"],
  email: ["email", "emailaddress", "mail"],
  phone: ["phone", "phonenumber", "mobile", "cell", "telephone", "tel"],
  arrivalDate: [
    "arrival",
    "arrivaldate",
    "checkin",
    "checkindate",
    "arrive",
    "datein",
  ],
  departureDate: [
    "departure",
    "departuredate",
    "checkout",
    "checkoutdate",
    "depart",
    "dateout",
  ],
  roomType: [
    "roomtype",
    "room",
    "roomcategory",
    "roomcode",
    "buildingroomtype",
  ],
  rooms: ["rooms", "numberofrooms", "numberrooms", "noofrooms", "roomcount"],
  adults: ["adults", "adult", "numberadults", "numberofadults"],
  children: ["children", "child", "numberchildren", "numberofchildren", "kids"],
  infants: ["infants", "infant", "numberofinfants"],
  sharesWithLine: [
    "shareswith",
    "sharewith",
    "sharer",
    "shareline",
    "sharerecordnumber",
    "sharersuffix",
  ],
  confirmationNumber: [
    "confirmation",
    "confirmationnumber",
    "confirmationno",
    "conf",
    "confno",
    "bookingreference",
    "reservationnumber",
  ],
  gender: ["gender", "sex"],
  dateOfBirth: ["dateofbirth", "dob", "birthdate"],
  nationality: ["nationality", "nationalitycode"],
  language: ["language", "languagecode"],
  passport: ["passport", "passportnumber", "passportno"],
  specialRequests: [
    "specialrequests",
    "requests",
    "notes",
    "comments",
    "remarks",
  ],
  travelAgentLocator: ["tarecordlocator", "recordlocator", "talocator"],
};

const ALIAS_LOOKUP = new Map<string, CanonicalField>();
for (const field of CanonicalFieldSchema.options) {
  // Each canonical name is also accepted as written ("sharesWithLine"), so the
  // canonical-csv export can be read back in. See docs/DECISIONS.md, 2026-10-06.
  ALIAS_LOOKUP.set(normaliseHeader(field), field);
  for (const alias of ALIASES[field]) ALIAS_LOOKUP.set(alias, field);
}

/** Lower-case and drop everything that is not a–z or 0–9: "Check-In" → "checkin", "# Adults" → "adults". */
export function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type ColumnMap = Record<string, CanonicalField | null> | undefined;

/** The canonical field for one header, or null. The caller's columnMap wins over the alias table. */
export function lookupHeader(
  header: string,
  columnMap: ColumnMap,
): CanonicalField | null {
  if (columnMap !== undefined && Object.hasOwn(columnMap, header)) {
    return columnMap[header] ?? null;
  }
  return ALIAS_LOOKUP.get(normaliseHeader(header)) ?? null;
}

/** A row with no cells at all (an Excel row that was never used) counts as blank too. */
export function isBlankRow(cells: readonly string[] | undefined): boolean {
  // every() skips the holes of a sparse row, which is exactly what is wanted.
  return cells === undefined || cells.every((cell) => cell.trim() === "");
}

/**
 * Index of the header row: the first non-blank row in which at least one cell maps
 * to a field, so a title row above the header is skipped. If no row maps, the first
 * non-blank row is used (and F005 follows). -1 when every row is blank.
 * See docs/DECISIONS.md, 2026-10-06.
 */
export function findHeaderRow(
  rows: readonly (readonly string[] | undefined)[],
  columnMap: ColumnMap,
): number {
  const firstNonBlank = rows.findIndex((cells) => !isBlankRow(cells));
  if (firstNonBlank === -1) return -1;
  const firstMapping = rows.findIndex(
    (cells) =>
      cells !== undefined &&
      !isBlankRow(cells) &&
      cells.some(
        (cell) => cell.trim() !== "" && lookupHeader(cell, columnMap) !== null,
      ),
  );
  return firstMapping === -1 ? firstNonBlank : firstMapping;
}

/** Most unrecognised or headerless columns that are reported one by one. */
export const MAX_COLUMN_WARNINGS = 50;

/**
 * Collects the W201 warnings for columns that are ignored. The first
 * MAX_COLUMN_WARNINGS get a warning each, as the spec says; after that one extra
 * warning counts the rest. Without a limit, a single very wide row would produce
 * millions of warnings (docs/DECISIONS.md, M6 review).
 */
export class ColumnWarnings {
  private readonly issues: Issue[] = [];
  private skipped = 0;

  /** Records a warning; returns false when it was only counted. `make` runs only when it is kept. */
  add(make: () => Issue): boolean {
    if (this.issues.length < MAX_COLUMN_WARNINGS) {
      this.issues.push(make());
      return true;
    }
    this.skipped++;
    return false;
  }

  /** The kept warnings, plus one summary warning when some were only counted. */
  finish(headerRowNumber: number): Issue[] {
    if (this.skipped === 0) return this.issues;
    return [
      ...this.issues,
      makeIssue(
        "W201",
        `${this.skipped} more column${this.skipped === 1 ? " is" : "s are"} ignored (not recognised, or without a header).`,
        { row: headerRowNumber },
      ),
    ];
  }
}

export type HeaderMapping = {
  columns: Column[];
  /** Field → index of its column in each row. */
  fieldIndex: Map<CanonicalField, number>;
  /** Columns whose header cell is blank; the caller warns if they hold data. */
  blankHeaderIndexes: number[];
  /** File-level errors (F005, F006) only. */
  issues: Issue[];
  /** W201 warnings for ignored columns; the caller adds more and then calls finish(). */
  warnings: ColumnWarnings;
};

export function mapHeaders(
  headerCells: string[],
  columnMap: ColumnMap,
  headerRowNumber: number,
  warnings: ColumnWarnings = new ColumnWarnings(),
): HeaderMapping {
  const columns: Column[] = [];
  const fieldIndex = new Map<CanonicalField, number>();
  const issues: Issue[] = [];
  const blankHeaderIndexes: number[] = [];

  // A for loop, not forEach: a header row from Excel is sparse (cells never written are
  // holes), and a hole is a blank header just like an empty cell, so it must be visited.
  for (let index = 0; index < headerCells.length; index++) {
    const header = headerCells[index] ?? "";
    if (header.trim() === "") {
      blankHeaderIndexes.push(index);
      continue;
    }
    const field = lookupHeader(header, columnMap);

    // A column the caller mapped to null is ignored on purpose, so no warning.
    const ignoredOnPurpose =
      columnMap !== undefined && Object.hasOwn(columnMap, header);
    if (field === null && !ignoredOnPurpose) {
      const reported = warnings.add(() =>
        makeIssue(
          "W201",
          `Column "${header}" was not recognised and is ignored. Rename it or map it if it matters.`,
          { row: headerRowNumber, value: header },
        ),
      );
      // Past the limit the column is only counted, so the column list stays small too.
      if (reported) columns.push({ header, field });
      continue;
    }
    columns.push({ header, field });
    if (field === null) continue;
    const existing = fieldIndex.get(field);
    if (existing !== undefined) {
      issues.push(
        makeIssue(
          "F006",
          `Columns "${headerCells[existing]}" and "${header}" both mean ${field}. Remove or rename one of them.`,
          { row: headerRowNumber, field, value: header },
        ),
      );
      continue;
    }
    fieldIndex.set(field, index);
  }

  const hasName = fieldIndex.has("lastName") || fieldIndex.has("fullName");
  const missing: string[] = [];
  if (!hasName) missing.push("lastName");
  if (!fieldIndex.has("arrivalDate")) missing.push("arrivalDate");
  if (!fieldIndex.has("departureDate")) missing.push("departureDate");
  for (const field of missing) {
    issues.push(
      makeIssue(
        "F005",
        `Required column ${field} is missing. Add a column for it to the header row.`,
        {
          row: headerRowNumber,
          field,
        },
      ),
    );
  }

  return { columns, fieldIndex, blankHeaderIndexes, issues, warnings };
}
