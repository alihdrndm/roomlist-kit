import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { cellToString, readXlsxRows } from "./xlsx.js";

async function workbookBytes(
  build: (workbook: ExcelJS.Workbook) => void,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  build(workbook);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

describe("cellToString", () => {
  it("converts date cells from their UTC year/month/day", () => {
    expect(cellToString(new Date(Date.UTC(2026, 10, 10)))).toBe("2026-11-10");
  });

  it("writes numbers without a trailing .0", () => {
    expect(cellToString(2)).toBe("2");
    expect(cellToString(2.5)).toBe("2.5");
  });

  it("uses the cached result of formula cells", () => {
    expect(cellToString({ formula: "A1+1", result: 3, date1904: false })).toBe(
      "3",
    );
    expect(cellToString({ formula: "A1", date1904: false })).toBe("");
    expect(
      cellToString({ sharedFormula: "A1", result: "KING", date1904: false }),
    ).toBe("KING");
  });

  it("concatenates rich text and trims plain values", () => {
    expect(
      cellToString({ richText: [{ text: "Oka" }, { text: "for " }] }),
    ).toBe("Okafor");
    expect(cellToString("  QQ ")).toBe("QQ");
    expect(cellToString(true)).toBe("true");
  });

  it("handles hyperlinks, errors, empty cells and unknown shapes", () => {
    expect(
      cellToString({
        text: "ada@example.com",
        hyperlink: "mailto:ada@example.com",
      }),
    ).toBe("ada@example.com");
    expect(cellToString({ error: "#N/A" })).toBe("#N/A");
    expect(cellToString(null)).toBe("");
    expect(cellToString({} as ExcelJS.CellValue)).toBe("");
  });
});

describe("readXlsxRows", () => {
  it("reads the first worksheet by default", async () => {
    const input = await workbookBytes((wb) => {
      wb.addWorksheet("First").addRows([
        ["Last Name", "Rooms"],
        ["Okafor", 2],
      ]);
      wb.addWorksheet("Second").addRow(["ignored"]);
    });
    expect(await readXlsxRows(input)).toEqual({
      kind: "rows",
      rows: [
        ["Last Name", "Rooms"],
        ["Okafor", "2"],
      ],
    });
  });

  it("reads the sheet named in options", async () => {
    const input = await workbookBytes((wb) => {
      wb.addWorksheet("First").addRow(["a"]);
      wb.addWorksheet("Guests").addRow(["b"]);
    });
    expect(await readXlsxRows(input, "Guests")).toEqual({
      kind: "rows",
      rows: [["b"]],
    });
  });

  it("F003: names the available sheets when the requested one is missing", async () => {
    const input = await workbookBytes((wb) => {
      wb.addWorksheet("First");
      wb.addWorksheet("Second");
    });
    const result = await readXlsxRows(input, "Guests");
    expect(result.kind).toBe("rejected");
    expect(result.kind === "rejected" && result.issue.message).toContain(
      '"First", "Second"',
    );
  });

  it("F003: rejects a workbook with no worksheets", async () => {
    const input = await workbookBytes(() => {});
    const result = await readXlsxRows(input);
    expect(result.kind === "rejected" && result.issue.message).toBe(
      "The workbook has no worksheets.",
    );
  });

  it("F003: rejects a corrupt zip", async () => {
    const result = await readXlsxRows(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]),
    );
    expect(result.kind === "rejected" && result.issue.ruleId).toBe("F003");
  });
});
