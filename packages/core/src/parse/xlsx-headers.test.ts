import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseRoomingList } from "./parse.js";

async function xlsx(
  build: (sheet: ExcelJS.Worksheet) => void,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  build(workbook.addWorksheet("Guests"));
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

describe("blank headers in xlsx files (regression from the sparse reader)", () => {
  it("W201: data under a header cell that was never written is reported, not silently dropped", async () => {
    // A1, C1, D1 have headers; B1 was never written, so it is a hole in the sparse row.
    const bytes = await xlsx((sheet) => {
      sheet.getCell("A1").value = "Last Name";
      sheet.getCell("C1").value = "Arrival";
      sheet.getCell("D1").value = "Departure";
      sheet.getCell("A2").value = "Okafor";
      sheet.getCell("B2").value = "VIP";
      sheet.getCell("C2").value = "2026-11-10";
      sheet.getCell("D2").value = "2026-11-12";
    });
    const result = await parseRoomingList(bytes);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      lastName: "Okafor",
      arrivalDate: "2026-11-10",
    });
    const w201 = result.issues.filter((issue) => issue.ruleId === "W201");
    expect(w201).toHaveLength(1);
    expect(w201[0]?.message).toContain("Column 2 has no header");
  });

  it("an unused (hole) header column with no data below it stays silent, like an empty CSV header", async () => {
    const bytes = await xlsx((sheet) => {
      sheet.getCell("A1").value = "Last Name";
      sheet.getCell("C1").value = "Arrival";
      sheet.getCell("D1").value = "Departure";
      sheet.getCell("A2").value = "Okafor";
      sheet.getCell("C2").value = "2026-11-10";
      sheet.getCell("D2").value = "2026-11-12";
    });
    const result = await parseRoomingList(bytes);
    expect(result.issues).toEqual([]);
  });

  it("the same sheet as a CSV gives the same W201 (xlsx and csv agree)", async () => {
    const csv =
      "Last Name,,Arrival,Departure\nOkafor,VIP,2026-11-10,2026-11-12\n";
    const result = await parseRoomingList(new TextEncoder().encode(csv));
    expect(result.issues.map((issue) => issue.ruleId)).toEqual(["W201"]);
    expect(result.issues[0]?.message).toContain("Column 2 has no header");
  });
});
