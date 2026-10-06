import {
  BlockContextSchema,
  IssueSchema,
  ParsedEntrySchema,
  ParseOptionsSchema,
  ParseResultSchema,
  SummarySchema,
  TARGET_IDS,
} from "@alihdrndm/roomlist-core";
import { z } from "zod";
import { ApiError, type ProblemFieldError } from "./errors.js";

// A multipart request can only carry text, so structured parts (block, options,
// targetOptions) arrive as JSON text. The schema parses and validates them in one
// step, so a bad part is reported like any other bad field, under its own name.
function jsonPart<T extends z.ZodType>(schema: T) {
  return z
    .string()
    .transform((text, ctx): unknown => {
      try {
        return JSON.parse(text);
      } catch {
        ctx.addIssue({ code: "custom", message: "must be valid JSON" });
        return z.NEVER;
      }
    })
    .pipe(schema);
}

/** `maxRows` is the server's decision (MAX_ROWS), never the caller's. */
export const ApiParseOptionsSchema = ParseOptionsSchema.omit({ maxRows: true });
export type ApiParseOptions = z.infer<typeof ApiParseOptionsSchema>;

// The descriptions and examples below are what /docs shows for each part (openapi.ts
// builds the documented request body from these same schemas).
const blockPart = jsonPart(BlockContextSchema).meta({
  description:
    "JSON text matching #/components/schemas/BlockContext. Send as a plain text field, not a file.",
  example:
    '{"propertyCode":"HTL1","blockCode":"ACME2026","startDate":"2026-10-12","endDate":"2026-10-15","shoulderDays":1}',
});
const optionsPart = jsonPart(ApiParseOptionsSchema).meta({
  description:
    "JSON text matching #/components/schemas/ParseOptions (maxRows is set by the server). Send as a plain text field, not a file.",
  example: '{"dateOrder":"DMY"}',
});

// strictObject everywhere: an unknown part name is a mistake worth reporting.
export const ValidateBodySchema = z.strictObject({
  block: blockPart.optional(),
  options: optionsPart.optional(),
});
export type ValidateBody = z.infer<typeof ValidateBodySchema>;

export const ConvertBodySchema = ValidateBodySchema.extend({
  target: z.enum(TARGET_IDS).meta({ description: "The export target id." }),
  // The target's own schema (in core) checks the contents.
  targetOptions: jsonPart(z.unknown())
    .meta({
      description:
        "JSON text; its shape depends on the target. GET /v1/formats lists each target and its options. Send as a plain text field, not a file.",
      example: "{}",
    })
    .optional(),
});
export type ConvertBody = z.infer<typeof ConvertBodySchema>;

export const DiffBodySchema = z.strictObject({
  options: optionsPart.optional(),
});
export type DiffBody = z.infer<typeof DiffBodySchema>;

/** The 200 body of POST /v1/rooming-lists/validate. */
export const ValidateReportSchema = z.strictObject({
  ok: z.boolean(),
  format: z.enum(["csv", "xlsx"]),
  rowCount: z.int(),
  columns: ParseResultSchema.shape.columns,
  entries: z.array(ParsedEntrySchema),
  issues: z.array(IssueSchema),
  summary: SummarySchema,
});
export type ValidateReport = z.infer<typeof ValidateReportSchema>;

/** The part of a Standard Schema issue this file needs (Zod adds `code` and `keys`). */
type SchemaIssue = {
  readonly message: string;
  readonly path?:
    | readonly (PropertyKey | { readonly key: PropertyKey })[]
    | undefined;
};

/** Joins path segments with dots; a prefix (a part name) comes first, and an empty path leaves just the prefix. */
function pathText(
  prefix: string,
  path: SchemaIssue["path"],
  extra?: PropertyKey,
): string {
  const segments = [
    ...(prefix === "" ? [] : [prefix]),
    ...(path ?? []),
    ...(extra === undefined ? [] : [extra]),
  ];
  return segments
    .map((segment) =>
      String(typeof segment === "object" ? segment.key : segment),
    )
    .join(".");
}

/**
 * Turns schema issues into the VALIDATION_FAILED error. The Nest validation pipe
 * hands over Standard Schema issues; Zod's own issues carry a `code`, which is
 * kept when present.
 */
export function validationError(
  issues: readonly SchemaIssue[],
  prefix = "",
): ApiError {
  const errors: ProblemFieldError[] = issues.flatMap(
    (issue): ProblemFieldError[] => {
      const extra = issue as { code?: unknown; keys?: unknown };
      const code = typeof extra.code === "string" ? extra.code : "invalid";
      // Zod reports every unknown key in one issue; list them one by one.
      if (code === "unrecognized_keys" && Array.isArray(extra.keys)) {
        return extra.keys.map((key) => ({
          path: pathText(prefix, issue.path, String(key)),
          code,
          message: `Unknown field "${String(key)}".`,
        }));
      }
      return [
        { path: pathText(prefix, issue.path), code, message: issue.message },
      ];
    },
  );
  const count = errors.length;
  return new ApiError(
    "VALIDATION_FAILED",
    `The request has ${count} invalid field${count === 1 ? "" : "s"}.`,
    { errors },
  );
}
