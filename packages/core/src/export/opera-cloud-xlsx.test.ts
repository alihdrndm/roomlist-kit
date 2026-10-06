import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { ParsedEntry, RoomingList } from "../model.js";
import { exportRoomingList } from "./export.js";
import { OPERA_CLOUD_HEADINGS } from "./opera-cloud-xlsx.js";
import { date, we1List } from "./test-helpers.js";
import { ExportOptionsError, ExportPreconditionError } from "./types.js";

const entry = (
  overrides: Partial<ParsedEntry> & { line: number },
): ParsedEntry => ({
  lastName: "Okafor",
  firstName: "Ada",
  roomType: "KING",
  arrivalDate: date("2026-11-10"),
  departureDate: date("2026-11-12"),
  rooms: 1,
  adults: 1,
  children: 0,
  infants: 0,
  ...overrides,
});

async function readSheet(list: RoomingList, options?: unknown) {
  const result = await exportRoomingList(list, "opera-cloud-xlsx", options);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.bytes.slice().buffer);
  const sheet = workbook.getWorksheet("Rooming List");
  if (sheet === undefined) throw new Error("sheet missing");
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    rows.push(
      Array.from({ length: sheet.columnCount }, (_, i) =>
        String(row.getCell(i + 1).value ?? ""),
      ),
    );
  });
  return { result, sheet, rows, workbook };
}

describe("opera-cloud-xlsx", () => {
  it("opera-cloud-xlsx: has one worksheet named Rooming List with the exact headings in row 1", async () => {
    const { workbook, rows } = await readSheet(await we1List());
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Rooming List",
    ]);
    expect(rows[0]).toEqual([...OPERA_CLOUD_HEADINGS]);
    expect(rows[0]).toEqual([
      "Line",
      "Sharer",
      "Last Name",
      "First Name",
      "Title",
      "Arrival",
      "Departure",
      "Room Type",
      "Rooms",
      "Adults",
      "Children",
      "Email",
      "Email Type",
      "Phone",
      "Nationality",
      "Language",
      "Date of Birth",
      "Notes",
    ]);
  });

  it("opera-cloud-xlsx: WE1 rows, sharer holds the primary's line, email type only with an email", async () => {
    const { rows, result } = await readSheet(await we1List());
    expect(rows[1]).toEqual([
      "1",
      "",
      "Okafor",
      "Ada",
      "",
      "11/10/2026",
      "11/13/2026",
      "KING",
      "1",
      "1",
      "0",
      "ada.okafor@example.com",
      "EMAIL",
      "",
      "",
      "",
      "",
      "",
    ]);
    expect(rows[3]?.slice(0, 2)).toEqual(["3", "2"]);
    expect(rows[4]?.slice(11, 13)).toEqual(["", ""]); // Tanaka has no email, so no Email Type either
    expect(result.fileName).toBe("rooming-list-opera-cloud.xlsx");
    expect(result.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(result.issues).toEqual([]);
  });

  it("opera-cloud-xlsx: every cell is text, so dates and numbers keep their typed form", async () => {
    const { sheet } = await readSheet(await we1List());
    for (const cell of [
      sheet.getCell("A2"),
      sheet.getCell("F2"),
      sheet.getCell("I2"),
    ]) {
      expect(typeof cell.value).toBe("string");
      expect(cell.numFmt).toBe("@");
    }
  });

  it("opera-cloud-xlsx: dateFormat and emailType options", async () => {
    const { rows } = await readSheet(await we1List(), {
      dateFormat: "DD-MM-YYYY",
      emailType: "HOME",
    });
    expect(rows[1]?.[5]).toBe("10-11-2026");
    expect(rows[1]?.[12]).toBe("HOME");
    const iso = await readSheet(await we1List(), { dateFormat: "YYYY-MM-DD" });
    expect(iso.rows[1]?.[5]).toBe("2026-11-10");
    const dmy = await readSheet(await we1List(), { dateFormat: "DD/MM/YYYY" });
    expect(dmy.rows[1]?.[5]).toBe("10/11/2026");
  });

  it("opera-cloud-xlsx: date of birth uses the same dateFormat", async () => {
    const list: RoomingList = {
      entries: [entry({ line: 1, dateOfBirth: date("1990-03-04") })],
    };
    expect(
      (await readSheet(list, { dateFormat: "DD/MM/YYYY" })).rows[1]?.[16],
    ).toBe("04/03/1990");
  });

  it("opera-cloud-xlsx: rejects an unknown dateFormat", async () => {
    await expect(
      exportRoomingList(await we1List(), "opera-cloud-xlsx", {
        dateFormat: "YY-M-D",
      }),
    ).rejects.toBeInstanceOf(ExportOptionsError);
  });

  it("X001 opera-cloud-xlsx: every entry needs a first name and a room type", async () => {
    const { firstName: _a, ...noFirst } = entry({ line: 1 });
    const { roomType: _b, ...noRoom } = entry({ line: 2 });
    const error = await exportRoomingList(
      { entries: [noFirst, noRoom] },
      "opera-cloud-xlsx",
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ExportPreconditionError);
    const issues = error instanceof ExportPreconditionError ? error.issues : [];
    expect(
      issues.map((issue) => [issue.ruleId, issue.line, issue.field]),
    ).toEqual([
      ["X001", 1, "firstName"],
      ["X001", 2, "roomType"],
    ]);
  });

  it("X101 opera-cloud-xlsx: more than 1,000 entries still exports but warns", async () => {
    const entries = Array.from({ length: 1001 }, (_, i) =>
      entry({ line: i + 1, lastName: `Guest${i + 1}` }),
    );
    const result = await exportRoomingList({ entries }, "opera-cloud-xlsx");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      ruleId: "X101",
      code: "EXPORT_OVER_RECOMMENDED_LIMIT",
      severity: "warning",
    });
    expect(result.bytes.length).toBeGreaterThan(1000);
  });

  it("X101 opera-cloud-xlsx: exactly 1,000 entries does not warn", async () => {
    const entries = Array.from({ length: 1000 }, (_, i) =>
      entry({ line: i + 1, lastName: `Guest${i + 1}` }),
    );
    expect(
      (await exportRoomingList({ entries }, "opera-cloud-xlsx")).issues,
    ).toEqual([]);
  });
});

describe("X001 opera-cloud-xlsx empty strings", () => {
  it("X001 opera-cloud-xlsx: an empty first name or empty room type counts as missing", async () => {
    const error = await exportRoomingList(
      {
        entries: [
          entry({ line: 1, firstName: "" }),
          entry({ line: 2, roomType: "" }),
        ],
      },
      "opera-cloud-xlsx",
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ExportPreconditionError);
    const issues = error instanceof ExportPreconditionError ? error.issues : [];
    expect(issues.map((issue) => [issue.line, issue.field])).toEqual([
      [1, "firstName"],
      [2, "roomType"],
    ]);
  });
});
