import { stringify } from "csv-stringify/sync";
import { z } from "zod";
import { makeIssue } from "../issues.js";
import type { Issue } from "../model.js";
import { orderForExport } from "./ordering.js";
import type { Provenance, Target } from "./types.js";

export const maestroOptionsSchema = z.strictObject({
  buildingCode: z.string().min(1).max(10).optional(),
  includeHeader: z.boolean().default(false),
});
export type MaestroOptions = z.infer<typeof maestroOptionsSchema>;

// Order of the guide's field list (ASSUMED A7).
const COLUMNS = [
  "Suffix No.",
  "Group Res.",
  "First Name",
  "Last Name",
  "Sharer_Suffix",
  "Building/Room Type",
  "Arrival Date",
  "Departure Date",
  "#Adults",
  "#Children",
  "#Infants",
  "Gender",
] as const;

const SOURCE =
  "http://www.elearning.maestropms.com/Courses/Courses/05a_Group_Management/Group%20Rooming%20List%20Import/Group%20Rooming%20List%20Import%20QRG.pdf";

export const maestroProvenance: Provenance[] = [
  {
    aspect: "File type: comma-separated, one row per guest",
    status: "verified",
    source: SOURCE,
  },
  {
    aspect: "Field list and dates as YYYY-MM-DD",
    status: "verified",
    source: SOURCE,
  },
  {
    aspect: "Room code written as BUILDING/ROOMTYPE",
    status: "verified",
    source: SOURCE,
  },
  {
    aspect: "Children must be 0 when there are none",
    status: "verified",
    source: SOURCE,
  },
  {
    aspect: "Gender codes m, f, c (mixed), u (unknown)",
    status: "verified",
    source: SOURCE,
  },
  {
    aspect:
      "A sharer row carries the suffix number of the row it shares with, and that number is the lower of the two",
    status: "verified",
    source: SOURCE,
  },
  {
    aspect: "Lines consisting only of commas make the import fail",
    status: "verified",
    source: SOURCE,
  },
  {
    aspect: "A7: column order, and no header row by default",
    status: "assumed",
    source:
      "Order taken from the order the guide lists the fields; the guide does not show a sample file.",
  },
  {
    aspect: "A8: gender code c (mixed) is never written",
    status: "assumed",
    source:
      "A single guest has no mixed gender; unknown values are written as u.",
  },
];

function genderCode(gender: string | undefined): string {
  if (gender === "M") return "m";
  if (gender === "F") return "f";
  return "u";
}

export const maestroCsv: Target = {
  id: "maestro-csv",
  label: "Maestro PMS (CSV)",
  fileExtension: "csv",
  fileName: "rooming-list-maestro.csv",
  contentType: "text/csv; charset=utf-8",
  optionsSchema: maestroOptionsSchema,
  provenance: maestroProvenance,

  preconditions(input, rawOptions) {
    const options = maestroOptionsSchema.parse(rawOptions ?? {});
    const issues: Issue[] = [];
    if (input.block?.groupReservationNumber === undefined) {
      issues.push(
        makeIssue(
          "X001",
          "Maestro needs block.groupReservationNumber (the Group Res. number). Add it to the block details.",
          { field: "groupReservationNumber" },
        ),
      );
    }
    for (const entry of input.entries) {
      if (entry.firstName === undefined || entry.firstName === "") {
        issues.push(
          makeIssue(
            "X001",
            `Line ${entry.line}: Maestro needs a first name. Add one.`,
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
            `Line ${entry.line}: Maestro needs a room type. Add one.`,
            {
              line: entry.line,
              field: "roomType",
            },
          ),
        );
      }
    }
    const needsBuilding = input.entries.some(
      (entry) => entry.roomType !== undefined && !entry.roomType.includes("/"),
    );
    if (needsBuilding && options.buildingCode === undefined) {
      issues.push(
        makeIssue(
          "X001",
          "Some room types have no BUILDING/ prefix, so the buildingCode option is required.",
          {
            field: "buildingCode",
          },
        ),
      );
    }
    return issues;
  },

  async build(input, rawOptions) {
    const options = maestroOptionsSchema.parse(rawOptions ?? {});
    const ordered = orderForExport(input.entries);

    const rows: (string | number)[][] = ordered.entries.map((entry, index) => {
      const roomType = entry.roomType ?? "";
      return [
        ordered.sequence[index] ?? index + 1,
        input.block?.groupReservationNumber ?? "",
        entry.firstName ?? "",
        entry.lastName,
        ordered.primarySequence[index] ?? "",
        // A room type that already has a building prefix is used as it is.
        roomType.includes("/")
          ? roomType
          : `${options.buildingCode ?? ""}/${roomType}`,
        entry.arrivalDate,
        entry.departureDate,
        entry.adults,
        entry.children,
        entry.infants,
        genderCode(entry.gender),
      ];
    });
    if (options.includeHeader) rows.unshift([...COLUMNS]);

    // csv-stringify ends every record with the delimiter, which is the owner's
    // "one final line terminator" rule for Maestro (\r\n).
    // quoted_match: csv-stringify only quotes a value containing the whole "\r\n"
    // delimiter, so a lone \n or \r would split one record into two lines.
    const text = stringify(rows, {
      record_delimiter: "\r\n",
      quoted_match: /[\r\n]/,
    });
    return { bytes: new TextEncoder().encode(text), issues: [] };
  },
};
