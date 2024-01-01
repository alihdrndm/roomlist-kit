import { describe, expect, it } from "vitest";
import {
  findHeaderRow,
  isBlankRow,
  lookupHeader,
  mapHeaders,
  normaliseHeader,
} from "./headers.js";

describe("normaliseHeader", () => {
  it("lower-cases and strips everything but a-z and 0-9", () => {
    expect(normaliseHeader("Check-In")).toBe("checkin");
    expect(normaliseHeader("# Adults")).toBe("adults");
    expect(normaliseHeader(" E-mail ")).toBe("email");
  });
});

describe("lookupHeader", () => {
  it("maps every alias form from the alias table", () => {
    expect(lookupHeader("Guest Name", undefined)).toBe("fullName");
    expect(lookupHeader("Check Out", undefined)).toBe("departureDate");
    expect(lookupHeader("Building/Room Type", undefined)).toBe("roomType");
    expect(lookupHeader("TA Record Locator", undefined)).toBe(
      "travelAgentLocator",
    );
    expect(lookupHeader("Suffix No.", undefined)).toBe("line");
    expect(lookupHeader("Kids", undefined)).toBe("children");
  });

  it("accepts canonical field names, so canonical-csv reads back in", () => {
    expect(lookupHeader("sharesWithLine", undefined)).toBe("sharesWithLine");
    expect(lookupHeader("travelAgentLocator", undefined)).toBe(
      "travelAgentLocator",
    );
  });

  it("columnMap wins over aliases and null ignores a column", () => {
    expect(
      lookupHeader("Roommate Line", { "Roommate Line": "sharesWithLine" }),
    ).toBe("sharesWithLine");
    expect(lookupHeader("Notes", { Notes: null })).toBeNull();
    expect(lookupHeader("VIP Code", undefined)).toBeNull();
  });
});

describe("findHeaderRow", () => {
  it("skips blank rows and a title row above the header", () => {
    const rows = [
      [""],
      ["TECH26 rooming list", "", ""],
      ["", ""],
      ["Guest Name", "Check-In", "Check Out"],
      ["x"],
    ];
    expect(findHeaderRow(rows, undefined)).toBe(3);
  });

  it("falls back to the first non-blank row when nothing maps", () => {
    expect(findHeaderRow([[""], ["Foo", "Bar"], ["Baz"]], undefined)).toBe(1);
  });

  it("returns -1 when every row is blank", () => {
    expect(findHeaderRow([[""], [" ", ""]], undefined)).toBe(-1);
    expect(isBlankRow([" ", ""])).toBe(true);
  });
});

describe("mapHeaders", () => {
  it("maps the WE1 header with no issues", () => {
    const header = [
      "Line",
      "Last Name",
      "First Name",
      "Arrival",
      "Departure",
      "Room Type",
      "Shares With",
    ];
    const result = mapHeaders(header, undefined, 1);
    expect(result.issues).toEqual([]);
    expect(result.fieldIndex.get("sharesWithLine")).toBe(6);
    expect(result.columns[0]).toEqual({ header: "Line", field: "line" });
  });

  it("W201: warns once per unrecognised column and ignores blank header cells", () => {
    const result = mapHeaders(
      ["Last Name", "Arrival", "Departure", "VIP Code", ""],
      undefined,
      3,
    );
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      ruleId: "W201",
      row: 3,
      value: "VIP Code",
    });
    expect(result.columns).toHaveLength(4);
  });

  it("F006: two headers mapping to the same field", () => {
    const result = mapHeaders(
      ["Last Name", "Surname", "Arrival", "Departure"],
      undefined,
      1,
    );
    expect(result.issues.map((issue) => issue.ruleId)).toEqual(["F006"]);
    expect(result.issues[0]?.message).toContain('"Last Name" and "Surname"');
  });

  it("F005: one issue per missing required column", () => {
    const result = mapHeaders(["First Name", "Room"], undefined, 1);
    expect(result.issues.map((issue) => [issue.ruleId, issue.field])).toEqual([
      ["F005", "lastName"],
      ["F005", "arrivalDate"],
      ["F005", "departureDate"],
    ]);
  });

  it("F005: a fullName column satisfies the last-name requirement", () => {
    expect(
      mapHeaders(["Guest Name", "Arrival", "Departure"], undefined, 1).issues,
    ).toEqual([]);
  });
});
