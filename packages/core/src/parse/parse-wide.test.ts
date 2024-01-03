import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseRoomingList } from "./parse.js";

const csv = (text: string) => new TextEncoder().encode(text);

describe("parseRoomingList on very wide files", () => {
  it("W201: a row of 600,000 cells gives 50 warnings and one summary, quickly", async () => {
    // 600,000 cells (1.2 MB): enough that any per-column or per-row-times-column work would take minutes.
    const wide = `${"a,".repeat(600_000)}a`;
    const text = `Last Name,Arrival,Departure\nOkafor,2026-11-10,2026-11-12,${wide}\n`;
    const result = await parseRoomingList(csv(text));
    const w201 = result.issues.filter((issue) => issue.ruleId === "W201");
    expect(w201).toHaveLength(51);
    expect(w201.at(-1)?.message).toMatch(/^\d+ more columns are ignored/);
    expect(result.entries).toHaveLength(1);
  }, 60_000);

  it("W201: a very wide header row of unknown columns also stops at 50, and the column list stays small", async () => {
    const header = `Last Name,Arrival,Departure,${Array.from({ length: 300_000 }, (_, n) => `x${n}`).join(",")}`;
    const result = await parseRoomingList(
      csv(`${header}\nOkafor,2026-11-10,2026-11-12\n`),
    );
    expect(
      result.issues.filter((issue) => issue.ruleId === "W201"),
    ).toHaveLength(51);
    expect(result.columns.length).toBeLessThanOrEqual(3 + 50);
  }, 60_000);

  it("W201: headerless columns and unknown headers share the same budget of 50", async () => {
    const header = `Last Name,Arrival,Departure,${Array.from({ length: 40 }, (_, n) => `x${n}`).join(",")}`;
    const row = `Okafor,2026-11-10,2026-11-12,${"1,".repeat(39)}1,${Array.from({ length: 30 }, () => "v").join(",")}`;
    const result = await parseRoomingList(csv(`${header}\n${row}\n`));
    const w201 = result.issues.filter((issue) => issue.ruleId === "W201");
    expect(w201).toHaveLength(51);
    expect(w201.at(-1)?.message).toContain("20 more columns");
  });

  it("an F005 file still gets its (capped) W201 warnings next to the missing-column errors", async () => {
    const header = `Room,${Array.from({ length: 60 }, (_, n) => `x${n}`).join(",")}`;
    const result = await parseRoomingList(csv(`${header}\nKING\n`));
    expect(
      result.issues.filter((issue) => issue.ruleId === "F005"),
    ).toHaveLength(3);
    expect(
      result.issues.filter((issue) => issue.ruleId === "W201"),
    ).toHaveLength(51);
  });

  it("an xlsx with one cell at row 10000 and one at column 1000 parses in about a second, not minutes", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Guests");
    sheet.addRow(["Last Name", "Arrival", "Departure"]);
    sheet.addRow(["Okafor", "2026-11-10", "2026-11-12"]);
    sheet.getCell("ALL1").value = "far right";
    sheet.getCell("A10000").value = "far down";
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
    // No wall-clock assertion: the old code took minutes here, so the test timeout catches a regression.
    const result = await parseRoomingList(bytes);
    expect(result.format).toBe("xlsx");
    // Row 10000 holds one stray name with no dates: reported, not hung on.
    expect(
      result.issues.some(
        (issue) => issue.ruleId === "R002" && issue.row === 10000,
      ),
    ).toBe(true);
    expect(result.issues.some((issue) => issue.ruleId === "W201")).toBe(true);
  }, 30_000);
});
