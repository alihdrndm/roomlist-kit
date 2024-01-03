import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseRoomingList } from "./parse.js";

const csv = (text: string) => new TextEncoder().encode(text);
const ruleIds = (result: { issues: { ruleId: string }[] }) =>
  result.issues.map((issue) => issue.ruleId);

describe("parseRoomingList", () => {
  it("parses a minimal CSV", async () => {
    const result = await parseRoomingList(
      csv("Last Name,Arrival,Departure\nOkafor,2026-11-10,2026-11-13\n"),
    );
    expect(result.format).toBe("csv");
    expect(result.rowCount).toBe(1);
    expect(result.issues).toEqual([]);
    expect(result.entries).toEqual([
      {
        line: 1,
        lastName: "Okafor",
        arrivalDate: "2026-11-10",
        departureDate: "2026-11-13",
        rooms: 1,
        adults: 1,
        children: 0,
        infants: 0,
      },
    ]);
  });

  it("parses an XLSX workbook", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Guests");
    sheet.addRow(["Last Name", "Arrival", "Departure"]);
    sheet.addRow([
      "Okafor",
      new Date(Date.UTC(2026, 10, 10)),
      new Date(Date.UTC(2026, 10, 13)),
    ]);
    const result = await parseRoomingList(
      new Uint8Array(await workbook.xlsx.writeBuffer()),
    );
    expect(result.format).toBe("xlsx");
    expect(result.entries[0]).toMatchObject({
      arrivalDate: "2026-11-10",
      departureDate: "2026-11-13",
    });
  });

  it("F001: empty file", async () => {
    expect(ruleIds(await parseRoomingList(new Uint8Array()))).toEqual(["F001"]);
  });

  it("F001: a workbook whose rows are all blank", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Empty");
    expect(
      ruleIds(
        await parseRoomingList(
          new Uint8Array(await workbook.xlsx.writeBuffer()),
        ),
      ),
    ).toEqual(["F001"]);
  });

  it("F003: legacy .xls and a missing sheet return no entries", async () => {
    expect(
      ruleIds(await parseRoomingList(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))),
    ).toEqual(["F003"]);
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Guests").addRow(["Last Name"]);
    const result = await parseRoomingList(
      new Uint8Array(await workbook.xlsx.writeBuffer()),
      { sheetName: "Nope" },
    );
    expect(result).toMatchObject({ format: "xlsx", entries: [] });
    expect(ruleIds(result)).toEqual(["F003"]);
  });

  it("F004: invalid UTF-8", async () => {
    expect(
      ruleIds(await parseRoomingList(new Uint8Array([0x41, 0xff, 0x0a]))),
    ).toEqual(["F004"]);
  });

  it("F005: missing required columns stop parsing with no entries", async () => {
    const result = await parseRoomingList(csv("Last Name,Room\nOkafor,KING\n"));
    expect(ruleIds(result)).toEqual(["F005", "F005"]);
    expect(result.entries).toEqual([]);
    expect(result.columns).toEqual([
      { header: "Last Name", field: "lastName" },
      { header: "Room", field: "roomType" },
    ]);
  });

  it("F006: duplicate columns stop parsing", async () => {
    const result = await parseRoomingList(
      csv("Last Name,Surname,Arrival,Departure\nA,B,2026-11-10,2026-11-11\n"),
    );
    expect(ruleIds(result)).toEqual(["F006"]);
    expect(result.entries).toEqual([]);
  });

  it("F007: more data rows than maxRows", async () => {
    const rows = [
      "Last Name,Arrival,Departure",
      "A,2026-11-10,2026-11-11",
      "B,2026-11-10,2026-11-11",
      "C,2026-11-10,2026-11-11",
    ];
    const result = await parseRoomingList(csv(rows.join("\n")), { maxRows: 2 });
    expect(ruleIds(result)).toEqual(["F007"]);
    expect(result).toMatchObject({ entries: [], rowCount: 3 });
    expect(
      (await parseRoomingList(csv(rows.join("\n")), { maxRows: 3 })).entries,
    ).toHaveLength(3);
  });

  it("row numbers count the header and skipped blank rows", async () => {
    const result = await parseRoomingList(
      csv(
        "Title row,,\n\nLast Name,Arrival,Departure\n\nOkafor,bad,2026-11-13\n",
      ),
    );
    expect(result.issues[0]).toMatchObject({ ruleId: "R002", row: 5 });
    expect(result.entries[0]?.line).toBe(1);
    expect(result.entryRows).toEqual([5]);
  });

  it("collects every cell problem in one run, sorted errors first", async () => {
    const text =
      "Last Name,Arrival,Departure,Rooms,Gender,Fax\nA,bad,2026-11-13,0,zz,1\nB,2026-11-10,2026-11-13,x,m,2\n";
    const result = await parseRoomingList(csv(text));
    expect(
      result.issues.map((issue) => `${issue.ruleId}@${issue.row}`),
    ).toEqual(["R002@2", "R006@2", "R006@3", "W201@1", "W208@2"]);
    expect(result.entries).toHaveLength(2);
  });

  it("W205: raised once when every numeric date is ambiguous, reads as dateOrder", async () => {
    const text =
      "Last Name,Arrival,Departure\nA,11/10/2026,11/12/2026\nB,11/10/2026,11/11/2026\n";
    const mdy = await parseRoomingList(csv(text));
    expect(ruleIds(mdy)).toEqual(["W205"]);
    expect(mdy.entries[0]?.arrivalDate).toBe("2026-11-10");
    const dmy = await parseRoomingList(csv(text), { dateOrder: "DMY" });
    expect(dmy.issues[0]?.message).toContain("day/month");
    expect(dmy.entries[0]?.arrivalDate).toBe("2026-10-11");
  });

  it("W207: raised once per file when names come from a fullName column", async () => {
    const result = await parseRoomingList(
      csv(
        "Guest,Arrival,Departure\nAda Okafor,2026-11-10,2026-11-13\nJonas Lindqvist,2026-11-10,2026-11-13\n",
      ),
    );
    expect(ruleIds(result)).toEqual(["W207"]);
    expect(result.entries[1]).toMatchObject({
      lastName: "Lindqvist",
      firstName: "Jonas",
    });
  });

  it("ignores fullName when a lastName column exists", async () => {
    const result = await parseRoomingList(
      csv(
        "Name,Last Name,Arrival,Departure\nAda Okafor,Okafor,2026-11-10,2026-11-13\n",
      ),
    );
    expect(ruleIds(result)).toEqual([]);
    expect(result.entries[0]?.firstName).toBeUndefined();
  });

  it("columnMap: null ignores a column without W201", async () => {
    const result = await parseRoomingList(
      csv("Last Name,Arrival,Departure,Fax\nA,2026-11-10,2026-11-11,1\n"),
      { columnMap: { Fax: null } },
    );
    expect(result.issues).toEqual([]);
    expect(result.columns[3]).toEqual({ header: "Fax", field: null });
  });

  it("W201: a blank header over a column with data warns once; padding does not", async () => {
    const withData = await parseRoomingList(
      csv("Last Name,,Arrival,Departure,\nOkafor,VIP,2026-11-10,2026-11-13,\n"),
    );
    expect(withData.issues).toHaveLength(1);
    expect(withData.issues[0]).toMatchObject({ ruleId: "W201", row: 1 });
    expect(withData.issues[0]?.message).toContain("Column 2 has no header");
  });

  it("W201: cells to the right of the last header warn once per column", async () => {
    const result = await parseRoomingList(
      csv(
        "Last Name,Arrival,Departure\nOkafor,2026-11-10,2026-11-13,VIP\nLindqvist,2026-11-10,2026-11-13\n",
      ),
    );
    expect(result.issues.map((issue) => issue.ruleId)).toEqual(["W201"]);
    expect(result.issues[0]?.message).toContain("Column 4 has no header");
  });

  it("F004: an unclosed quote returns an issue instead of throwing", async () => {
    const result = await parseRoomingList(
      csv('Last Name,Arrival,Departure\n"Okafor,2026-11-10,2026-11-13\n'),
    );
    expect(ruleIds(result)).toEqual(["F004"]);
    expect(result.entries).toEqual([]);
  });

  it("a stray quote in an unquoted cell is kept as text", async () => {
    const result = await parseRoomingList(
      csv('Last Name,Arrival,Departure\nO"Brien,2026-11-10,2026-11-12\n'),
    );
    expect(result.issues).toEqual([]);
    expect(result.entries[0]?.lastName).toBe('O"Brien');
  });
});

describe("parseRoomingList on very large files", () => {
  it("F007: a 5 MB CSV with over 200,000 short rows is reported, not a stack overflow", async () => {
    // Regression: spreading one Math.max argument per row crashed with "Maximum call stack size exceeded".
    const header = "Last Name,Arrival,Departure\n";
    const row = "A,2026-11-10,2026-11-11\n";
    const text = header + row.repeat(Math.ceil((5 * 1024 * 1024) / row.length));
    const result = await parseRoomingList(csv(text), { maxRows: 5000 });
    expect(ruleIds(result)).toEqual(["F007"]);
    // Reading stops once the file is clearly over the limit, so the total is not counted.
    expect(result.rowCount).toBeGreaterThan(5000);
    expect(result.rowCount).toBeLessThan(200_000);
    expect(result.issues[0]?.message).toBe(
      "The file has more than 5000 guest rows; the limit is 5000. Split it into smaller files.",
    );
    expect(result.entries).toEqual([]);
    // About 0.8 s normally; coverage instrumentation makes it several times slower.
  }, 30_000);

  it("a wide row far to the right of the header still warns once per headerless column", async () => {
    const result = await parseRoomingList(
      csv("Last Name,Arrival,Departure\nA,2026-11-10,2026-11-11,x,y\n"),
    );
    expect(result.issues.map((issue) => issue.ruleId)).toEqual([
      "W201",
      "W201",
    ]);
  });
});
