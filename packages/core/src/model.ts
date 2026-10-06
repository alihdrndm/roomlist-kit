import { z } from "zod";
import { compareDates, type IsoDate, parseIsoDate } from "./plain-date.js";

// Every data shape in the project is defined here once; TypeScript types are
// inferred from these schemas so the runtime check and the type can't drift apart.

export const IsoDateSchema = z.iso
  .date()
  .refine(
    (value) => parseIsoDate(value) !== undefined,
    "must be a real calendar date",
  )
  .transform((value) => value as IsoDate);

const positiveInt = z.int().min(1);
const nonNegativeInt = z.int().min(0);

export const BlockContextSchema = z
  .strictObject({
    propertyCode: z.string().min(1).max(20).optional(),
    blockCode: z.string().min(1).max(40).optional(),
    groupReservationNumber: z.string().min(1).max(20).optional(),
    startDate: IsoDateSchema.optional(),
    endDate: IsoDateSchema.optional(),
    shoulderDays: z.int().min(0).max(7).default(0),
    roomTypes: z.array(z.string().min(1).max(20)).optional(),
    maxOccupancy: z
      .record(z.string().min(1).max(20), z.int().min(1).max(10))
      .optional(),
  })
  .superRefine((block, ctx) => {
    if (block.endDate === undefined) return;
    if (block.startDate === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "startDate is required when endDate is given",
      });
    } else if (compareDates(block.endDate, block.startDate) <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "endDate must be after startDate",
      });
    }
  });
export type BlockContext = z.infer<typeof BlockContextSchema>;

export const GenderSchema = z.enum(["M", "F", "X", "U"]);
export type Gender = z.infer<typeof GenderSchema>;

// Key order matches the "Canonical model" table; canonical-json and canonical-csv rely on it.
export const RoomingEntrySchema = z.strictObject({
  line: positiveInt,
  lastName: z.string().min(1).max(80),
  firstName: z.string().max(80).optional(),
  title: z.string().max(20).optional(),
  email: z.string().optional(),
  phone: z.string().max(30).optional(),
  arrivalDate: IsoDateSchema,
  departureDate: IsoDateSchema,
  roomType: z.string().max(20).optional(),
  rooms: positiveInt,
  adults: nonNegativeInt,
  children: nonNegativeInt,
  infants: nonNegativeInt,
  sharesWithLine: positiveInt.optional(),
  confirmationNumber: z.string().max(40).optional(),
  gender: GenderSchema.optional(),
  dateOfBirth: IsoDateSchema.optional(),
  nationality: z.string().max(3).optional(),
  language: z.string().max(5).optional(),
  passport: z.string().max(20).optional(),
  specialRequests: z.string().max(500).optional(),
  travelAgentLocator: z.string().max(40).optional(),
});
export type RoomingEntry = z.infer<typeof RoomingEntrySchema>;

// What the parser produces. A cell that can't be converted leaves its field unset
// (and raises an issue), so the three required fields may be missing until
// validation has passed. See docs/DECISIONS.md, 2026-10-06.
export const ParsedEntrySchema = RoomingEntrySchema.partial({
  lastName: true,
  arrivalDate: true,
  departureDate: true,
});
export type ParsedEntry = z.infer<typeof ParsedEntrySchema>;

export const RoomingListSchema = z.strictObject({
  block: BlockContextSchema.optional(),
  entries: z.array(ParsedEntrySchema),
});
export type RoomingList = z.infer<typeof RoomingListSchema>;

export const ENTRY_FIELDS = RoomingEntrySchema.keyof().options;
export type EntryField = (typeof ENTRY_FIELDS)[number];

/** Fields a column can map to: every entry field, plus `fullName`, which the parser splits. */
export const CanonicalFieldSchema = z.enum([...ENTRY_FIELDS, "fullName"]);
export type CanonicalField = z.infer<typeof CanonicalFieldSchema>;

export const SeveritySchema = z.enum(["error", "warning"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const IssueSchema = z.strictObject({
  severity: SeveritySchema,
  ruleId: z.string(),
  code: z.string(),
  message: z.string(),
  line: z.int().optional(),
  row: z.int().optional(),
  field: z.string().optional(),
  value: z.string().optional(),
});
export type Issue = z.infer<typeof IssueSchema>;

export const DateOrderSchema = z.enum(["MDY", "DMY"]);
export type DateOrder = z.infer<typeof DateOrderSchema>;

export const ParseOptionsSchema = z.strictObject({
  dateOrder: DateOrderSchema.optional(),
  sheetName: z.string().min(1).optional(),
  columnMap: z.record(z.string(), CanonicalFieldSchema.nullable()).optional(),
  maxRows: positiveInt.optional(),
});
export type ParseOptions = z.infer<typeof ParseOptionsSchema>;

export const ColumnSchema = z.strictObject({
  header: z.string(),
  field: CanonicalFieldSchema.nullable(),
});
export type Column = z.infer<typeof ColumnSchema>;

export const ParseResultSchema = z.strictObject({
  format: z.enum(["csv", "xlsx"]),
  entries: z.array(ParsedEntrySchema),
  issues: z.array(IssueSchema),
  columns: z.array(ColumnSchema),
  rowCount: z.int(),
  /** Source row of entries[i]; lets the validator name rows. See docs/DECISIONS.md, M2. */
  entryRows: z.array(z.int()),
});
export type ParseResult = z.infer<typeof ParseResultSchema>;
