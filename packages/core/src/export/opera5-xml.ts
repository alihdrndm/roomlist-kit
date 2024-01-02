import { create } from "xmlbuilder2";
import { z } from "zod";
import type { RoomingEntry } from "../model.js";
import { formatDate } from "./format-date.js";
import { orderForExport } from "./ordering.js";
import type { ExportInput, Provenance, Target } from "./types.js";

// ASCII subset of the XML Name production: enough for any sane element name, and it
// rules out spaces, "<" and ":" which would break the file or invent a namespace.
const XML_NAME = /^[A-Za-z_][A-Za-z0-9._-]*$/;
const xmlName = z.string().regex(XML_NAME, "must be a valid XML element name");

export const opera5OptionsSchema = z.strictObject({
  // ASSUMED A1: Oracle's template (RoomingListImport.1.0.xml) is not public, so
  // the envelope is configurable instead of hard-coded.
  rootElement: xmlName.default("RoomingListImport"),
  recordElement: xmlName.default("Reservation"),
});
export type Opera5Options = z.infer<typeof opera5OptionsSchema>;

const SOURCE =
  "https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/rooming_list_imports.htm";

export const opera5Provenance: Provenance[] = [
  {
    aspect: "File type: the import accepts only XML",
    status: "verified",
    source: SOURCE,
  },
  {
    aspect: "Field names and which fields are required",
    status: "verified",
    source: SOURCE,
  },
  {
    aspect: "Arrival and departure dates written as mm/dd/yyyy",
    status: "verified",
    source: SOURCE,
  },
  {
    aspect:
      "A1: XML envelope (root element RoomingListImport, one Reservation element per guest)",
    status: "assumed",
    source:
      "Oracle's template file ships only on OPERA application servers and is not public. Compare the output with your property's template and set rootElement / recordElement.",
  },
  {
    aspect: "A2: date_of_Birth written as MM/DD/YYYY",
    status: "assumed",
    source: "Not stated on the help page.",
  },
  {
    aspect: "A3: a sharer is written with numberRooms = 1",
    status: "assumed",
    source:
      "OPERA requires a minimum of 1 room; the help page does not say what a sharer should carry.",
  },
];

/** One XML element per field, in the order of the spec table; absent optional fields are left out. */
function fields(
  entry: RoomingEntry,
  input: ExportInput,
  sequence: number,
  primarySequence: number | undefined,
) {
  const isSharer = primarySequence !== undefined;
  const optional = (
    name: string,
    value: string | undefined,
  ): [string, string][] => (value === undefined ? [] : [[name, value]]);
  return [
    ["recordNumber", String(sequence)],
    ...optional("resortId", input.block?.propertyCode),
    ...optional("blockCode", input.block?.blockCode),
    ["guestLastName", entry.lastName],
    ...optional("guestFirstName", entry.firstName),
    ...optional("guestTitle", entry.title),
    ["arrivalDate", formatDate(entry.arrivalDate, "MM/DD/YYYY")],
    ["departureDate", formatDate(entry.departureDate, "MM/DD/YYYY")],
    ...optional("roomType", entry.roomType),
    // A3: a sharer does not use a room of its own, but OPERA wants at least 1.
    ["numberRooms", String(isSharer ? 1 : entry.rooms)],
    ["numberAdults", String(entry.adults)],
    ["numberChildren", String(entry.children)],
    ...optional(
      "shareRecordNumber",
      primarySequence === undefined ? undefined : String(primarySequence),
    ),
    ...optional("ta_Record_Locator", entry.travelAgentLocator),
    // A2: same layout as the stay dates.
    ...optional(
      "date_of_Birth",
      entry.dateOfBirth && formatDate(entry.dateOfBirth, "MM/DD/YYYY"),
    ),
    ...optional("language_Code", entry.language),
    ...optional("nationality_Code", entry.nationality),
    ...optional("passport", entry.passport),
  ] satisfies [string, string][];
}

export const opera5Xml: Target = {
  id: "opera5-xml",
  label: "Oracle OPERA 5 (XML)",
  fileExtension: "xml",
  fileName: "rooming-list-opera5.xml",
  contentType: "application/xml",
  optionsSchema: opera5OptionsSchema,
  provenance: opera5Provenance,
  preconditions: () => [],
  async build(input, rawOptions) {
    const options = opera5OptionsSchema.parse(rawOptions ?? {});
    const ordered = orderForExport(input.entries);

    const root = create({ version: "1.0", encoding: "UTF-8" }).ele(
      options.rootElement,
    );
    ordered.entries.forEach((entry, index) => {
      const record = root.ele(options.recordElement);
      const sequence = ordered.sequence[index] ?? index + 1;
      for (const [name, value] of fields(
        entry,
        input,
        sequence,
        ordered.primarySequence[index],
      )) {
        record.ele(name).txt(value);
      }
    });

    // Owner decision (DECISIONS.md, M3): one final line terminator.
    const xml = `${root.end({ prettyPrint: true, indent: "  ", newline: "\n" })}\n`;
    return { bytes: new TextEncoder().encode(xml), issues: [] };
  },
};
