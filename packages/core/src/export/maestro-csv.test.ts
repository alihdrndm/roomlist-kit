import { describe, expect, it } from "vitest";
import type { ParsedEntry, RoomingList } from "../model.js";
import { exportRoomingList } from "./export.js";
import { date, we1List } from "./test-helpers.js";
import { ExportPreconditionError } from "./types.js";

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

const block = { groupReservationNumber: "48213", shoulderDays: 0 };
const decode = async (list: RoomingList, options?: unknown) =>
  new TextDecoder().decode(
    (await exportRoomingList(list, "maestro-csv", options)).bytes,
  );

async function issuesOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ExportPreconditionError) return error.issues;
    throw error;
  }
  throw new Error("expected the export to be refused");
}

describe("maestro-csv", () => {
  it("maestro-csv: gender M→m, F→f, anything else→u", async () => {
    const list: RoomingList = {
      block,
      entries: [
        entry({ line: 1, gender: "M" }),
        entry({ line: 2, gender: "F" }),
        entry({ line: 3, gender: "X" }),
        entry({ line: 4 }),
      ],
    };
    const rows = (await decode(list, { buildingCode: "B" }))
      .trim()
      .split("\r\n");
    expect(rows.map((row) => row.split(",").at(-1))).toEqual([
      "m",
      "f",
      "u",
      "u",
    ]);
  });

  it("maestro-csv: a room type with a slash is used as it is", async () => {
    const list: RoomingList = {
      block,
      entries: [
        entry({ line: 1, roomType: "TOWER/KING" }),
        entry({ line: 2, roomType: "QQ" }),
      ],
    };
    const rows = (await decode(list, { buildingCode: "MAIN" }))
      .trim()
      .split("\r\n");
    expect(rows[0]).toContain(",TOWER/KING,");
    expect(rows[1]).toContain(",MAIN/QQ,");
  });

  it("maestro-csv: buildingCode is not needed when every room type has a slash", async () => {
    const list: RoomingList = {
      block,
      entries: [entry({ line: 1, roomType: "TOWER/KING" })],
    };
    expect(await decode(list)).toContain(",TOWER/KING,");
  });

  it("maestro-csv: includeHeader writes the column names first", async () => {
    const text = await decode(await we1List(), {
      buildingCode: "MAIN",
      includeHeader: true,
    });
    expect(text.split("\r\n")[0]).toBe(
      "Suffix No.,Group Res.,First Name,Last Name,Sharer_Suffix,Building/Room Type,Arrival Date,Departure Date,#Adults,#Children,#Infants,Gender",
    );
  });

  it("maestro-csv: quotes a value that contains a comma, and never writes a blank line", async () => {
    const list: RoomingList = {
      block,
      entries: [entry({ line: 1, lastName: "Smith, Jr" })],
    };
    const text = await decode(list, { buildingCode: "B" });
    expect(text).toContain('"Smith, Jr"');
    expect(text).not.toMatch(/\r\n\r\n/);
    expect(text.endsWith("\r\n")).toBe(true);
  });

  it("maestro-csv: children and infants are always numbers", async () => {
    const text = await decode(
      { block, entries: [entry({ line: 1 })] },
      { buildingCode: "B" },
    );
    expect(text).toContain(",1,0,0,u\r\n");
  });

  it("X001 maestro-csv: group reservation number is required", async () => {
    const issues = await issuesOf(
      exportRoomingList({ entries: [entry({ line: 1 })] }, "maestro-csv", {
        buildingCode: "B",
      }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "X001",
      code: "EXPORT_FIELD_REQUIRED",
      severity: "error",
      field: "groupReservationNumber",
    });
  });

  it("X001 maestro-csv: every entry needs a first name and a room type", async () => {
    const { firstName: _omit, ...noFirst } = entry({
      line: 1,
      roomType: "A/B",
    });
    const { roomType: _omit2, ...noRoom } = entry({ line: 2 });
    const issues = await issuesOf(
      exportRoomingList({ block, entries: [noFirst, noRoom] }, "maestro-csv", {
        buildingCode: "B",
      }),
    );
    expect(issues.map((issue) => [issue.line, issue.field])).toEqual([
      [1, "firstName"],
      [2, "roomType"],
    ]);
  });

  it("X001 maestro-csv: buildingCode is required when any room type lacks a slash", async () => {
    const issues = await issuesOf(
      exportRoomingList(
        { block, entries: [entry({ line: 1 })] },
        "maestro-csv",
      ),
    );
    expect(issues.map((issue) => issue.field)).toEqual(["buildingCode"]);
  });

  it("maestro-csv: sharer row carries the primary's suffix, written after it", async () => {
    const list: RoomingList = {
      block,
      entries: [entry({ line: 5, sharesWithLine: 9 }), entry({ line: 9 })],
    };
    const rows = (await decode(list, { buildingCode: "B" }))
      .trim()
      .split("\r\n");
    expect(rows[0]?.startsWith("1,")).toBe(true);
    expect(rows[1]?.split(",")[4]).toBe("1");
  });
});

describe("maestro-csv quoting of line breaks", () => {
  it("maestro-csv: a value containing a lone newline or carriage return is quoted, so a record stays on one line", async () => {
    const list: RoomingList = {
      block: { groupReservationNumber: "48\n213", shoulderDays: 0 },
      entries: [
        entry({ line: 1, roomType: "KING\nSUITE" }),
        entry({ line: 2, lastName: "Ok\rafor", roomType: "KING\nSUITE" }),
      ],
    };
    const text = await decode(list, { buildingCode: "MAIN" });
    expect(text).toContain('"48\n213"');
    expect(text).toContain('"Ok\rafor"');
    // Splitting only on the record delimiter must still give exactly two records.
    expect(text.split("\r\n").filter((row) => row !== "")).toHaveLength(2);
  });
});

describe("X001 maestro-csv empty strings", () => {
  it("X001 maestro-csv: an empty first name or empty room type counts as missing", async () => {
    const issues = await issuesOf(
      exportRoomingList(
        {
          block,
          entries: [
            entry({ line: 1, firstName: "" }),
            entry({ line: 2, roomType: "" }),
          ],
        },
        "maestro-csv",
        {
          buildingCode: "B",
        },
      ),
    );
    expect(issues.map((issue) => [issue.line, issue.field])).toEqual([
      [1, "firstName"],
      [2, "roomType"],
    ]);
  });
});
