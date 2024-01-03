import type { NextFunction, Request, Response } from "express";
import { v7 as uuidv7 } from "uuid";

export const REQUEST_ID_HEADER = "x-request-id";

// A caller-supplied id ends up in logs and response headers, so only a short,
// boring character set is accepted; anything else is replaced, never sanitised.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** The request's id and start time once the middleware has run (the id is also what pino-http logs). */
export type RequestWithId = Request & { id?: string; startTime?: bigint };

export function resolveRequestId(
  header: string | string[] | undefined,
): string {
  return typeof header === "string" && SAFE_REQUEST_ID.test(header)
    ? header
    : uuidv7();
}

/** Gives every request an id, echoes it in the response, and notes when it started. */
export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  const id = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
  req.id = id;
  req.startTime = process.hrtime.bigint();
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
