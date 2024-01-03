import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ApiError, ERROR_CODES, type ErrorCode } from "./errors.js";
import { ERRORS_DOC_URL, toApiError } from "./problem.filter.js";

const doc = readFileSync(
  new URL("../../../docs/ERRORS.md", import.meta.url),
  "utf-8",
);
const codes = Object.keys(ERROR_CODES) as ErrorCode[];

describe("docs/ERRORS.md", () => {
  it("documents every error code with an anchor of its own name", () => {
    for (const code of codes) {
      expect(doc, code).toContain(`<a id="${code}"></a>`);
    }
  });

  it("states the HTTP status of every code, matching the code table", () => {
    for (const code of codes) {
      expect(doc, code).toContain(`## ${code} (${ERROR_CODES[code].status})`);
      expect(doc, code).toContain(
        `| [\`${code}\`](#${code}) | ${ERROR_CODES[code].status} |`,
      );
    }
  });

  it("documents no code that the API cannot return", () => {
    // Codes under "Web app only" come from apps/web's proxy, not the API.
    const apiPart = doc.split("## Web app only")[0] ?? doc;
    expect(apiPart.length).toBeLessThan(doc.length);
    const documented = [...apiPart.matchAll(/<a id="([A-Z_]+)"><\/a>/g)].map(
      (match) => match[1],
    );
    expect(documented.sort()).toEqual([...codes].sort());
  });

  it("the problem type URL points at this file", () => {
    expect(ERRORS_DOC_URL).toBe(
      "https://github.com/alihdrndm/roomlist-kit/blob/main/docs/ERRORS.md",
    );
  });
});

describe("toApiError", () => {
  const route = { method: "GET", path: "/nope" };

  it("passes a deliberate ApiError through unchanged", () => {
    const error = new ApiError("LIST_INVALID", "x");
    expect(toApiError(error, route)).toBe(error);
  });

  it("maps a multer file-size error to FILE_TOO_LARGE and other multer errors to VALIDATION_FAILED", () => {
    const tooLarge = Object.assign(new Error("File too large"), {
      name: "MulterError",
      code: "LIMIT_FILE_SIZE",
    });
    expect(toApiError(tooLarge, route).code).toBe("FILE_TOO_LARGE");
    const other = Object.assign(new Error("Unexpected field"), {
      name: "MulterError",
      code: "LIMIT_UNEXPECTED_FILE",
    });
    expect(toApiError(other, route).code).toBe("VALIDATION_FAILED");
  });

  it("never leaks the message of an unknown error", () => {
    const error = toApiError(new Error("database password is hunter2"), route);
    expect(error.code).toBe("INTERNAL");
    expect(error.message).not.toContain("hunter2");
    expect(error.status).toBe(500);
  });

  it("treats a non-Error throw as INTERNAL too", () => {
    expect(toApiError("boom", route).code).toBe("INTERNAL");
  });
});
