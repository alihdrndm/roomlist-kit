import { describe, expect, it } from "vitest";
import { detectFormat } from "./detect-format.js";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("detectFormat", () => {
  it("detects xlsx by the zip signature, whatever the name", () => {
    expect(detectFormat(bytes(0x50, 0x4b, 0x03, 0x04, 0x00))).toEqual({
      kind: "xlsx",
    });
  });

  it("F003: rejects a legacy .xls (OLE signature)", () => {
    const result = detectFormat(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1));
    expect(result.kind === "rejected" && result.issue.ruleId).toBe("F003");
  });

  it("F001: rejects zero bytes and whitespace-only content", () => {
    for (const input of [bytes(), new TextEncoder().encode(" \r\n\t ")]) {
      const result = detectFormat(input);
      expect(result.kind === "rejected" && result.issue.code).toBe(
        "FILE_EMPTY",
      );
    }
  });

  it("F004: rejects text that is not valid UTF-8", () => {
    const latin1 = bytes(
      0x4e,
      0x61,
      0x6d,
      0x65,
      0x0a,
      0x4d,
      0xfc,
      0x6c,
      0x6c,
      0x65,
      0x72,
    ); // "Müller" in Latin-1
    const result = detectFormat(latin1);
    expect(result.kind === "rejected" && result.issue.code).toBe(
      "FILE_ENCODING",
    );
  });

  it("decodes UTF-8 CSV and strips a leading BOM", () => {
    const withBom = new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...new TextEncoder().encode("Last Name\nMüller"),
    ]);
    expect(detectFormat(withBom)).toEqual({
      kind: "csv",
      text: "Last Name\nMüller",
    });
  });
});
