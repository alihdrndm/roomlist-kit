// The error shape every API failure comes back in (RFC 9457 problem+json, see
// docs/ERRORS.md). Used on the server (route handlers) and in the browser (pages).

export type Problem = {
  title: string;
  detail: string;
  status: number;
  code: string;
  instance?: string;
  errors?: { path: string; code: string; message: string }[];
  issues?: {
    severity: string;
    ruleId: string;
    code: string;
    message: string;
    row?: number;
    field?: string;
    /** Set on diff errors: which of the two lists the issue is in. */
    side?: "before" | "after";
  }[];
};

/** A problem+json response the web app produces itself (for example when the API cannot be reached). */
export function problemResponse(
  status: number,
  code: string,
  title: string,
  detail: string,
  errors?: Problem["errors"],
): Response {
  const body: Problem = {
    status,
    code,
    title,
    detail,
    ...(errors === undefined ? {} : { errors }),
  };
  return new Response(
    JSON.stringify({
      type: `https://github.com/alihdrndm/roomlist-kit/blob/main/docs/ERRORS.md#${code}`,
      ...body,
    }),
    {
      status,
      headers: { "content-type": "application/problem+json" },
    },
  );
}

/**
 * Reads the problem out of a failed response. Anything that is not a problem body
 * (a proxy's HTML page, an empty body) still gives the user a title and a detail.
 */
export async function readProblem(response: Response): Promise<Problem> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "title" in body &&
      "detail" in body
    ) {
      const problem = body as Problem;
      if (
        typeof problem.title === "string" &&
        typeof problem.detail === "string"
      )
        return problem;
    }
  } catch {
    // Not JSON: fall through to the generic description.
  }
  return {
    status: response.status,
    code: "UNKNOWN",
    title: "Request failed",
    detail: `The server answered with status ${response.status}. Please try again.`,
  };
}
