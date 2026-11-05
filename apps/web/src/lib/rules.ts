import { RULES, type RuleId } from "@alihdrndm/roomlist-core/rules";

// What each check means for a planner. Codes and severities come from core's rule
// table (one source of truth); the words here explain them. Typed as a Record over
// RuleId, so a rule added in core fails the web typecheck until it is explained.

export type RuleGuide = {
  /** Short name, used as a group heading. */
  title: string;
  /** Why it matters and how to fix it, in one or two sentences. */
  help: string;
  /** Which part of the check needs block details, if any. */
  needsBlock?: "dates" | "roomTypes" | "maxOccupancy";
};

export const RULE_GUIDE: Record<RuleId, RuleGuide> = {
  F001: {
    title: "File is empty",
    help: "The file has no rows we can read. Export the list again from the spreadsheet.",
  },
  F003: {
    title: "File type not supported",
    help: "Only CSV and Excel .xlsx files can be read (not .xls or .numbers). Save the list as .xlsx or CSV and upload it again.",
  },
  F004: {
    title: "File encoding not readable",
    help: "CSV files must be UTF-8. In Excel choose “CSV UTF-8 (Comma delimited)” when saving, or upload the .xlsx file instead.",
  },
  F005: {
    title: "Required column missing",
    help: "A list needs a last name (or one full-name column), an arrival date and a departure date. If the column is there under another name, map it under Columns.",
  },
  F006: {
    title: "Two columns mean the same thing",
    help: "Two headers map to the same field, so we cannot tell which one is right. Remove or rename one, or set one of them to Ignore under Columns.",
  },
  F007: {
    title: "Too many rows",
    help: "A list can have up to 5,000 guest rows. Split it into smaller files.",
  },
  R001: {
    title: "Last name missing",
    help: "Every guest needs a last name; hotels cannot create a reservation without one. Placeholders such as TBA count as names, so replace them before the import.",
  },
  R002: {
    title: "Date not readable",
    help: "The date is not a real calendar date in the chosen date order. Use YYYY-MM-DD, or check whether the file uses MM/DD or DD/MM.",
  },
  R003: {
    title: "Departure not after arrival",
    help: "A stay needs at least one night, so the departure must be later than the arrival. One of the two dates is wrong.",
  },
  R004: {
    title: "Stay outside the block",
    help: "The hotel only holds rooms from the block start minus the shoulder days to the block end plus the shoulder days. Move the stay, or ask the hotel to extend the block.",
    needsBlock: "dates",
  },
  R005: {
    title: "Room type not in the block",
    help: "The room type is not one of the block's room types, so the hotel has no inventory for it. Use one of the block's codes.",
    needsBlock: "roomTypes",
  },
  R006: {
    title: "Room count not valid",
    help: "Rooms must be a whole number of at least 1.",
  },
  R007: {
    title: "Occupancy not valid",
    help: "Adults, children and infants must be whole numbers, and a room needs at least one adult or child.",
  },
  R008: {
    title: "Email not valid",
    help: "The email address is not well formed. Correct it or leave it blank; hotels use it for confirmations.",
  },
  R009: {
    title: "Line number used twice",
    help: "Sharers point at line numbers, so every guest needs a unique one.",
  },
  R010: {
    title: "Sharer points at a missing line",
    help: "The guest shares with a line number that is not in the list. Fix the line number in the Shares with column.",
  },
  R011: {
    title: "Guest shares with themselves",
    help: "A sharer must point at the line of the guest who holds the room, not at its own line.",
  },
  R012: {
    title: "Sharer points at another sharer",
    help: "Sharers must point at the guest who holds the room (the primary), not at another sharer.",
  },
  R013: {
    title: "Too many people in a room",
    help: "The room holds more adults and children than the block allows for its room type. Move someone to another room.",
    needsBlock: "maxOccupancy",
  },
  R014: {
    title: "Line number not valid",
    help: "Line and Shares with must be whole numbers of at least 1. If the column holds names, it cannot link sharers; use line numbers.",
  },
  R015: {
    title: "Value too long",
    help: "The value is longer than hotel systems accept. Shorten it.",
  },
  W201: {
    title: "Column ignored",
    help: "The header was not recognised, so the column is ignored. If it matters (for example a roommate or sharer column), map it under Columns.",
  },
  W202: {
    title: "Stay uses a shoulder night",
    help: "The stay starts before or ends after the block dates but within the shoulder days. That is allowed; check the rate with the hotel.",
    needsBlock: "dates",
  },
  W203: {
    title: "Possible duplicate guest",
    help: "Same name and overlapping nights on two lines that do not share. Remove one, or ignore this if they are different people.",
  },
  W204: {
    title: "Room type missing",
    help: "The block has room types, but this guest has none. The hotel will have to pick one.",
    needsBlock: "roomTypes",
  },
  W205: {
    title: "Date order is ambiguous",
    help: "Every date could be read as month/day or day/month. Check the dates, and switch the date order if they look wrong.",
  },
  W206: {
    title: "Sharer's stay differs",
    help: "A sharer's dates or room type differ from the guest they share with. Make them match unless the difference is intended.",
  },
  W207: {
    title: "Name split guessed",
    help: "Names came from one column and were split into last and first names. Check them, or use separate Last name and First name columns.",
  },
  W208: {
    title: "Gender not recognised",
    help: "Gender must be M, F, X or U; other values are dropped.",
  },
  X001: {
    title: "Required for this format",
    help: "The chosen format needs this value. Add it to the list or the block details, or choose another format.",
  },
  X101: {
    title: "Over the recommended size",
    help: "The hotel system recommends smaller files. Consider splitting the list.",
  },
};

/** The guide entry of a rule id from an issue, or a fallback for ids this web build does not know. */
export function ruleGuide(ruleId: string): RuleGuide {
  return Object.hasOwn(RULE_GUIDE, ruleId)
    ? RULE_GUIDE[ruleId as RuleId]
    : { title: ruleId, help: "" };
}

/** Every rule with its code and severity from core, in catalogue order. */
export function ruleCatalogue(): {
  id: RuleId;
  code: string;
  severity: "error" | "warning";
  guide: RuleGuide;
}[] {
  return (Object.keys(RULES) as RuleId[]).map((id) => ({
    id,
    code: RULES[id].code,
    severity: RULES[id].severity,
    guide: RULE_GUIDE[id],
  }));
}
