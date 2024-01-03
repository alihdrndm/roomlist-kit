import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import type { Response } from "express";
import { PinoLogger } from "nestjs-pino";
import {
  ApiError,
  ERROR_CODES,
  type ErrorCode,
  type ProblemFieldError,
} from "./errors.js";
import {
  REQUEST_ID_HEADER,
  type RequestWithId,
  resolveRequestId,
} from "./request-id.js";

/** Where the error documentation lives; each code has an anchor of its own name. */
export const ERRORS_DOC_URL =
  "https://github.com/alihdrndm/roomlist-kit/blob/main/docs/ERRORS.md";

export type Problem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: ErrorCode;
  /** The request id, so a user can quote it and a log line can be found. */
  instance: string;
  errors?: ProblemFieldError[];
  [extension: string]: unknown;
};

/** pino-http puts `log` on the request once it has run; requests rejected before it have none. */
type LoggingRequest = RequestWithId & { log?: unknown };

/** Multer (file upload) errors are recognised by name: the package is not a direct dependency. */
function multerCode(error: unknown): string | undefined {
  if (
    error instanceof Error &&
    error.name === "MulterError" &&
    "code" in error
  ) {
    return String(error.code);
  }
  return undefined;
}

/** The 4xx status of an error that carries one (Nest HttpException, Express body-parser errors). */
function clientStatus(error: unknown): number | undefined {
  const status =
    error instanceof HttpException
      ? error.getStatus()
      : typeof error === "object" &&
          error !== null &&
          "status" in error &&
          typeof error.status === "number"
        ? error.status
        : undefined;
  return status !== undefined && status >= 400 && status < 500
    ? status
    : undefined;
}

const UPLOAD_HINT =
  " Send block, options, target and targetOptions as plain text fields, not file uploads (curl: -F 'block=<file.json').";

/**
 * Decides which documented ApiError any thrown value stands for. Anything that is
 * not recognised becomes INTERNAL with a fixed message: internal details never
 * reach the response body.
 */
export function toApiError(
  exception: unknown,
  request: { method: string; path: string },
): ApiError {
  if (exception instanceof ApiError) return exception;

  const upload = multerCode(exception);
  if (upload === "LIMIT_FILE_SIZE") {
    return new ApiError(
      "FILE_TOO_LARGE",
      "The uploaded file is larger than the allowed size.",
    );
  }
  if (upload !== undefined) {
    // Unexpected file field, too many parts, and similar: the request shape is wrong.
    return new ApiError(
      "VALIDATION_FAILED",
      "The multipart request is not in the expected form.",
      {
        errors: [
          {
            path: "",
            code: upload,
            message: "Unexpected or too many multipart parts.",
          },
        ],
      },
    );
  }

  // Nest turns multer errors into HttpExceptions, and Express's body parser throws
  // plain errors with a `status`. Either way a 4xx is the caller's mistake, never a 500.
  const status = clientStatus(exception);
  if (status !== undefined && exception instanceof Error) {
    if (status === 404)
      return new ApiError(
        "NOT_FOUND",
        `No route for ${request.method} ${request.path}.`,
      );
    if (status === 401)
      return new ApiError("UNAUTHORIZED", "Authentication is required.");
    if (status === 413)
      return new ApiError(
        "FILE_TOO_LARGE",
        "The request body is larger than the allowed size.",
      );
    if (status === 429)
      return new ApiError(
        "RATE_LIMITED",
        "Too many requests. Try again in a minute.",
      );
    // Only multer's "Unexpected file field - block." deserves the upload hint; a
    // malformed JSON body ("Unexpected end of JSON input") must not get it.
    const hint = /^Unexpected (file )?field/.test(exception.message)
      ? UPLOAD_HINT
      : "";
    return new ApiError(
      "VALIDATION_FAILED",
      `The request could not be understood: ${exception.message}.${hint}`,
    );
  }
  return new ApiError(
    "INTERNAL",
    "Something went wrong on our side. Quote the request id when reporting it.",
  );
}

/**
 * Where an unexpected error came from, without what it said: the first lines of the
 * stack after the message. A library's error message can contain cell text, and logs
 * must never hold guest data.
 */
function whereItHappened(exception: unknown): string[] {
  if (!(exception instanceof Error) || exception.stack === undefined) return [];
  return exception.stack
    .split("\n")
    .filter((line) => line.trimStart().startsWith("at "))
    .slice(0, 6)
    .map((line) => line.trim());
}

/** The one place every error response is built (RFC 9457 problem+json). */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<LoggingRequest>();
    const response = http.getResponse<Response>();

    const error = toApiError(exception, {
      method: request.method,
      path: request.path,
    });
    const instance =
      request.id ?? resolveRequestId(request.headers[REQUEST_ID_HEADER]);

    if (error.code === "INTERNAL") {
      this.logger.error(
        {
          requestId: instance,
          errorName:
            exception instanceof Error
              ? exception.constructor.name
              : typeof exception,
          at: whereItHappened(exception),
        },
        "Unhandled error (message withheld from logs)",
      );
    }
    const body: Problem = {
      type: `${ERRORS_DOC_URL}#${error.code}`,
      title: ERROR_CODES[error.code].title,
      status: error.status,
      detail: error.message,
      code: error.code,
      instance,
      ...(error.errors === undefined ? {} : { errors: error.errors }),
      ...(error.extensions ?? {}),
    };
    response.setHeader(REQUEST_ID_HEADER, instance);
    response
      .status(error.status)
      .type("application/problem+json")
      .send(JSON.stringify(body));

    // A request that failed before the router (a malformed URL) never reached the
    // access-log middleware, so the "one line per request" is written here instead.
    if (request.log === undefined)
      this.logRequest(request, response, error.status);
  }

  private logRequest(
    request: LoggingRequest,
    response: Response,
    statusCode: number,
  ): void {
    const elapsed =
      request.startTime === undefined
        ? 0
        : Number(process.hrtime.bigint() - request.startTime) / 1e6;
    // The real request and response objects: the logger's serializers (app.module.ts)
    // turn them into exactly the fields pino-http would have written, and nothing else.
    const line = {
      req: request,
      res: response,
      responseTime: Math.round(elapsed),
    };
    if (statusCode >= 500) this.logger.error(line, "request failed");
    else this.logger.warn(line, "request failed");
  }
}
