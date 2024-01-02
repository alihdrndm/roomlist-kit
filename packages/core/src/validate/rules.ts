import { z } from "zod";
import { makeIssue, type RuleId } from "../issues.js";
import type {
  BlockContext,
  EntryField,
  Issue,
  ParsedEntry,
  RoomingList,
} from "../model.js";
import { nameKey } from "../name-key.js";
import { addDays, compareDates } from "../plain-date.js";

/**
 * What every rule receives. `report` turns (rule, entry index, sentence) into an
 * Issue with the right row/line and the "Row 7: " prefix, so rules only describe
 * the problem. Rules raised by the parser (R002, R006, R014, R015, W201, W205,
 * W207, W208 and the bad-cell half of R007) live in parse/ because they need the
 * raw cell text; see docs/DECISIONS.md, M2.
 */
export type RuleContext = {
  entries: ParsedEntry[];
  block: BlockContext | undefined;
  /** First entry index for each line number (duplicates are R009's job). */
  indexByLine: Map<number, number>;
  report: (
    ruleId: RuleId,
    index: number,
    message: string,
    detail?: { field?: EntryField; value?: string },
  ) => Issue;
};

export function createRuleContext(
  list: RoomingList,
  entryRows?: number[],
): RuleContext {
  const indexByLine = new Map<number, number>();
  list.entries.forEach((entry, index) => {
    if (!indexByLine.has(entry.line)) indexByLine.set(entry.line, index);
  });

  return {
    entries: list.entries,
    block: list.block,
    indexByLine,
    report(ruleId, index, message, detail = {}) {
      const line = list.entries[index]?.line;
      const row = entryRows?.[index];
      // Without source rows (a list built by hand or sent as JSON) the line is the best locator.
      const prefix = row !== undefined ? `Row ${row}` : `Line ${line}`;
      return makeIssue(ruleId, `${prefix}: ${message}`, {
        ...(line !== undefined ? { line } : {}),
        ...(row !== undefined ? { row } : {}),
        ...detail,
      });
    },
  };
}

/** The entry a sharer points at, if it exists and is not the sharer itself. */
function primaryOf(
  ctx: RuleContext,
  entry: ParsedEntry,
): ParsedEntry | undefined {
  if (entry.sharesWithLine === undefined || entry.sharesWithLine === entry.line)
    return undefined;
  const index = ctx.indexByLine.get(entry.sharesWithLine);
  return index === undefined ? undefined : ctx.entries[index];
}

/** R001 LAST_NAME_REQUIRED: every guest needs a last name. */
export function r001LastNameRequired(ctx: RuleContext): Issue[] {
  return ctx.entries.flatMap((entry, index) =>
    entry.lastName === undefined || entry.lastName.trim() === ""
      ? [
          ctx.report(
            "R001",
            index,
            "last name is empty. Enter the guest's last name.",
            { field: "lastName" },
          ),
        ]
      : [],
  );
}

/** R003 DEPARTURE_NOT_AFTER_ARRIVAL: a stay needs at least one night. */
export function r003DepartureNotAfterArrival(ctx: RuleContext): Issue[] {
  return ctx.entries.flatMap((entry, index) => {
    const { arrivalDate, departureDate } = entry;
    if (arrivalDate === undefined || departureDate === undefined) return [];
    if (compareDates(departureDate, arrivalDate) > 0) return [];
    return [
      ctx.report(
        "R003",
        index,
        `departure date ${departureDate} is not after arrival date ${arrivalDate}. Fix one of the two dates.`,
        { field: "departureDate", value: departureDate },
      ),
    ];
  });
}

/** Block window including shoulder days; undefined sides are not checked. */
function blockWindow(block: BlockContext | undefined) {
  if (block === undefined) return undefined;
  const shoulder = block.shoulderDays;
  return {
    start: block.startDate,
    end: block.endDate,
    earliest:
      block.startDate === undefined
        ? undefined
        : addDays(block.startDate, -shoulder),
    latest:
      block.endDate === undefined
        ? undefined
        : addDays(block.endDate, shoulder),
  };
}

/** R004 STAY_OUTSIDE_BLOCK: the hotel only holds rooms from start − shoulder to end + shoulder. */
export function r004StayOutsideBlock(ctx: RuleContext): Issue[] {
  const window = blockWindow(ctx.block);
  if (window === undefined) return [];
  return ctx.entries.flatMap((entry, index) => {
    const issues: Issue[] = [];
    const { arrivalDate, departureDate } = entry;
    if (
      arrivalDate !== undefined &&
      window.earliest !== undefined &&
      compareDates(arrivalDate, window.earliest) < 0
    ) {
      issues.push(
        ctx.report(
          "R004",
          index,
          `arrival ${arrivalDate} is before the block opens (${window.earliest}, including shoulder days). Move the arrival or ask the hotel to extend the block.`,
          { field: "arrivalDate", value: arrivalDate },
        ),
      );
    }
    if (
      departureDate !== undefined &&
      window.latest !== undefined &&
      compareDates(departureDate, window.latest) > 0
    ) {
      issues.push(
        ctx.report(
          "R004",
          index,
          `departure ${departureDate} is after the block closes (${window.latest}, including shoulder days). Move the departure or ask the hotel to extend the block.`,
          { field: "departureDate", value: departureDate },
        ),
      );
    }
    return issues;
  });
}

function allowedRoomTypes(
  block: BlockContext | undefined,
): Set<string> | undefined {
  const types = block?.roomTypes ?? [];
  return types.length === 0
    ? undefined
    : new Set(types.map((type) => type.toUpperCase()));
}

/** R005 ROOM_TYPE_UNKNOWN: the room type must be one the block holds. */
export function r005RoomTypeUnknown(ctx: RuleContext): Issue[] {
  const allowed = allowedRoomTypes(ctx.block);
  if (allowed === undefined) return [];
  return ctx.entries.flatMap((entry, index) =>
    entry.roomType === undefined || allowed.has(entry.roomType.toUpperCase())
      ? []
      : [
          ctx.report(
            "R005",
            index,
            `room type ${entry.roomType} is not in this block (${[...allowed].join(", ")}). Use one of those codes.`,
            { field: "roomType", value: entry.roomType },
          ),
        ],
  );
}

/** R007 OCCUPANCY_INVALID (entry half): somebody has to sleep in the room. */
export function r007NoOccupants(ctx: RuleContext): Issue[] {
  return ctx.entries.flatMap((entry, index) =>
    entry.adults + entry.children >= 1
      ? []
      : [
          ctx.report(
            "R007",
            index,
            "adults + children is 0. Enter at least one adult or child.",
            {
              field: "adults",
            },
          ),
        ],
  );
}

const emailSchema = z.email();

/** R008 EMAIL_INVALID: checked with Zod's email rule. */
export function r008EmailInvalid(ctx: RuleContext): Issue[] {
  return ctx.entries.flatMap((entry, index) =>
    entry.email === undefined || emailSchema.safeParse(entry.email).success
      ? []
      : [
          ctx.report(
            "R008",
            index,
            `email ${entry.email} is not a valid address. Correct it or leave it blank.`,
            {
              field: "email",
              value: entry.email,
            },
          ),
        ],
  );
}

/** R009 LINE_DUPLICATE: reported on the second and later entries with a line number. */
export function r009LineDuplicate(ctx: RuleContext): Issue[] {
  return ctx.entries.flatMap((entry, index) =>
    ctx.indexByLine.get(entry.line) === index
      ? []
      : [
          ctx.report(
            "R009",
            index,
            `line ${entry.line} is used twice. Give every guest a unique line number.`,
            {
              field: "line",
              value: String(entry.line),
            },
          ),
        ],
  );
}

/** R010 SHARER_NOT_FOUND: a sharer must point at a line that exists. */
export function r010SharerNotFound(ctx: RuleContext): Issue[] {
  return ctx.entries.flatMap((entry, index) => {
    const target = entry.sharesWithLine;
    if (
      target === undefined ||
      target === entry.line ||
      ctx.indexByLine.has(target)
    )
      return [];
    return [
      ctx.report(
        "R010",
        index,
        `shares with line ${target}, but there is no line ${target}. Fix the line number.`,
        {
          field: "sharesWithLine",
          value: String(target),
        },
      ),
    ];
  });
}

/** R011 SHARER_SELF: a guest cannot share a room with themselves. */
export function r011SharerSelf(ctx: RuleContext): Issue[] {
  return ctx.entries.flatMap((entry, index) =>
    entry.sharesWithLine !== entry.line
      ? []
      : [
          ctx.report(
            "R011",
            index,
            "shares with its own line. Point it at the primary guest's line.",
            {
              field: "sharesWithLine",
              value: String(entry.line),
            },
          ),
        ],
  );
}

/** R012 SHARER_CHAIN: a sharer must point at a primary, not at another sharer. */
export function r012SharerChain(ctx: RuleContext): Issue[] {
  return ctx.entries.flatMap((entry, index) => {
    const primary = primaryOf(ctx, entry);
    if (primary?.sharesWithLine === undefined) return [];
    return [
      ctx.report(
        "R012",
        index,
        `shares with line ${primary.line}, which itself shares with line ${primary.sharesWithLine}. Point it at line ${primary.sharesWithLine} instead.`,
        { field: "sharesWithLine", value: String(primary.line) },
      ),
    ];
  });
}

/** R013 OCCUPANCY_EXCEEDS_MAX: everyone in one room (primary + its sharers) must fit. */
export function r013OccupancyExceedsMax(ctx: RuleContext): Issue[] {
  const maxByType = new Map(
    Object.entries(ctx.block?.maxOccupancy ?? {}).map(([type, max]) => [
      type.toUpperCase(),
      max,
    ]),
  );
  if (maxByType.size === 0) return [];

  return ctx.entries.flatMap((primary, index) => {
    if (primary.sharesWithLine !== undefined || primary.roomType === undefined)
      return [];
    const max = maxByType.get(primary.roomType.toUpperCase());
    if (max === undefined) return [];
    const sharers = ctx.entries.filter(
      (entry) => entry !== primary && entry.sharesWithLine === primary.line,
    );
    const people = [primary, ...sharers].reduce(
      (sum, entry) => sum + entry.adults + entry.children,
      0,
    );
    if (people <= max) return [];
    return [
      ctx.report(
        "R013",
        index,
        `${people} people share this ${primary.roomType} room, but it holds at most ${max}. Move someone to another room.`,
        { field: "roomType", value: primary.roomType },
      ),
    ];
  });
}

/** W202 STAY_IN_SHOULDER: allowed, but the planner should know the shoulder rate may apply. */
export function w202StayInShoulder(ctx: RuleContext): Issue[] {
  const window = blockWindow(ctx.block);
  if (window === undefined) return [];
  return ctx.entries.flatMap((entry, index) => {
    const { arrivalDate, departureDate } = entry;
    const early =
      arrivalDate !== undefined &&
      window.start !== undefined &&
      window.earliest !== undefined &&
      compareDates(arrivalDate, window.start) < 0 &&
      compareDates(arrivalDate, window.earliest) >= 0;
    const late =
      departureDate !== undefined &&
      window.end !== undefined &&
      window.latest !== undefined &&
      compareDates(departureDate, window.end) > 0 &&
      compareDates(departureDate, window.latest) <= 0;
    // A stay outside the window is R004's error; W202 is only for stays that fit.
    const outside =
      (arrivalDate !== undefined &&
        window.earliest !== undefined &&
        compareDates(arrivalDate, window.earliest) < 0) ||
      (departureDate !== undefined &&
        window.latest !== undefined &&
        compareDates(departureDate, window.latest) > 0);
    if (outside || !(early || late)) return [];
    return [
      ctx.report(
        "W202",
        index,
        `stay ${arrivalDate ?? "?"} to ${departureDate ?? "?"} uses a shoulder day outside ${window.start ?? "?"} to ${window.end ?? "?"}. Check the rate with the hotel.`,
        early && arrivalDate !== undefined
          ? { field: "arrivalDate", value: arrivalDate }
          : {
              field: "departureDate",
              ...(departureDate !== undefined ? { value: departureDate } : {}),
            },
      ),
    ];
  });
}

/** W203 DUPLICATE_GUEST: same name, overlapping nights, and not sharing with each other. */
export function w203DuplicateGuest(ctx: RuleContext): Issue[] {
  const issues: Issue[] = [];
  // "Later" and "earlier" mean line numbers, not file position: the spec reports
  // on the later line. Ties (duplicate lines, R009) fall back to file order.
  const byLine = ctx.entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.line - b.entry.line || a.index - b.index);
  byLine.forEach(({ entry: later, index: laterIndex }, position) => {
    const {
      lastName,
      arrivalDate: laterArrival,
      departureDate: laterDeparture,
    } = later;
    if (
      lastName === undefined ||
      laterArrival === undefined ||
      laterDeparture === undefined
    )
      return;
    const laterKey = nameKey(later);
    const earlier = byLine
      .slice(0, position)
      .map(({ entry }) => entry)
      .find(
        (candidate) =>
          candidate.lastName !== undefined &&
          candidate.arrivalDate !== undefined &&
          candidate.departureDate !== undefined &&
          nameKey(candidate) === laterKey &&
          candidate.sharesWithLine !== later.line &&
          later.sharesWithLine !== candidate.line &&
          // Overlap test from the spec: a.arrival < b.departure && b.arrival < a.departure.
          compareDates(candidate.arrivalDate, laterDeparture) < 0 &&
          compareDates(laterArrival, candidate.departureDate) < 0,
      );
    if (earlier !== undefined) {
      issues.push(
        ctx.report(
          "W203",
          laterIndex,
          `${later.firstName ?? ""} ${lastName} looks like a duplicate of line ${earlier.line} (same name, overlapping dates). Remove one, or ignore if they are different people.`.trimStart(),
          { field: "lastName", value: lastName },
        ),
      );
    }
  });
  return issues;
}

/** W204 ROOM_TYPE_MISSING: the block has room types but this guest has none. */
export function w204RoomTypeMissing(ctx: RuleContext): Issue[] {
  if (allowedRoomTypes(ctx.block) === undefined) return [];
  return ctx.entries.flatMap((entry, index) =>
    entry.roomType !== undefined
      ? []
      : [
          ctx.report(
            "W204",
            index,
            "has no room type. Add one of the block's room types.",
            { field: "roomType" },
          ),
        ],
  );
}

/** W206 SHARER_MISMATCH: people in one room should arrive, leave and sleep in the same room type. */
export function w206SharerMismatch(ctx: RuleContext): Issue[] {
  return ctx.entries.flatMap((entry, index) => {
    const primary = primaryOf(ctx, entry);
    if (primary === undefined || primary.sharesWithLine !== undefined)
      return [];
    const differences: string[] = [];
    // A missing date was already reported (R002); comparing it would only add noise.
    const differs = (a: string | undefined, b: string | undefined) =>
      a !== undefined && b !== undefined && a !== b;
    if (differs(entry.arrivalDate, primary.arrivalDate))
      differences.push("arrival date");
    if (differs(entry.departureDate, primary.departureDate))
      differences.push("departure date");
    if ((entry.roomType ?? "") !== (primary.roomType ?? ""))
      differences.push("room type");
    if (differences.length === 0) return [];
    return [
      ctx.report(
        "W206",
        index,
        `${differences.join(", ")} differs from line ${primary.line}, the guest it shares with. Make them match.`,
        { field: "sharesWithLine", value: String(primary.line) },
      ),
    ];
  });
}

/** Every entry-level rule, in rule-ID order. validate.ts runs them all. */
export const ENTRY_RULES: readonly ((ctx: RuleContext) => Issue[])[] = [
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
];
