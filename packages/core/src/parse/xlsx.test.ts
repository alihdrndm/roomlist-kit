import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { readXlsxRows, type SparseRows } from "./xlsx.js";

async function workbookBytes(
  build: (workbook: ExcelJS.Workbook) => void,
  options: { useSharedStrings?: boolean } = {},
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  build(workbook);
  return new Uint8Array(await workbook.xlsx.writeBuffer(options));
}

/**
 * The reference: how rows read with exceljs before this project's own reader
 * replaced it (the M1 cellToString rules). Kept only in tests, to prove the new
 * reader gives the same text for every cell.
 */
function exceljsText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${String(y).padStart(4, "0")}-${m}-${d}`;
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "string" || typeof value === "boolean")
    return String(value).trim();
  if ("formula" in value || "sharedFormula" in value)
    return exceljsText(value.result ?? null);
  if ("richText" in value)
    return value.richText
      .map((part) => part.text)
      .join("")
      .trim();
  if ("hyperlink" in value) return exceljsText(value.text);
  if ("error" in value) return value.error;
  return "";
}

async function exceljsRows(
  input: Uint8Array,
  sheetName?: string,
): Promise<SparseRows> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input.slice().buffer);
  const sheet =
    sheetName === undefined
      ? workbook.worksheets[0]
      : workbook.getWorksheet(sheetName);
  const rows: SparseRows = [];
  sheet?.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      cells[columnNumber - 1] = exceljsText(cell.value);
    });
    rows[rowNumber - 1] = cells;
  });
  return rows;
}

/** Holes become "", trailing empty cells and all-empty rows are dropped, so both readers compare by content. */
function normalise(rows: SparseRows): (string[] | null)[] {
  const result: (string[] | null)[] = [];
  for (let index = 0; index < rows.length; index++) {
    const cells = Array.from(rows[index] ?? [], (cell) => cell ?? "");
    while (cells.length > 0 && cells.at(-1) === "") cells.pop();
    result.push(cells.length === 0 ? null : cells);
  }
  while (result.length > 0 && result.at(-1) === null) result.pop();
  return result;
}

async function expectSameAsExceljs(input: Uint8Array, sheetName?: string) {
  const ours = await readXlsxRows(input, sheetName);
  if (ours.kind !== "rows")
    throw new Error(`expected rows, got ${ours.issue.message}`);
  expect(normalise(ours.rows)).toEqual(
    normalise(await exceljsRows(input, sheetName)),
  );
  return ours.rows;
}

describe("readXlsxRows gives the same text as exceljs did", () => {
  it("the clean-40.xlsx fixture", async () => {
    const bytes = new Uint8Array(
      readFileSync(
        new URL("../../../../fixtures/input/clean-40.xlsx", import.meta.url),
      ),
    );
    const rows = await expectSameAsExceljs(bytes);
    expect(rows[1]?.[5]).toMatch(/^2026-11-\d\d$/);
  });

  for (const useSharedStrings of [true, false]) {
    it(`every kind of cell value (${useSharedStrings ? "shared" : "inline"} strings)`, async () => {
      const input = await workbookBytes(
        (wb) => {
          const sheet = wb.addWorksheet("Guests");
          sheet.addRow([
            "Last Name",
            "Count",
            "When",
            "Flag",
            "Formula",
            "Rich",
            "Link",
            "Error",
          ]);
          sheet.addRow([
            "  Okafor  ",
            2,
            new Date(Date.UTC(2026, 10, 10)),
            true,
            { formula: "B2*2", result: 4 },
            {
              richText: [
                { text: "Ok" },
                { font: { bold: true }, text: "afor " },
              ],
            },
            { text: "mail", hyperlink: "mailto:ada@example.com" },
            { error: "#N/A" },
          ]);
          sheet.addRow([
            "<Smith> & \"Sons\" 'Ltd' 😀",
            2.5,
            new Date(Date.UTC(2026, 10, 13, 18, 30)),
            false,
            { formula: 'A3&"!"', result: "text result" },
            -0.1,
            1e21,
            0.1 + 0.2,
          ]);
          sheet.getCell("J2").value = 7; // sparse column far right of the others
          sheet.getCell("A6").value = "row 6 after gaps";
          sheet.getCell("B4").numFmt = "0.00"; // styled but empty cell
        },
        { useSharedStrings },
      );
      await expectSameAsExceljs(input);
    });
  }

  it("custom date formats, number formats that are not dates, and formula dates", async () => {
    const input = await workbookBytes((wb) => {
      const sheet = wb.addWorksheet("Guests");
      const values: [ExcelJS.CellValue, string][] = [
        [new Date(Date.UTC(2026, 0, 31)), "yyyy-mm-dd"],
        [new Date(Date.UTC(2026, 1, 28)), "dd/mm/yyyy hh:mm"],
        [new Date(Date.UTC(2026, 2, 1)), "[$-409]d-mmm-yy;@"],
        [46000, "0.00"],
        [46000, '"day "0'],
        [46000, "#,##0"],
        [
          { formula: "TODAY()", result: new Date(Date.UTC(2026, 9, 6)) },
          "mm-dd-yy",
        ],
      ];
      values.forEach(([value, format], index) => {
        const cell = sheet.getCell(1, index + 1);
        cell.value = value;
        cell.numFmt = format;
      });
    });
    const rows = await expectSameAsExceljs(input);
    expect(rows[0]?.slice(0, 3)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-01",
    ]);
    expect(rows[0]?.[3]).toBe("46000");
  });

  it("a workbook that counts dates from 1904", async () => {
    const input = await workbookBytes((wb) => {
      wb.properties.date1904 = true;
      wb.addWorksheet("Guests").addRow([new Date(Date.UTC(2026, 10, 10))]);
    });
    const rows = await expectSameAsExceljs(input);
    expect(rows[0]?.[0]).toBe("2026-11-10");
  });

  it("the sheet named in the options, among several", async () => {
    const input = await workbookBytes((wb) => {
      wb.addWorksheet("First").addRow(["a"]);
      wb.addWorksheet("Guests").addRow(["b", 3]);
      wb.addWorksheet("Last").addRow(["c"]);
    });
    expect((await expectSameAsExceljs(input, "Guests"))[0]).toEqual(["b", "3"]);
    await expectSameAsExceljs(input);
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
      truncated: false,
    });
  });

  it("F003: names the available sheets when the requested one is missing", async () => {
    const input = await workbookBytes((wb) => {
      wb.addWorksheet("First");
      wb.addWorksheet("Second");
    });
    const result = await readXlsxRows(input, "Guests");
    expect(result.kind === "rejected" && result.issue.message).toBe(
      'Sheet "Guests" was not found. Available sheets: "First", "Second".',
    );
  });

  it("F003: rejects a workbook with no worksheets", async () => {
    const result = await readXlsxRows(await workbookBytes(() => {}));
    expect(result.kind === "rejected" && result.issue.message).toBe(
      "The workbook has no worksheets.",
    );
  });

  it("F003: rejects a corrupt zip and a zip without a workbook", async () => {
    const corrupt = await readXlsxRows(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]),
    );
    expect(corrupt.kind === "rejected" && corrupt.issue.ruleId).toBe("F003");
    const notAWorkbook = await readXlsxRows(
      zipSync({ "hello.txt": strToU8("hi") }),
    );
    expect(
      notAWorkbook.kind === "rejected" && notAWorkbook.issue.message,
    ).toContain("could not be opened");
  });

  it("stops after maxRows + 100 non-blank rows and says the sheet was truncated", async () => {
    const input = await workbookBytes((wb) => {
      const sheet = wb.addWorksheet("Guests");
      for (let row = 1; row <= 400; row++)
        sheet.getCell(row, 1).value = `Guest ${row}`;
    });
    const result = await readXlsxRows(input, undefined, 50);
    expect(result.kind === "rows" && result.truncated).toBe(true);
    expect(
      result.kind === "rows" && result.rows.filter((row) => row !== undefined),
    ).toHaveLength(151);
    const all = await readXlsxRows(input, undefined, 1000);
    expect(all.kind === "rows" && all.truncated).toBe(false);
  });
});

/** A minimal hand-written workbook, for XML that exceljs never writes. */
function handWritten(parts: {
  sheet: string;
  sharedStrings?: string;
  styles?: string;
  workbook?: string;
  rels?: string;
}) {
  const files: Record<string, Uint8Array> = {
    "xl/workbook.xml": strToU8(
      parts.workbook ??
        '<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Guests" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      parts.rels ??
        '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="x"/></Relationships>',
    ),
    "xl/worksheets/sheet1.xml": strToU8(parts.sheet),
  };
  if (parts.sharedStrings !== undefined)
    files["xl/sharedStrings.xml"] = strToU8(parts.sharedStrings);
  if (parts.styles !== undefined)
    files["xl/styles.xml"] = strToU8(parts.styles);
  return zipSync(files);
}

async function rowsOf(input: Uint8Array): Promise<SparseRows> {
  const result = await readXlsxRows(input);
  if (result.kind !== "rows") throw new Error(result.issue.message);
  return result.rows;
}

describe("readXlsxRows on XML other writers produce", () => {
  it("namespace prefixes, missing r attributes, inline rich text and phonetic hints", async () => {
    const rows = await rowsOf(
      handWritten({
        sheet:
          '<x:worksheet xmlns:x="m"><x:sheetData>' +
          '<x:row><x:c t="inlineStr"><x:is><x:r><x:t>Oka</x:t></x:r><x:r><x:t xml:space="preserve">for </x:t></x:r></x:is></x:c><x:c><x:v>3</x:v></x:c></x:row>' +
          '<x:row r="4"><x:c r="C4" t="s"><x:v>0</x:v></x:c><x:c t="str"><x:v> text &amp; more </x:v></x:c></x:row>' +
          "</x:sheetData></x:worksheet>",
        sharedStrings:
          '<sst><si><t>Tanaka</t><rPh sb="0" eb="1"><t>タナカ</t></rPh></si></sst>',
      }),
    );
    expect(rows[0]).toEqual(["Okafor", "3"]);
    expect(rows[1]).toBeUndefined();
    expect(rows[3]?.[2]).toBe("Tanaka");
    expect(rows[3]?.[3]).toBe("text & more");
  });

  it("date cells written as ISO text (t=d), and a custom format that overrides a built-in date id", async () => {
    const rows = await rowsOf(
      handWritten({
        sheet:
          '<worksheet><sheetData><row r="1"><c r="A1" t="d"><v>2026-11-10T18:30:00Z</v></c><c r="B1" s="1"><v>46000</v></c><c r="C1" s="2"><v>46000</v></c></row></sheetData></worksheet>',
        styles:
          '<styleSheet><numFmts><numFmt numFmtId="14" formatCode="0.00"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="15"/></cellXfs></styleSheet>',
      }),
    );
    expect(rows[0]).toEqual(["2026-11-10", "46000", "2025-12-09"]);
  });

  it("an absolute relationship target and another prefix for the relationship id", async () => {
    const rows = await rowsOf(
      handWritten({
        workbook:
          '<workbook xmlns:rel="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Guests" sheetId="1" rel:id="rIdA"/></sheets></workbook>',
        rels: '<Relationships><Relationship Id="rIdA" Target="/xl/worksheets/sheet1.xml"/></Relationships>',
        sheet:
          '<worksheet><sheetData><row r="2"><c r="B2"><v>1</v></c></row></sheetData></worksheet>',
      }),
    );
    expect(rows[1]?.[1]).toBe("1");
  });

  it("comments and processing instructions in the XML are skipped; a shared string that does not exist is empty", async () => {
    const rows = await rowsOf(
      handWritten({
        sheet:
          '<?xml version="1.0"?><!-- written by hand --><worksheet><sheetData><row r="1"><c r="A1" t="s"><v>5</v></c><c r="B1"><v>9</v></c></row></sheetData></worksheet>',
        sharedStrings: "<sst><si><t>only one</t></si></sst>",
      }),
    );
    expect(rows[0]?.[1]).toBe("9");
    expect(rows[0]?.[0]).toBeUndefined();
  });

  it("a sheet whose relationship points nowhere is unreadable (F003)", async () => {
    const result = await readXlsxRows(
      handWritten({ rels: "<Relationships/>", sheet: "<worksheet/>" }),
    );
    expect(result.kind === "rejected" && result.issue.ruleId).toBe("F003");
  });
});
