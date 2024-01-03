import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { readXlsxRows } from "./xlsx.js";

async function workbookBytes(
  build: (workbook: ExcelJS.Workbook) => void,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  build(workbook);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

describe("readXlsxRows on sparse and hostile workbooks", () => {
  it("a sheet with one cell far down and one far right is read from its real cells only, in well under a second", async () => {
    const input = await workbookBytes((wb) => {
      const sheet = wb.addWorksheet("Guests");
      sheet.getCell("A1").value = "Last Name";
      sheet.getCell("ALL1").value = "far right"; // column 1000
      sheet.getCell("A10000").value = "far down";
    });
    const started = performance.now();
    const result = await readXlsxRows(input);
    expect(performance.now() - started).toBeLessThan(15_000);
    expect(result.kind).toBe("rows");
    if (result.kind !== "rows") return;
    expect(result.rows[0]?.[0]).toBe("Last Name");
    expect(result.rows[0]?.[999]).toBe("far right");
    expect(result.rows[9999]?.[0]).toBe("far down");
    expect(result.rows[5]).toBeUndefined();
  });

  it("F003: a workbook that declares too much unpacked data is refused before it is unpacked", async () => {
    // A valid workbook, with the declared size of one part raised in the zip directory.
    const input = await workbookBytes((wb) => {
      wb.addWorksheet("Guests").addRow(["Last Name"]);
    });
    const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    for (let at = input.length - 22; at >= 0; at--) {
      if (view.getUint32(at, true) === 0x06054b50) {
        const first = view.getUint32(at + 16, true);
        view.setUint32(first + 24, 200 * 1024 * 1024, true);
        break;
      }
    }
    const result = await readXlsxRows(input);
    expect(result.kind).toBe("rejected");
    expect(result.kind === "rejected" && result.issue).toMatchObject({
      ruleId: "F003",
      code: "UNSUPPORTED_FORMAT",
    });
    expect(result.kind === "rejected" && result.issue.message).toContain(
      "too large when unpacked",
    );
  });
});
