import { env } from "@/env";
import { problemResponse } from "@/lib/problem";

// Server-only: imports env.ts, which holds the API key. Only route handlers and
// server components import this file (a test checks no client component does).

const MIB = 1024 * 1024;

/**
 * The API's 5 MB limit per file, plus 1 MB for the multipart framing and text parts.
 * A diff carries two files, so its limit is 11 MB.
 */
export function maxRequestBytes(files: number): number {
  return files * 5 * MIB + MIB;
}

/** Response headers the browser needs; everything else from the API stays behind. */
const PASSED_THROUGH = [
  "content-type",
  "content-disposition",
  "x-roomlist-warnings",
  "x-request-id",
  // On a 429 the client needs these to know when to retry.
  "retry-after",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
];

/**
 * Forwards one multipart upload to the API with the API key, and the API's answer
 * back unchanged (problem+json errors included). The size is checked from
 * Content-Length before the body is read: the HTTP layer never delivers more bytes
 * than that header announces, so the buffer below is bounded.
 */
export async function forwardUpload(
  request: Request,
  apiPath: string,
  files = 1,
): Promise<Response> {
  const declared = request.headers.get("content-length");
  if (declared === null || !/^\d+$/.test(declared)) {
    return problemResponse(
      422,
      "VALIDATION_FAILED",
      "Validation failed",
      "The request has 1 invalid field.",
      [
        {
          path: "content-length",
          code: "missing",
          message:
            "The upload has no size (Content-Length). Send it as a normal form upload.",
        },
      ],
    );
  }
  if (Number(declared) > maxRequestBytes(files)) {
    return problemResponse(
      413,
      "FILE_TOO_LARGE",
      "File too large",
      "The upload is larger than 5 MB per file. Split the rooming list into smaller files.",
    );
  }
  const body = await request.arrayBuffer();
  return callApi(apiPath, request, {
    method: "POST",
    body,
    contentType: request.headers.get("content-type"),
  });
}

/** A GET to the API (used by /api/formats and the /formats page). */
export function getFromApi(
  apiPath: string,
  request?: Request,
): Promise<Response> {
  return callApi(apiPath, request, { method: "GET" });
}

async function callApi(
  apiPath: string,
  request: Request | undefined,
  init: {
    method: "GET" | "POST";
    body?: ArrayBuffer;
    contentType?: string | null;
  },
): Promise<Response> {
  const headers = new Headers();
  if (env.API_KEY !== "") headers.set("x-api-key", env.API_KEY);
  if (init.contentType) headers.set("content-type", init.contentType);
  // The API limits requests per client address. Behind a load balancer the chain in
  // x-forwarded-for names the real client; the API decides how much of it to trust
  // (TRUST_PROXY), so it is passed on unchanged rather than trusted here.
  const forwardedFor = request?.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
  const requestId = request?.headers.get("x-request-id");
  if (requestId) headers.set("x-request-id", requestId);

  let upstream: Response;
  try {
    upstream = await fetch(new URL(apiPath, env.API_BASE_URL), {
      method: init.method,
      headers,
      ...(init.body === undefined ? {} : { body: init.body }),
      cache: "no-store",
    });
  } catch {
    return problemResponse(
      502,
      "API_UNAVAILABLE",
      "Service unavailable",
      "The validation service could not be reached. Please try again in a moment.",
    );
  }

  const passed = new Headers();
  for (const name of PASSED_THROUGH) {
    const value = upstream.headers.get(name);
    if (value !== null) passed.set(name, value);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: passed,
  });
}
