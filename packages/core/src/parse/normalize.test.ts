import { describe, expect, it } from "vitest";
import type { CanonicalField } from "../model.js";
import { DateOrderEvidence } from "./dates.js";
import { cleanName, normalizeRow, splitFullName } from "./normalize.js";

/** Builds a one-row context from a field → cell text record. */
function run(
  cells: Partial<Record<CanonicalField, string>>,
  extra: { useFullName?: boolean; dateOrder?: "MDY" | "DMY" } = {},
) {
  const fields = Object.keys(cells) as CanonicalField[];
  const fieldIndex = new Map(fields.map((field, index) => [field, index]));
  return normalizeRow(
    fields.map((field) => cells[field] ?? ""),
    {
      row: 7,
      entryNumber: 3,
      fieldIndex,
      dateOrder: extra.dateOrder ?? "MDY",
      useFullName: extra.useFullName ?? false,
      evidence: new DateOrderEvidence(),
    },
  );
}

const base = {
  lastName: "Okafor",
  arrivalDate: "2026-11-10",
  departureDate: "2026-11-13",
};

describe("names", () => {
  it("trims and collapses whitespace, keeping letter case", () => {
    expect(cleanName("  Mc  Donald \t")).toBe("Mc Donald");
    const { entry } = run({
      ...base,
      lastName: "  van  der Berg ",
      firstName: " Ada  Grace ",
    });
    expect(entry).toMatchObject({
      lastName: "van der Berg",
      firstName: "Ada Grace",
    });
  });

  it("splits a full name: comma → 'Last, First', else last word is the last name", () => {
    expect(splitFullName("Okafor, Ada")).toEqual({
      lastName: "Okafor",
      firstName: "Ada",
    });
    expect(splitFullName("Ada Grace Okafor")).toEqual({
      lastName: "Okafor",
      firstName: "Ada Grace",
    });
    expect(splitFullName("Okafor")).toEqual({
      lastName: "Okafor",
      firstName: "",
    });
  });

  it("uses the fullName column when told to", () => {
    const { entry } = run(
      {
        fullName: "Okafor, Ada",
        arrivalDate: "2026-11-10",
        departureDate: "2026-11-13",
      },
      { useFullName: true },
    );
    expect(entry).toMatchObject({ lastName: "Okafor", firstName: "Ada" });
  });

  it("leaves lastName unset when the cell is blank (R001 is raised by validation)", () => {
    const { entry, issues } = run({ ...base, lastName: "   " });
    expect(entry.lastName).toBeUndefined();
    expect(issues).toEqual([]);
  });
});

describe("field normalisation", () => {
  it("applies case rules and omits blank optional fields", () => {
    const { entry } = run({
      ...base,
      email: " Ada.Okafor@Example.COM ",
      roomType: "king",
      nationality: "ng",
      language: "en",
      phone: " 555-0100 ",
      title: "Dr",
      confirmationNumber: "",
      passport: "X123",
      specialRequests: "Late arrival",
      travelAgentLocator: "ABC123",
    });
    expect(entry).toEqual({
      line: 3,
      lastName: "Okafor",
      title: "Dr",
      email: "ada.okafor@example.com",
      phone: "555-0100",
      arrivalDate: "2026-11-10",
      departureDate: "2026-11-13",
      roomType: "KING",
      rooms: 1,
      adults: 1,
      children: 0,
      infants: 0,
      nationality: "NG",
      language: "EN",
      passport: "X123",
      specialRequests: "Late arrival",
      travelAgentLocator: "ABC123",
    });
  });

  it("keeps keys in canonical-model order", () => {
    const { entry } = run({ travelAgentLocator: "T", ...base, line: "9" });
    expect(Object.keys(entry)).toEqual([
      "line",
      "lastName",
      "arrivalDate",
      "departureDate",
      "rooms",
      "adults",
      "children",
      "infants",
      "travelAgentLocator",
    ]);
  });

  it("uses the line column when present, else file order", () => {
    expect(run({ ...base, line: "12" }).entry.line).toBe(12);
    expect(run(base).entry.line).toBe(3);
  });
});

describe("dates", () => {
  it("R002: an unparseable arrival leaves the field unset and names the column", () => {
    const { entry, issues } = run({ ...base, arrivalDate: "02/30/2026" });
    expect(entry.arrivalDate).toBeUndefined();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "R002",
      row: 7,
      field: "arrivalDate",
      value: "02/30/2026",
    });
    expect(issues[0]?.message).toMatch(/^Row 7: /);
  });

  it("R002: an empty required date is reported; an empty dateOfBirth is not", () => {
    const { issues } = run({ ...base, departureDate: "", dateOfBirth: "" });
    expect(issues.map((issue) => issue.field)).toEqual(["departureDate"]);
  });

  it("R002: a bad dateOfBirth; a good one is converted by dateOrder", () => {
    expect(run({ ...base, dateOfBirth: "31/12/1990" }).issues[0]?.field).toBe(
      "dateOfBirth",
    );
    expect(
      run({ ...base, dateOfBirth: "31/12/1990" }, { dateOrder: "DMY" }).entry
        .dateOfBirth,
    ).toBe("1990-12-31");
  });
});

describe("counts", () => {
  it("defaults: rooms 1, children 0, infants 0, adults 1 when adults and children are blank", () => {
    expect(run(base).entry).toMatchObject({
      rooms: 1,
      adults: 1,
      children: 0,
      infants: 0,
    });
  });

  it("adults defaults to 0 when only children is given", () => {
    expect(run({ ...base, children: "2" }).entry).toMatchObject({
      adults: 0,
      children: 2,
    });
  });

  it("R006: rooms must be an integer of at least 1", () => {
    for (const value of ["0", "1.5", "two", "-1"]) {
      const { issues } = run({ ...base, rooms: value });
      expect(issues.map((issue) => issue.ruleId)).toEqual(["R006"]);
    }
    expect(run({ ...base, rooms: "3" }).entry.rooms).toBe(3);
  });

  it("R007: adults, children and infants must be integers ≥ 0", () => {
    const { entry, issues } = run({
      ...base,
      adults: "one",
      children: "-1",
      infants: "x",
    });
    expect(issues.map((issue) => [issue.ruleId, issue.field])).toEqual([
      ["R007", "adults"],
      ["R007", "children"],
      ["R007", "infants"],
    ]);
    // Invalid cells count as blank for the adults default, so R007 is not repeated later.
    expect(entry).toMatchObject({ adults: 1, children: 0, infants: 0 });
    expect(
      run({ ...base, adults: "2", children: "1", infants: "1" }).entry,
    ).toMatchObject({ adults: 2, children: 1, infants: 1 });
  });

  it("R014: line and sharesWithLine must be integers ≥ 1", () => {
    const { entry, issues } = run({ ...base, line: "1a", sharesWithLine: "0" });
    expect(issues.map((issue) => [issue.ruleId, issue.field])).toEqual([
      ["R014", "line"],
      ["R014", "sharesWithLine"],
    ]);
    expect(entry.line).toBe(3);
    expect(entry.sharesWithLine).toBeUndefined();
    expect(run({ ...base, sharesWithLine: "2" }).entry.sharesWithLine).toBe(2);
  });
});

describe("gender", () => {
  it("maps every listed spelling, case-insensitive", () => {
    const cases: [string, string][] = [
      ["m", "M"],
      ["Male", "M"],
      ["F", "F"],
      ["female", "F"],
      ["x", "X"],
      ["Other", "X"],
      ["nonbinary", "X"],
      ["Non-Binary", "X"],
      ["U", "U"],
      ["unknown", "U"],
    ];
    for (const [text, code] of cases)
      expect(run({ ...base, gender: text }).entry.gender).toBe(code);
  });

  it("W208: unrecognised gender text is dropped with a warning", () => {
    const { entry, issues } = run({ ...base, gender: "mixed" });
    expect(entry.gender).toBeUndefined();
    expect(issues[0]).toMatchObject({
      ruleId: "W208",
      severity: "warning",
      value: "mixed",
    });
  });
});

describe("R015 field length", () => {
  it("R015: a value over its canonical-model limit is reported and left unset", () => {
    const { entry, issues } = run({
      ...base,
      lastName: "x".repeat(81),
      roomType: "R".repeat(21),
      phone: "5".repeat(31),
    });
    expect(issues.map((issue) => [issue.ruleId, issue.field])).toEqual([
      ["R015", "lastName"],
      ["R015", "phone"],
      ["R015", "roomType"],
    ]);
    expect(issues[0]?.value).toHaveLength(80);
    expect(entry.lastName).toBeUndefined();
    expect(entry.roomType).toBeUndefined();
  });

  it("R015: values exactly at the limit pass, and email has no limit", () => {
    const { entry, issues } = run({
      ...base,
      lastName: "x".repeat(80),
      email: `${"a".repeat(300)}@example.com`,
    });
    expect(issues).toEqual([]);
    expect(entry.lastName).toHaveLength(80);
  });

  it("R015: names split from fullName are checked too", () => {
    const { issues } = run(
      {
        fullName: `${"x".repeat(81)}, Ada`,
        arrivalDate: "2026-11-10",
        departureDate: "2026-11-13",
      },
      { useFullName: true },
    );
    expect(issues.map((issue) => issue.field)).toEqual(["lastName"]);
  });
});

describe("integer range", () => {
  it("R014 / R006: integers beyond the safe range are rejected", () => {
    const { issues } = run({
      ...base,
      line: "99999999999999999999",
      rooms: "99999999999999999999",
    });
    expect(issues.map((issue) => issue.ruleId)).toEqual(["R014", "R006"]);
  });
});

describe("issue values", () => {
  it("R002: an empty required date has no value key", () => {
    const { issues } = run({ ...base, arrivalDate: "" });
    expect(issues[0]).not.toHaveProperty("value");
  });

  it("R015: a too-long split first name is not reported when a firstName cell replaces it", () => {
    const { entry, issues } = run(
      {
        fullName: `Okafor, ${"x".repeat(90)}`,
        firstName: "Ada",
        arrivalDate: "2026-11-10",
        departureDate: "2026-11-13",
      },
      { useFullName: true },
    );
    expect(issues).toEqual([]);
    expect(entry.firstName).toBe("Ada");
  });

  it("an explicit firstName column wins over the split fullName", () => {
    const { entry } = run(
      {
        fullName: "Okafor, Ada",
        firstName: "Adaeze",
        arrivalDate: "2026-11-10",
        departureDate: "2026-11-13",
      },
      { useFullName: true },
    );
    expect(entry).toMatchObject({ lastName: "Okafor", firstName: "Adaeze" });
  });
});
