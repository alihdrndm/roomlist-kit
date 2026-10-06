/**
 * Every error `code` the API can return, with its HTTP status and a short title.
 * docs/ERRORS.md documents each one; a test checks the two stay in step.
 */
export const ERROR_CODES = {
  VALIDATION_FAILED: { status: 422, title: "Validation failed" },
  FILE_REQUIRED: { status: 400, title: "File required" },
  FILE_TOO_LARGE: { status: 413, title: "File too large" },
  LIST_INVALID: { status: 422, title: "Rooming list has errors" },
  EXPORT_PRECONDITION_FAILED: {
    status: 422,
    title: "Export requirements not met",
  },
  UNAUTHORIZED: { status: 401, title: "Unauthorized" },
  NOT_FOUND: { status: 404, title: "Not found" },
  RATE_LIMITED: { status: 429, title: "Too many requests" },
  INTERNAL: { status: 500, title: "Internal error" },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/** One field-level problem in a VALIDATION_FAILED response. */
export type ProblemFieldError = { path: string; code: string; message: string };

/**
 * An error the API raises on purpose. The global filter turns it into an
 * RFC 9457 problem+json body; nothing else in the code builds error responses.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly errors: ProblemFieldError[] | undefined;
  /** Extra members merged into the body, for example `issues` on LIST_INVALID. */
  readonly extensions: Record<string, unknown> | undefined;

  constructor(
    code: ErrorCode,
    detail: string,
    options: {
      errors?: ProblemFieldError[];
      extensions?: Record<string, unknown>;
    } = {},
  ) {
    super(detail);
    this.name = "ApiError";
    this.code = code;
    this.errors = options.errors;
    this.extensions = options.extensions;
  }

  get status(): number {
    return ERROR_CODES[this.code].status;
  }
}
