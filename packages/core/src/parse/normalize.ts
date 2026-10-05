import { makeIssue, type RuleId } from "../issues.js";
import {
  type CanonicalField,
  type DateOrder,
  ENTRY_FIELDS,
  type Gender,
  type Issue,
  type ParsedEntry,
} from "../model.js";
import type { IsoDate } from "../plain-date.js";
import { type DateOrderEvidence, parseDateText } from "./dates.js";

export type RowContext = {
  /** 1-based row number in the source file, used in every issue message. */
  row: number;
  /** 1-based position among data rows; the default `line` when there is no line column. */
  entryNumber: number;
  fieldIndex: Map<CanonicalField, number>;
  dateOrder: DateOrder;
  /** True when the file has a fullName column and no lastName column. */
  useFullName: boolean;
  evidence: DateOrderEvidence;
};

const GENDERS: Record<string, Gender> = {
  m: "M",
  male: "M",
  f: "F",
  female: "F",
  x: "X",
  other: "X",
  nonbinary: "X",
  "non-binary": "X",
  u: "U",
  unknown: "U",
};

/** Trims and collapses inner whitespace; letter case is kept ("McDonald" stays "McDonald"). */
export function cleanName(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/** "Okafor, Ada" → Okafor / Ada; "Ada Okafor" → Okafor / Ada (last word is the last name). */
export function splitFullName(text: string): {
  lastName: string;
  firstName: string;
} {
  const comma = text.indexOf(",");
  if (comma !== -1) {
    return {
      lastName: cleanName(text.slice(0, comma)),
      firstName: cleanName(text.slice(comma + 1)),
    };
  }
  const words = cleanName(text).split(" ");
  const lastName = words.pop() ?? "";
  return { lastName, firstName: words.join(" ") };
}

/** Converts one data row into an entry. Bad cells raise an issue and leave the field unset. */
export function normalizeRow(
  cells: string[],
  ctx: RowContext,
): { entry: ParsedEntry; issues: Issue[] } {
  const issues: Issue[] = [];
  const cell = (field: CanonicalField): string => {
    const index = ctx.fieldIndex.get(field);
    return index === undefined ? "" : (cells[index] ?? "").trim();
  };
  const report = (
    ruleId: RuleId,
    field: CanonicalField,
    message: string,
    value: string,
  ) => {
    issues.push(
      makeIssue(ruleId, `Row ${ctx.row}: ${message}`, {
        row: ctx.row,
        field,
        ...(value === "" ? {} : { value }),
      }),
    );
  };

  // A count cell: blank → undefined (the caller applies the default), invalid → issue + undefined.
  const count = (
    field: CanonicalField,
    min: number,
    ruleId: RuleId,
  ): number | undefined | "invalid" => {
    const text = cell(field);
    if (text === "") return undefined;
    // isSafeInteger rejects "99999999999999999999", which would lose precision.
    const value = Number(text);
    if (/^\d+$/.test(text) && Number.isSafeInteger(value) && value >= min)
      return value;
    report(
      ruleId,
      field,
      `${field} "${text}" must be a whole number of at least ${min}.`,
      text,
    );
    return "invalid";
  };

  const date = (
    field: "arrivalDate" | "departureDate" | "dateOfBirth",
    required: boolean,
  ): IsoDate | undefined => {
    const text = cell(field);
    if (text === "") {
      if (required)
        report(
          "R002",
          field,
          `${field} is empty. Enter a date such as 2026-11-10.`,
          text,
        );
      return undefined;
    }
    const parsed = parseDateText(text, ctx.dateOrder);
    ctx.evidence.record(parsed);
    if (parsed.ok) return parsed.date;
    report(
      "R002",
      field,
      `${field} "${text}" is not a valid date. Use YYYY-MM-DD, a 4-digit year, or check the date order (${ctx.dateOrder}).`,
      text,
    );
    return undefined;
  };

  // Sets an optional text field: blank → omitted (never ""), too long → R015 and omitted.
  const setText = (field: TextField, value: string): void => {
    if (value === "") return;
    const limit = MAX_LENGTH[field];
    if (limit !== undefined && value.length > limit) {
      report(
        "R015",
        field,
        `${field} is ${value.length} characters long; the limit is ${limit}. Shorten it.`,
        value,
      );
      return;
    }
    entry[field] = value;
  };

  // Line numbers. An invalid line still gets the file-order number so sharers can be
  // reported against something; the R014 error blocks conversion anyway.
  const lineValue = count("line", 1, "R014");
  const line = typeof lineValue === "number" ? lineValue : ctx.entryNumber;

  const entry: ParsedEntry = {
    line,
    rooms: 1,
    adults: 1,
    children: 0,
    infants: 0,
  };

  if (ctx.useFullName) {
    const full = cell("fullName");
    if (full !== "") {
      const { lastName, firstName } = splitFullName(full);
      setText("lastName", lastName);
      // An explicit first-name cell wins; the split part is used (and checked) only without one.
      if (cleanName(cell("firstName")) === "") setText("firstName", firstName);
    }
  } else {
    setText("lastName", cleanName(cell("lastName")));
  }
  setText("firstName", cleanName(cell("firstName")));

  setText("title", cell("title"));
  setText("email", cell("email").toLowerCase());
  setText("phone", cell("phone"));

  const arrival = date("arrivalDate", true);
  if (arrival !== undefined) entry.arrivalDate = arrival;
  const departure = date("departureDate", true);
  if (departure !== undefined) entry.departureDate = departure;

  setText("roomType", cell("roomType").toUpperCase());

  const rooms = count("rooms", 1, "R006");
  if (typeof rooms === "number") entry.rooms = rooms;

  const adults = count("adults", 0, "R007");
  const children = count("children", 0, "R007");
  const infants = count("infants", 0, "R007");
  // Spec default: adults is 1 only when both adults and children are blank, else 0.
  // An invalid cell counts as blank here so the error is not reported twice.
  const adultsBlank = adults === undefined || adults === "invalid";
  const childrenBlank = children === undefined || children === "invalid";
  entry.adults =
    typeof adults === "number" ? adults : adultsBlank && childrenBlank ? 1 : 0;
  entry.children = typeof children === "number" ? children : 0;
  entry.infants = typeof infants === "number" ? infants : 0;

  const sharesWith = count("sharesWithLine", 1, "R014");
  if (typeof sharesWith === "number") entry.sharesWithLine = sharesWith;

  setText("confirmationNumber", cell("confirmationNumber"));

  const genderText = cell("gender");
  if (genderText !== "") {
    const gender = GENDERS[genderText.toLowerCase()];
    if (gender !== undefined) {
      entry.gender = gender;
    } else {
      report(
        "W208",
        "gender",
        `gender "${genderText}" is not recognised and was dropped. Use M, F, X or U.`,
        genderText,
      );
    }
  }

  const dob = date("dateOfBirth", false);
  if (dob !== undefined) entry.dateOfBirth = dob;

  setText("nationality", cell("nationality").toUpperCase());
  setText("language", cell("language").toUpperCase());
  setText("passport", cell("passport"));
  setText("specialRequests", cell("specialRequests"));
  setText("travelAgentLocator", cell("travelAgentLocator"));

  return { entry: orderKeys(entry), issues };
}

type TextField =
  | "lastName"
  | "firstName"
  | "title"
  | "email"
  | "phone"
  | "roomType"
  | "confirmationNumber"
  | "nationality"
  | "language"
  | "passport"
  | "specialRequests"
  | "travelAgentLocator";

// Limits from the "Canonical model" table; email has no limit there.
const MAX_LENGTH: Partial<Record<TextField, number>> = {
  lastName: 80,
  firstName: 80,
  title: 20,
  phone: 30,
  roomType: 20,
  confirmationNumber: 40,
  nationality: 3,
  language: 5,
  passport: 20,
  specialRequests: 500,
  travelAgentLocator: 40,
};

/** Rebuilds the entry with keys in "Canonical model" table order, so JSON output is stable. */
function orderKeys(entry: ParsedEntry): ParsedEntry {
  const ordered: Record<string, unknown> = {};
  for (const key of ENTRY_FIELDS) {
    if (entry[key] !== undefined) ordered[key] = entry[key];
  }
  return ordered as ParsedEntry;
}
