import { describe, expect, it } from "vitest";
import type {
  BlockContext,
  Issue,
  ParsedEntry,
  RoomingList,
} from "../model.js";
import { type IsoDate, parseIsoDate } from "../plain-date.js";
import {
  createRuleContext,
  type RuleContext,
  r001LastNameRequired,
  r003DepartureNotAfterArrival,
  r004StayOutsideBlock,
  r005RoomTypeUnknown,
  r007NoOccupants,
  r008EmailInvalid,
  r009LineDuplicate,
  r010SharerNotFound,
  r011SharerSelf,
  r012SharerChain,
  r013OccupancyExceedsMax,
  w202StayInShoulder,
  w203DuplicateGuest,
  w204RoomTypeMissing,
  w206SharerMismatch,
} from "./rules.js";

function date(text: string): IsoDate {
  const parsed = parseIsoDate(text);
  if (parsed === undefined) throw new Error(`bad test date ${text}`);
  return parsed;
}

type EntryInput = Omit<
  Partial<ParsedEntry>,
  "arrivalDate" | "departureDate"
> & {
  arrivalDate?: string;
  departureDate?: string;
};

type BlockInput = Omit<Partial<BlockContext>, "startDate" | "endDate"> & {
  startDate?: string;
  endDate?: string;
};

function makeEntry(input: EntryInput, index: number): ParsedEntry {
  const { arrivalDate, departureDate, ...rest } = input;
  return {
    line: index + 1,
    lastName: "Okafor",
    rooms: 1,
    adults: 1,
    children: 0,
    infants: 0,
    ...rest,
    arrivalDate: date(arrivalDate ?? "2026-11-10"),
    departureDate: date(departureDate ?? "2026-11-13"),
  };
}

function makeBlock(input: BlockInput): BlockContext {
  const { startDate, endDate, ...rest } = input;
  return {
    shoulderDays: 0,
    ...rest,
    ...(startDate !== undefined ? { startDate: date(startDate) } : {}),
    ...(endDate !== undefined ? { endDate: date(endDate) } : {}),
  };
}

function makeList(entries: EntryInput[], block?: BlockInput): RoomingList {
  return {
    entries: entries.map(makeEntry),
    ...(block !== undefined ? { block: makeBlock(block) } : {}),
  };
}

function run(
  rule: (ctx: RuleContext) => Issue[],
  list: RoomingList,
  entryRows?: number[],
): Issue[] {
  return rule(createRuleContext(list, entryRows));
}

const BLOCK = {
  startDate: "2026-11-10",
  endDate: "2026-11-14",
  shoulderDays: 1,
};

describe("R001 LAST_NAME_REQUIRED", () => {
  it("flags an empty last name", () => {
    const issues = run(
      r001LastNameRequired,
      makeList([{}, { lastName: "  " }]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "R001",
      code: "LAST_NAME_REQUIRED",
      severity: "error",
      line: 2,
      field: "lastName",
    });
  });

  it("flags a missing last name", () => {
    const list = makeList([{}]);
    const [entry] = list.entries;
    if (entry === undefined) throw new Error("no entry");
    delete entry.lastName;
    expect(run(r001LastNameRequired, list)).toHaveLength(1);
  });

  it("accepts a present last name", () => {
    expect(run(r001LastNameRequired, makeList([{}]))).toEqual([]);
  });
});

describe("R003 DEPARTURE_NOT_AFTER_ARRIVAL", () => {
  it("flags departure equal to arrival", () => {
    const issues = run(
      r003DepartureNotAfterArrival,
      makeList([{ departureDate: "2026-11-10" }]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "R003",
      code: "DEPARTURE_NOT_AFTER_ARRIVAL",
      severity: "error",
      line: 1,
      field: "departureDate",
      value: "2026-11-10",
    });
  });

  it("flags departure before arrival", () => {
    expect(
      run(
        r003DepartureNotAfterArrival,
        makeList([{ departureDate: "2026-11-09" }]),
      ),
    ).toHaveLength(1);
  });

  it("accepts a stay of one night", () => {
    expect(
      run(
        r003DepartureNotAfterArrival,
        makeList([{ departureDate: "2026-11-11" }]),
      ),
    ).toEqual([]);
  });

  it("skips entries with a missing date", () => {
    const list = makeList([{}]);
    const [entry] = list.entries;
    if (entry === undefined) throw new Error("no entry");
    delete entry.arrivalDate;
    expect(run(r003DepartureNotAfterArrival, list)).toEqual([]);
  });
});

describe("R004 STAY_OUTSIDE_BLOCK", () => {
  it("flags an arrival more than the shoulder before the block", () => {
    const issues = run(
      r004StayOutsideBlock,
      makeList([{ arrivalDate: "2026-11-08" }], BLOCK),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "R004",
      code: "STAY_OUTSIDE_BLOCK",
      severity: "error",
      line: 1,
      field: "arrivalDate",
      value: "2026-11-08",
    });
  });

  it("does not flag an arrival on the first shoulder day (that is W202)", () => {
    expect(
      run(
        r004StayOutsideBlock,
        makeList([{ arrivalDate: "2026-11-09" }], BLOCK),
      ),
    ).toEqual([]);
  });

  it("flags a departure beyond the shoulder", () => {
    const issues = run(
      r004StayOutsideBlock,
      makeList([{ departureDate: "2026-11-16" }], BLOCK),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "R004",
      line: 1,
      field: "departureDate",
      value: "2026-11-16",
    });
  });

  it("does not flag a departure on the last shoulder day", () => {
    expect(
      run(
        r004StayOutsideBlock,
        makeList([{ departureDate: "2026-11-15" }], BLOCK),
      ),
    ).toEqual([]);
  });

  it("does nothing without a block", () => {
    expect(
      run(r004StayOutsideBlock, makeList([{ arrivalDate: "2020-01-01" }])),
    ).toEqual([]);
  });

  it("does nothing when the block has no dates", () => {
    expect(
      run(
        r004StayOutsideBlock,
        makeList([{ arrivalDate: "2020-01-01" }], { roomTypes: ["KING"] }),
      ),
    ).toEqual([]);
  });

  it("checks only the start side when only startDate is given", () => {
    const block = { startDate: "2026-11-10", shoulderDays: 1 };
    const early = run(
      r004StayOutsideBlock,
      makeList([{ arrivalDate: "2026-11-08" }], block),
    );
    expect(early).toHaveLength(1);
    expect(early[0]).toMatchObject({ field: "arrivalDate" });
    expect(
      run(
        r004StayOutsideBlock,
        makeList([{ departureDate: "2027-05-01" }], block),
      ),
    ).toEqual([]);
  });
});

describe("R005 ROOM_TYPE_UNKNOWN", () => {
  it("flags a room type not in the block", () => {
    const issues = run(
      r005RoomTypeUnknown,
      makeList([{ roomType: "SUITE" }], { roomTypes: ["KING", "TWIN"] }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "R005",
      code: "ROOM_TYPE_UNKNOWN",
      severity: "error",
      line: 1,
      field: "roomType",
      value: "SUITE",
    });
  });

  it("matches case-insensitively", () => {
    expect(
      run(
        r005RoomTypeUnknown,
        makeList([{ roomType: "king" }], { roomTypes: ["KING"] }),
      ),
    ).toEqual([]);
  });

  it("does nothing when roomTypes is empty or absent", () => {
    expect(
      run(
        r005RoomTypeUnknown,
        makeList([{ roomType: "SUITE" }], { roomTypes: [] }),
      ),
    ).toEqual([]);
    expect(
      run(r005RoomTypeUnknown, makeList([{ roomType: "SUITE" }], {})),
    ).toEqual([]);
    expect(run(r005RoomTypeUnknown, makeList([{ roomType: "SUITE" }]))).toEqual(
      [],
    );
  });

  it("ignores entries with no room type (that is W204)", () => {
    expect(
      run(r005RoomTypeUnknown, makeList([{}], { roomTypes: ["KING"] })),
    ).toEqual([]);
  });
});

describe("R007 OCCUPANCY_INVALID", () => {
  it("flags adults 0 and children 0", () => {
    const issues = run(r007NoOccupants, makeList([{ adults: 0, children: 0 }]));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "R007",
      code: "OCCUPANCY_INVALID",
      severity: "error",
      line: 1,
      field: "adults",
    });
  });

  it("accepts adults 0 with one child", () => {
    expect(
      run(r007NoOccupants, makeList([{ adults: 0, children: 1 }])),
    ).toEqual([]);
  });

  it("accepts one adult", () => {
    expect(run(r007NoOccupants, makeList([{}]))).toEqual([]);
  });
});

describe("R008 EMAIL_INVALID", () => {
  it("flags a malformed email", () => {
    const issues = run(r008EmailInvalid, makeList([{ email: "not-an-email" }]));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "R008",
      code: "EMAIL_INVALID",
      severity: "error",
      line: 1,
      field: "email",
      value: "not-an-email",
    });
  });

  it("accepts a valid email and a missing email", () => {
    expect(
      run(r008EmailInvalid, makeList([{ email: "ada@example.com" }, {}])),
    ).toEqual([]);
  });
});

describe("R009 LINE_DUPLICATE", () => {
  it("reports the second and third occurrence but not the first", () => {
    const issues = run(
      r009LineDuplicate,
      makeList([{ line: 5 }, { line: 6 }, { line: 5 }, { line: 5 }]),
    );
    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.line)).toEqual([5, 5]);
    expect(issues[0]).toMatchObject({
      ruleId: "R009",
      code: "LINE_DUPLICATE",
      severity: "error",
      field: "line",
      value: "5",
    });
    expect(issues[0]?.message).toContain("Line 5");
  });

  it("accepts unique lines", () => {
    expect(run(r009LineDuplicate, makeList([{}, {}]))).toEqual([]);
  });

  it("names the right rows for the duplicates", () => {
    const issues = run(
      r009LineDuplicate,
      makeList([{ line: 1 }, { line: 1 }, { line: 1 }]),
      [2, 3, 4],
    );
    expect(issues.map((issue) => issue.row)).toEqual([3, 4]);
  });
});

describe("R010 SHARER_NOT_FOUND", () => {
  it("flags a sharesWithLine that matches no entry", () => {
    const issues = run(
      r010SharerNotFound,
      makeList([{}, { sharesWithLine: 9 }]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "R010",
      code: "SHARER_NOT_FOUND",
      severity: "error",
      line: 2,
      field: "sharesWithLine",
      value: "9",
    });
  });

  it("accepts a sharer pointing at an existing line", () => {
    expect(
      run(r010SharerNotFound, makeList([{}, { sharesWithLine: 1 }])),
    ).toEqual([]);
  });

  it("does not report a self-reference (that is R011)", () => {
    expect(run(r010SharerNotFound, makeList([{ sharesWithLine: 1 }]))).toEqual(
      [],
    );
  });
});

describe("R011 SHARER_SELF", () => {
  it("flags an entry that shares with its own line, and only R011", () => {
    const list = makeList([{ sharesWithLine: 1 }]);
    const issues = run(r011SharerSelf, list);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "R011",
      code: "SHARER_SELF",
      severity: "error",
      line: 1,
      field: "sharesWithLine",
      value: "1",
    });
    expect(run(r010SharerNotFound, list)).toEqual([]);
  });

  it("accepts a normal sharer and entries with no sharesWithLine", () => {
    expect(run(r011SharerSelf, makeList([{}, { sharesWithLine: 1 }]))).toEqual(
      [],
    );
  });
});

describe("R012 SHARER_CHAIN", () => {
  it("flags line 3 only for the chain 3 to 2 to 1", () => {
    const issues = run(
      r012SharerChain,
      makeList([{}, { sharesWithLine: 1 }, { sharesWithLine: 2 }]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "R012",
      code: "SHARER_CHAIN",
      severity: "error",
      line: 3,
      field: "sharesWithLine",
    });
  });

  it("accepts a sharer of a primary", () => {
    expect(run(r012SharerChain, makeList([{}, { sharesWithLine: 1 }]))).toEqual(
      [],
    );
  });

  it("does not flag a missing target (R010) or a self-reference (R011)", () => {
    expect(
      run(
        r012SharerChain,
        makeList([{ sharesWithLine: 1 }, { sharesWithLine: 9 }]),
      ),
    ).toEqual([]);
  });
});

describe("R013 OCCUPANCY_EXCEEDS_MAX", () => {
  const block = { maxOccupancy: { KING: 3 } };

  it("accepts a primary and a sharer that total the maximum", () => {
    const list = makeList(
      [{ roomType: "KING", adults: 2 }, { sharesWithLine: 1 }],
      block,
    );
    expect(run(r013OccupancyExceedsMax, list)).toEqual([]);
  });

  it("flags the primary only when another sharer exceeds the maximum", () => {
    const list = makeList(
      [
        { roomType: "KING", adults: 2 },
        { sharesWithLine: 1 },
        { sharesWithLine: 1 },
      ],
      block,
    );
    const issues = run(r013OccupancyExceedsMax, list);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "R013",
      code: "OCCUPANCY_EXCEEDS_MAX",
      severity: "error",
      line: 1,
      field: "roomType",
      value: "KING",
    });
  });

  it("does nothing for a primary with no room type", () => {
    expect(
      run(r013OccupancyExceedsMax, makeList([{ adults: 9 }], block)),
    ).toEqual([]);
  });

  it("does nothing for a room type with no maximum", () => {
    expect(
      run(
        r013OccupancyExceedsMax,
        makeList([{ roomType: "TWIN", adults: 9 }], block),
      ),
    ).toEqual([]);
  });

  it("does nothing without a block or without maxOccupancy", () => {
    expect(
      run(r013OccupancyExceedsMax, makeList([{ roomType: "KING", adults: 9 }])),
    ).toEqual([]);
    expect(
      run(
        r013OccupancyExceedsMax,
        makeList([{ roomType: "KING", adults: 9 }], {}),
      ),
    ).toEqual([]);
  });

  it("looks the room type up case-insensitively", () => {
    const issues = run(
      r013OccupancyExceedsMax,
      makeList([{ roomType: "king", adults: 4 }], block),
    );
    expect(issues).toHaveLength(1);
  });
});

describe("W202 STAY_IN_SHOULDER", () => {
  it("warns for an arrival on a shoulder day, and not R004", () => {
    const list = makeList([{ arrivalDate: "2026-11-09" }], BLOCK);
    const issues = run(w202StayInShoulder, list);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "W202",
      code: "STAY_IN_SHOULDER",
      severity: "warning",
      line: 1,
      field: "arrivalDate",
      value: "2026-11-09",
    });
    expect(run(r004StayOutsideBlock, list)).toEqual([]);
  });

  it("does not warn when the arrival is beyond the shoulder (that is R004)", () => {
    expect(
      run(w202StayInShoulder, makeList([{ arrivalDate: "2026-11-08" }], BLOCK)),
    ).toEqual([]);
  });

  it("warns for a departure on a shoulder day", () => {
    const issues = run(
      w202StayInShoulder,
      makeList([{ departureDate: "2026-11-15" }], BLOCK),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "W202",
      field: "departureDate",
      value: "2026-11-15",
    });
  });

  it("does not warn when the departure is beyond the shoulder (that is R004)", () => {
    expect(
      run(
        w202StayInShoulder,
        makeList([{ departureDate: "2026-11-16" }], BLOCK),
      ),
    ).toEqual([]);
  });

  it("does not warn for a stay inside the block", () => {
    expect(
      run(
        w202StayInShoulder,
        makeList(
          [{ arrivalDate: "2026-11-10", departureDate: "2026-11-14" }],
          BLOCK,
        ),
      ),
    ).toEqual([]);
  });

  it("does nothing without a block or without block dates", () => {
    expect(
      run(w202StayInShoulder, makeList([{ arrivalDate: "2026-11-09" }])),
    ).toEqual([]);
    expect(
      run(
        w202StayInShoulder,
        makeList([{ arrivalDate: "2026-11-09" }], { shoulderDays: 1 }),
      ),
    ).toEqual([]);
  });

  it("checks only the start side when only startDate is given", () => {
    const block = { startDate: "2026-11-10", shoulderDays: 1 };
    expect(
      run(w202StayInShoulder, makeList([{ arrivalDate: "2026-11-09" }], block)),
    ).toHaveLength(1);
    expect(
      run(
        w202StayInShoulder,
        makeList([{ departureDate: "2027-05-01" }], block),
      ),
    ).toEqual([]);
  });
});

describe("W203 DUPLICATE_GUEST", () => {
  it("warns on the later line and names the earlier line, ignoring accents and case", () => {
    const list = makeList([
      { lastName: "Müller", firstName: "José" },
      { lastName: "MULLER", firstName: "jose", arrivalDate: "2026-11-11" },
    ]);
    const issues = run(w203DuplicateGuest, list);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "W203",
      code: "DUPLICATE_GUEST",
      severity: "warning",
      line: 2,
    });
    expect(issues[0]?.field).toBeDefined();
    expect(issues[0]?.message).toContain("line 1");
  });

  it("does not warn for back-to-back stays", () => {
    const list = makeList([
      { arrivalDate: "2026-11-10", departureDate: "2026-11-13" },
      { arrivalDate: "2026-11-13", departureDate: "2026-11-15" },
    ]);
    expect(run(w203DuplicateGuest, list)).toEqual([]);
  });

  it("does not warn when one is the other's sharer", () => {
    expect(
      run(w203DuplicateGuest, makeList([{}, { sharesWithLine: 1 }])),
    ).toEqual([]);
    expect(
      run(w203DuplicateGuest, makeList([{ sharesWithLine: 2 }, {}])),
    ).toEqual([]);
  });

  it("does not warn for different names", () => {
    expect(
      run(
        w203DuplicateGuest,
        makeList([{ firstName: "Ada" }, { firstName: "Bola" }]),
      ),
    ).toEqual([]);
  });

  it("does not warn when a date is missing", () => {
    const list = makeList([{}, {}]);
    const [, second] = list.entries;
    if (second === undefined) throw new Error("no entry");
    delete second.departureDate;
    expect(run(w203DuplicateGuest, list)).toEqual([]);
  });
});

describe("W204 ROOM_TYPE_MISSING", () => {
  it("warns when the block has room types and the entry has none", () => {
    const issues = run(
      w204RoomTypeMissing,
      makeList([{}], { roomTypes: ["KING"] }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "W204",
      code: "ROOM_TYPE_MISSING",
      severity: "warning",
      line: 1,
      field: "roomType",
    });
  });

  it("accepts an entry with a room type, whatever its case", () => {
    expect(
      run(
        w204RoomTypeMissing,
        makeList([{ roomType: "king" }], { roomTypes: ["KING"] }),
      ),
    ).toEqual([]);
  });

  it("does nothing when roomTypes is empty or absent", () => {
    expect(run(w204RoomTypeMissing, makeList([{}], { roomTypes: [] }))).toEqual(
      [],
    );
    expect(run(w204RoomTypeMissing, makeList([{}], {}))).toEqual([]);
    expect(run(w204RoomTypeMissing, makeList([{}]))).toEqual([]);
  });
});

describe("W206 SHARER_MISMATCH", () => {
  it("warns about a different departure date", () => {
    const list = makeList([
      {},
      { sharesWithLine: 1, departureDate: "2026-11-12" },
    ]);
    const issues = run(w206SharerMismatch, list);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "W206",
      code: "SHARER_MISMATCH",
      severity: "warning",
      line: 2,
      field: "sharesWithLine",
    });
    expect(issues[0]?.message).toContain("departure date");
    expect(issues[0]?.message).not.toContain("arrival date");
  });

  it("does not warn when everything matches", () => {
    expect(
      run(
        w206SharerMismatch,
        makeList([
          { roomType: "KING" },
          { sharesWithLine: 1, roomType: "KING" },
        ]),
      ),
    ).toEqual([]);
  });

  it("warns about a different room type", () => {
    const list = makeList([
      { roomType: "KING" },
      { sharesWithLine: 1, roomType: "TWIN" },
    ]);
    expect(run(w206SharerMismatch, list)[0]?.message).toContain("room type");
  });

  it("does not warn when the target is missing", () => {
    expect(
      run(
        w206SharerMismatch,
        makeList([{ sharesWithLine: 9, departureDate: "2026-11-12" }]),
      ),
    ).toEqual([]);
  });

  it("does not warn when the target is itself a sharer", () => {
    const list = makeList([
      {},
      { sharesWithLine: 1 },
      { sharesWithLine: 2, departureDate: "2026-11-12" },
    ]);
    expect(run(w206SharerMismatch, list)).toEqual([]);
  });
});

describe("createRuleContext", () => {
  it("adds row and a 'Row N: ' prefix when entryRows is given", () => {
    const issues = run(r001LastNameRequired, makeList([{ lastName: "" }]), [7]);
    expect(issues[0]?.row).toBe(7);
    expect(issues[0]?.message.startsWith("Row 7: ")).toBe(true);
  });

  it("has no row key and a 'Line N: ' prefix without entryRows", () => {
    const issues = run(r001LastNameRequired, makeList([{}, { lastName: "" }]));
    expect(issues[0]).toBeDefined();
    expect(issues[0] !== undefined && "row" in issues[0]).toBe(false);
    expect(issues[0]?.message.startsWith("Line 2: ")).toBe(true);
  });

  it("indexes the first entry for each line number", () => {
    const ctx = createRuleContext(
      makeList([{ line: 4 }, { line: 4 }, { line: 5 }]),
    );
    expect(ctx.indexByLine.get(4)).toBe(0);
    expect(ctx.indexByLine.get(5)).toBe(2);
  });
});

describe("W206 SHARER_MISMATCH (review fixes)", () => {
  it("W206: names a different arrival date", () => {
    const list = makeList([
      {},
      { sharesWithLine: 1, arrivalDate: "2026-11-11" },
    ]);
    const issues = run(w206SharerMismatch, list);
    expect(issues[0]?.message).toContain("arrival date");
    expect(issues[0]?.message).not.toContain("departure date");
  });

  it("W206: a missing date (already R002) is not compared", () => {
    const list = makeList([{}, { sharesWithLine: 1 }]);
    const sharer = list.entries[1];
    if (sharer === undefined) throw new Error("test setup");
    const { arrivalDate: _a, departureDate: _d, ...noDates } = sharer;
    expect(
      run(w206SharerMismatch, {
        entries: [list.entries[0] ?? sharer, noDates],
      }),
    ).toEqual([]);
  });
});

describe("W203 DUPLICATE_GUEST (review fixes)", () => {
  it("W203: 'later' means the higher line number, not file position", () => {
    const list = makeList([
      { line: 5, firstName: "Ada" },
      { line: 3, firstName: "Ada" },
    ]);
    const issues = run(w203DuplicateGuest, list);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.line).toBe(5);
    expect(issues[0]?.message).toContain("line 3");
  });
});

describe("R004 STAY_OUTSIDE_BLOCK (review fixes)", () => {
  it("R004: a stay outside both ends gives one issue per side", () => {
    const list = makeList(
      [{ arrivalDate: "2026-11-01", departureDate: "2026-11-20" }],
      BLOCK,
    );
    const issues = run(r004StayOutsideBlock, list);
    expect(issues.map((issue) => issue.field)).toEqual([
      "arrivalDate",
      "departureDate",
    ]);
  });
});
