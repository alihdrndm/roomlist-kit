import {
  BlockContextSchema,
  DiffReportSchema,
  IssueSchema,
  listTargets,
  TargetsResponseSchema,
  ValidateReportSchema,
} from "@alihdrndm/roomlist-core";
import type {
  ApiBodyOptions,
  ApiResponseOptions,
  OpenAPIObject,
  SchemaObject,
} from "@nestjs/swagger";
import { z } from "zod";
import { ERROR_CODES, type ErrorCode } from "./errors.js";
import {
  ApiParseOptionsSchema,
  ConvertBodySchema,
  DiffBodySchema,
  ValidateBodySchema,
} from "./schemas.js";

// Schemas that exist only in the HTTP layer. They are built from core's schemas,
// so the OpenAPI document cannot drift from what the code returns.

const ERROR_CODE_NAMES = Object.keys(ERROR_CODES) as [
  ErrorCode,
  ...ErrorCode[],
];

/** The RFC 9457 body the global filter writes for every non-2xx response. */
export const ProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.int(),
  detail: z.string(),
  code: z.enum(ERROR_CODE_NAMES),
  /** The request id. */
  instance: z.string(),
  /** On VALIDATION_FAILED: one entry per invalid field. */
  errors: z
    .array(
      z.strictObject({
        path: z.string(),
        code: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
  /** On LIST_INVALID and EXPORT_PRECONDITION_FAILED; `side` appears only for /diff. */
  issues: z
    .array(IssueSchema.extend({ side: z.enum(["before", "after"]).optional() }))
    .optional(),
});

/**
 * Zod schema to an OpenAPI 3.0 schema object. The input side is used because the
 * output side of a transform cannot be described; on the wire the two are the same.
 */
export function jsonSchemaOf(schema: z.ZodType): SchemaObject {
  const json = z.toJSONSchema(schema, {
    target: "openapi-3.0",
    io: "input",
    unrepresentable: "any",
  });
  // Swagger UI reads the schema object as is; the dialect marker is not part of OpenAPI 3.0.
  return Object.fromEntries(
    Object.entries(json).filter(([key]) => key !== "$schema"),
  ) as SchemaObject;
}

/** The 200 body of the liveness and readiness probes. */
export const HealthSchema = z.strictObject({ status: z.literal("ok") });

/** Schemas registered under #/components/schemas, referenced by name everywhere else. */
const COMPONENTS = {
  BlockContext: BlockContextSchema,
  ParseOptions: ApiParseOptionsSchema,
  Problem: ProblemSchema,
  ValidateReport: ValidateReportSchema,
  DiffReport: DiffReportSchema,
  TargetsResponse: TargetsResponseSchema,
  Health: HealthSchema,
};

export type ComponentName = keyof typeof COMPONENTS;

export const componentRef = (name: ComponentName) => ({
  $ref: `#/components/schemas/${name}`,
});

/** Called once, after SwaggerModule.createDocument. */
export function registerComponents(document: OpenAPIObject): void {
  const components = document.components ?? {};
  const schemas = components.schemas ?? {};
  for (const [name, schema] of Object.entries(COMPONENTS))
    schemas[name] = jsonSchemaOf(schema);
  document.components = { ...components, schemas };
}

const PROBLEM_JSON = "application/problem+json";

/** An error response whose body is the shared Problem schema. */
export function problemResponse(
  status: number,
  description: string,
): ApiResponseOptions {
  return {
    status,
    description,
    content: { [PROBLEM_JSON]: { schema: componentRef("Problem") } },
  };
}

export function jsonResponse(
  description: string,
  name: ComponentName,
): ApiResponseOptions {
  return {
    status: 200,
    description,
    content: { "application/json": { schema: componentRef(name) } },
  };
}

// The multipart envelopes. Nest's own request-body schema (from the Standard Schema
// on @Body) would hide the file parts, so these are passed as the body's
// standardSchema. They are the real body schemas from schemas.ts plus the file
// parts, so a part added there shows up here automatically.
/**
 * @nestjs/swagger 12 reads `standardSchema` on a body parameter at runtime (it is how
 * @Body({ schema }) is documented) but its ApiBody typings do not list it yet, hence the
 * assertion. Without it Nest documents the Standard Schema on @Body and the file parts vanish.
 */
function multipartBody(schema: z.ZodType): ApiBodyOptions {
  return { standardSchema: schema } as ApiBodyOptions;
}

const filePart = (description: string) =>
  z.string().meta({ format: "binary", description });

export const validateBody = multipartBody(
  ValidateBodySchema.extend({
    file: filePart("The rooming list, CSV or XLSX."),
  }),
);

export const convertBody = multipartBody(
  ConvertBodySchema.extend({
    file: filePart("The rooming list, CSV or XLSX."),
  }),
);

export const diffBody = multipartBody(
  DiffBodySchema.extend({
    before: filePart("The earlier rooming list, CSV or XLSX."),
    after: filePart("The later rooming list, CSV or XLSX."),
  }),
);

const BINARY = { schema: { type: "string", format: "binary" } } as const;

/** The 200 response of convert: the export file itself, in the media type of whichever target was chosen. */
export const convertFileResponse: ApiResponseOptions = {
  status: 200,
  description: "The export file, ready to import into the PMS.",
  headers: {
    "Content-Disposition": {
      description: 'attachment; filename="<fileName>"',
      schema: { type: "string" },
    },
    "x-roomlist-warnings": {
      description:
        "Number of warnings (validation and export) the list produced.",
      schema: { type: "integer" },
    },
  },
  // One entry per distinct media type the targets declare (read from the registry, so
  // the document always matches what the API really sends, charset included).
  content: Object.fromEntries(
    [...new Set(listTargets().map((target) => target.contentType))].map(
      (type) => [type, BINARY],
    ),
  ),
};

export const unauthorized = problemResponse(
  401,
  "UNAUTHORIZED: the x-api-key header is missing or wrong (only when API_KEY is configured).",
);
export const rateLimited = problemResponse(
  429,
  "RATE_LIMITED: more than 120 requests per minute from this IP.",
);
export const internalError = problemResponse(
  500,
  "INTERNAL: unexpected error. Quote the `instance` request id.",
);
export const fileTooLarge = problemResponse(
  413,
  "FILE_TOO_LARGE: a file is larger than MAX_UPLOAD_BYTES.",
);
export const fileRequired = problemResponse(
  400,
  "FILE_REQUIRED: a required file part is missing.",
);
