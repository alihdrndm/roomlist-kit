import { makeIssue } from "../issues.js";
import {
  type CanonicalField,
  CanonicalFieldSchema,
  type Column,
  type Issue,
} from "../model.js";

// Normalised header text → canonical field (HANDOFF.md "Alias table").
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

export function isBlankRow(cells: string[]): boolean {
  return cells.every((cell) => cell.trim() === "");
}

/**
 * Index of the header row: the first non-blank row in which at least one cell maps
 * to a field, so a title row above the header is skipped. If no row maps, the first
 * non-blank row is used (and F005 follows). -1 when every row is blank.
 * See docs/DECISIONS.md, 2026-10-06.
 */
export function findHeaderRow(rows: string[][], columnMap: ColumnMap): number {
  const firstNonBlank = rows.findIndex((cells) => !isBlankRow(cells));
  if (firstNonBlank === -1) return -1;
  const firstMapping = rows.findIndex(
    (cells) =>
      !isBlankRow(cells) &&
      cells.some(
        (cell) => cell.trim() !== "" && lookupHeader(cell, columnMap) !== null,
      ),
  );
  return firstMapping === -1 ? firstNonBlank : firstMapping;
}

export type HeaderMapping = {
  columns: Column[];
  /** Field → index of its column in each row. */
  fieldIndex: Map<CanonicalField, number>;
  /** Columns whose header cell is blank; the caller warns if they hold data. */
  blankHeaderIndexes: number[];
  issues: Issue[];
};

export function mapHeaders(
  headerCells: string[],
  columnMap: ColumnMap,
  headerRowNumber: number,
): HeaderMapping {
  const columns: Column[] = [];
  const fieldIndex = new Map<CanonicalField, number>();
  const issues: Issue[] = [];
  const blankHeaderIndexes: number[] = [];

  headerCells.forEach((header, index) => {
    if (header.trim() === "") {
      blankHeaderIndexes.push(index);
      return;
    }
    const field = lookupHeader(header, columnMap);
    columns.push({ header, field });

    // A column the caller mapped to null is ignored on purpose, so no warning.
    const ignoredOnPurpose =
      columnMap !== undefined && Object.hasOwn(columnMap, header);
    if (field === null && ignoredOnPurpose) return;
    if (field === null) {
      issues.push(
        makeIssue(
          "W201",
          `Column "${header}" was not recognised and is ignored. Rename it or map it if it matters.`,
          {
            row: headerRowNumber,
            value: header,
          },
        ),
      );
      return;
    }
    const existing = fieldIndex.get(field);
    if (existing !== undefined) {
      issues.push(
        makeIssue(
          "F006",
          `Columns "${headerCells[existing]}" and "${header}" both mean ${field}. Remove or rename one of them.`,
          { row: headerRowNumber, field, value: header },
        ),
      );
      return;
    }
    fieldIndex.set(field, index);
  });

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

  return { columns, fieldIndex, blankHeaderIndexes, issues };
}
