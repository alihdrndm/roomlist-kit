import { describe, expect, it } from "vitest";
import { problemResponse, readProblem } from "@/lib/problem";

describe("problemResponse", () => {
  it("builds a problem+json response", async () => {
    const response = problemResponse(
      413,
      "FILE_TOO_LARGE",
      "File too large",
      "Too big.",
    );
    expect(response.status).toBe(413);
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json",
    );
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      status: 413,
      code: "FILE_TOO_LARGE",
      title: "File too large",
      detail: "Too big.",
    });
    expect(String(body.type)).toMatch(/ERRORS\.md#FILE_TOO_LARGE$/);
  });
});

describe("readProblem", () => {
  it("reads a problem+json body", async () => {
    const response = problemResponse(
      400,
      "VALIDATION_FAILED",
      "Validation failed",
      "Bad input.",
    );
    const problem = await readProblem(response);
    expect(problem).toMatchObject({
      code: "VALIDATION_FAILED",
      title: "Validation failed",
      detail: "Bad input.",
    });
  });

  it("falls back for a non-JSON 500", async () => {
    const problem = await readProblem(
      new Response("<html>oops</html>", { status: 500 }),
    );
    expect(problem.code).toBe("UNKNOWN");
    expect(problem.status).toBe(500);
    expect(problem.detail).toContain("500");
  });
});
