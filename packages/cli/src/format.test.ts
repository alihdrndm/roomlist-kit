import {
  type DiffReport,
  IsoDateSchema,
  type Issue,
  RoomingEntrySchema,
  type Summary,
  type TargetInfo,
} from "@alihdrndm/roomlist-core";
import { describe, expect, it } from "vitest";
import {
  type Colorize,
  colorFor,
  formatDiff,
  formatIssues,
  formatSummary,
  formatTargets,
  plain,
  shouldUseColor,
  signed,
} from "./format.js";

const error: Issue = {
  severity: "error",
  ruleId: "R002",
  code: "DATE_INVALID",
  message: "Bad date",
  row: 4,
  field: "arrivalDate",
};
const warning: Issue = {
  severity: "warning",
  ruleId: "W201",
  code: "UNMAPPED_COLUMN",
  message: "Unmapped column",
};

/** Marks styled text so tests can see where colour would be applied. */
const tagged: Colorize = (style, text) => `<${style}>${text}</${style}>`;

describe("formatIssues", () => {
  it("prints the header and one row per issue", () => {
    const text = formatIssues([error, warning]);
    expect(text).toContain("Severity");
    expect(text).toContain("Row");
    expect(text).toContain("Field");
    expect(text).toContain("Code");
    expect(text).toContain("Message");
    expect(text).toContain("DATE_INVALID");
    expect(text).toContain("arrivalDate");
    expect(text).toContain("1 error, 1 warning");
  });

  it("shows severity as words and a dash for a missing row", () => {
    const lines = formatIssues([warning]).split("\n");
    expect(lines[1]).toMatch(/^warning\s+-\s+-\s+UNMAPPED_COLUMN/);
  });

  it("adds no escape codes when colour is disabled", () => {
    expect(formatIssues([error, warning], plain)).not.toContain("\u001b[");
  });

  it("colours errors red and warnings yellow but keeps the words", () => {
    const text = formatIssues([error, warning], tagged);
    expect(text).toContain("<red>error   </red>");
    expect(text).toContain("<yellow>warning </yellow>");
  });

  it("says so when there are no issues", () => {
    expect(formatIssues([])).toBe("No issues found.");
  });
});

describe("formatSummary", () => {
  const summary: Summary = {
    entries: 3,
    primaries: 2,
    sharers: 1,
    rooms: 2,
    people: 4,
    roomNights: 9,
    firstArrival: IsoDateSchema.parse("2026-11-10"),
    lastDeparture: IsoDateSchema.parse("2026-11-14"),
    byRoomType: [],
    byNight: [{ date: IsoDateSchema.parse("2026-11-10"), rooms: 2 }],
  };

  it("lists the totals and rooms per night", () => {
    const text = formatSummary(summary);
    expect(text).toMatch(/Room nights\s+9/);
    expect(text).toContain("2026-11-10");
    expect(text).toContain("Rooms per night");
  });
});

describe("formatDiff", () => {
  const entry = RoomingEntrySchema.parse({
    line: 2,
    lastName: "Khan",
    firstName: "Ali",
    arrivalDate: "2026-11-10",
    departureDate: "2026-11-12",
    rooms: 1,
    adults: 1,
    children: 0,
    infants: 0,
  });
  const report: DiffReport = {
    summary: {
      added: 1,
      removed: 0,
      changed: 1,
      unchanged: 0,
      roomNightsBefore: 6,
      roomNightsAfter: 2,
      roomNightsDelta: -4,
    },
    added: [entry],
    removed: [],
    changed: [
      {
        before: entry,
        after: entry,
        changes: [
          { field: "email", before: null, after: "a@example.com" },
          { field: "roomType", before: "KING", after: null },
        ],
      },
    ],
  };

  it("shows the room-night change with its sign", () => {
    expect(formatDiff(report)).toContain("(-4)");
  });

  it("shows null as (none) and each change as before to after", () => {
    const text = formatDiff(report);
    expect(text).toContain("email: (none) → a@example.com");
    expect(text).toContain("roomType: KING → (none)");
  });

  it("omits empty sections", () => {
    const text = formatDiff(report);
    expect(text).toContain("Added (1)");
    expect(text).not.toContain("Removed (");
  });
});

describe("signed", () => {
  it("adds a plus sign to positive numbers only", () => {
    expect(signed(4)).toBe("+4");
    expect(signed(-2)).toBe("-2");
    expect(signed(0)).toBe("0");
  });
});

describe("formatTargets", () => {
  const targets: TargetInfo[] = [
    {
      id: "maestro-csv",
      label: "Maestro",
      fileExtension: ".csv",
      contentType: "text/csv",
      optionsSchema: {},
      provenance: [
        { aspect: "Column order", status: "assumed", source: "guide" },
        { aspect: "Date format", status: "verified", source: "guide" },
      ],
    },
  ];

  it("lists id, label, extension and each provenance item", () => {
    const text = formatTargets(targets);
    expect(text).toContain("maestro-csv");
    expect(text).toContain("(.csv)");
    expect(text).toMatch(/assumed\s+Column order/);
    expect(text).toMatch(/verified\s+Date format/);
  });
});

describe("colour rule (spec: no colour when NO_COLOR is set or stdout is not a TTY)", () => {
  it("colour only on a TTY with NO_COLOR unset", () => {
    expect(shouldUseColor({}, true)).toBe(true);
  });

  it("NO_COLOR alone turns colour off, even on a TTY and even when empty", () => {
    expect(shouldUseColor({ NO_COLOR: "1" }, true)).toBe(false);
    expect(shouldUseColor({ NO_COLOR: "" }, true)).toBe(false);
  });

  it("a non-TTY stream alone turns colour off", () => {
    expect(shouldUseColor({}, false)).toBe(false);
  });

  it("FORCE_COLOR does not override NO_COLOR or a non-TTY stream", () => {
    expect(shouldUseColor({ NO_COLOR: "1", FORCE_COLOR: "1" }, true)).toBe(
      false,
    );
    expect(shouldUseColor({ FORCE_COLOR: "1" }, false)).toBe(false);
  });

  it("colorFor adds escape codes only when the rule allows it", () => {
    const tty = { isTTY: true } as NodeJS.WriteStream;
    const pipe = { isTTY: false } as NodeJS.WriteStream;
    expect(colorFor(tty, {})("red", "error")).toContain("\u001b[");
    expect(colorFor(tty, { NO_COLOR: "1" })("red", "error")).toBe("error");
    expect(colorFor(pipe, {})("red", "error")).toBe("error");
  });
});
