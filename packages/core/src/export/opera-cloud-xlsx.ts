import ExcelJS from "exceljs";
import { z } from "zod";
import { makeIssue } from "../issues.js";
import type { Issue } from "../model.js";
import { DATE_FORMATS, formatDate } from "./format-date.js";
import { orderForExport } from "./ordering.js";
import type { Provenance, Target } from "./types.js";

export const operaCloudOptionsSchema = z.strictObject({
  // ASSUMED A5: dates are text in a configurable layout.
  dateFormat: z.enum(DATE_FORMATS).default("MM/DD/YYYY"),
  // ASSUMED A6: "EMAIL" is property configuration in OPERA Cloud.
  emailType: z.string().min(1).default("EMAIL"),
});
export type OperaCloudOptions = z.infer<typeof operaCloudOptionsSchema>;

// ASSUMED A4: exact heading labels (OPERA Cloud lets the user map any heading by hand).
export const OPERA_CLOUD_HEADINGS = [
  "Line",
  "Sharer",
  "Last Name",
  "First Name",
  "Title",
  "Arrival",
  "Departure",
  "Room Type",
  "Rooms",
  "Adults",
  "Children",
  "Email",
  "Email Type",
  "Phone",
  "Nationality",
  "Language",
  "Date of Birth",
  "Notes",
] as const;

/** Oracle recommends at most this many records per file. */
export const OPERA_CLOUD_RECOMMENDED_LIMIT = 1000;

const SOURCE =
  "https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.2/ocsuh/t_creating_block_reservations_using_rooming_list_import.htm";

export const operaCloudProvenance: Provenance[] = [
  { aspect: "File type: .xlsx", status: "verified", source: SOURCE },
  {
    aspect: "Column headings start at cell A1",
    status: "verified",
    source: SOURCE,
  },
  {
    aspect:
      "Line and Sharer columns; a sharer row holds the primary's line number in Sharer",
    status: "verified",
    source: SOURCE,
  },
  {
    aspect:
      "Mandatory columns: Last Name, First Name, Room Type (and Email Type when an email is given)",
    status: "verified",
    source: SOURCE,
  },
  {
    aspect: "At most 1,000 records per file is recommended",
    status: "verified",
    source: SOURCE,
  },
  {
    aspect: "Room numbers cannot be imported",
    status: "verified",
    source: SOURCE,
  },
  {
    aspect:
      "The user maps columns by hand in OPERA Cloud when a heading is not recognised",
    status: "verified",
    source: SOURCE,
  },
  {
    aspect: "A4: the exact heading labels",
    status: "assumed",
    source:
      "OPERA Cloud lets the user map any heading to a field by hand, so a different label is not fatal.",
  },
  {
    aspect: "A5: dates written as text, default layout MM/DD/YYYY",
    status: "assumed",
    source:
      "The guide does not state the date format. Change it with the dateFormat option.",
  },
  {
    aspect: "A6: email type code EMAIL",
    status: "assumed",
    source:
      "Email type codes are property configuration. Change it with the emailType option.",
  },
];

export const operaCloudXlsx: Target = {
  id: "opera-cloud-xlsx",
  label: "Oracle OPERA Cloud (Excel)",
  fileExtension: "xlsx",
  fileName: "rooming-list-opera-cloud.xlsx",
  contentType:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  optionsSchema: operaCloudOptionsSchema,
  provenance: operaCloudProvenance,

  preconditions(input) {
    const issues: Issue[] = [];
    for (const entry of input.entries) {
      if (entry.firstName === undefined || entry.firstName === "") {
        issues.push(
          makeIssue(
            "X001",
            `Line ${entry.line}: OPERA Cloud needs a first name. Add one.`,
            {
              line: entry.line,
              field: "firstName",
            },
          ),
        );
      }
      if (entry.roomType === undefined || entry.roomType === "") {
        issues.push(
          makeIssue(
            "X001",
            `Line ${entry.line}: OPERA Cloud needs a room type. Add one.`,
            {
              line: entry.line,
              field: "roomType",
            },
          ),
        );
      }
    }
    return issues;
  },

  async build(input, rawOptions) {
    const options = operaCloudOptionsSchema.parse(rawOptions ?? {});
    const ordered = orderForExport(input.entries);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Rooming List");
    sheet.addRow([...OPERA_CLOUD_HEADINGS]);

    ordered.entries.forEach((entry, index) => {
      const primarySequence = ordered.primarySequence[index];
      sheet.addRow([
        String(ordered.sequence[index] ?? index + 1),
        primarySequence === undefined ? "" : String(primarySequence),
        entry.lastName,
        entry.firstName ?? "",
        entry.title ?? "",
        formatDate(entry.arrivalDate, options.dateFormat),
        formatDate(entry.departureDate, options.dateFormat),
        entry.roomType ?? "",
        String(entry.rooms),
        String(entry.adults),
        String(entry.children),
        entry.email ?? "",
        entry.email === undefined ? "" : options.emailType,
        entry.phone ?? "",
        entry.nationality ?? "",
        entry.language ?? "",
        entry.dateOfBirth === undefined
          ? ""
          : formatDate(entry.dateOfBirth, options.dateFormat),
        entry.specialRequests ?? "",
      ]);
    });
    // "All cells are written as text": "@" is Excel's Text format, so 007 stays 007 and 11/10/2026 stays a string.
    sheet.eachRow((row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.numFmt = "@";
      });
    });

    const issues: Issue[] = [];
    if (input.entries.length > OPERA_CLOUD_RECOMMENDED_LIMIT) {
      issues.push(
        makeIssue(
          "X101",
          `The file has ${input.entries.length} guests; Oracle recommends at most ${OPERA_CLOUD_RECOMMENDED_LIMIT} per file. Consider splitting it.`,
        ),
      );
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return { bytes: new Uint8Array(buffer), issues };
  },
};
