import type { Issue, Severity } from "./model.js";

// One table for every rule ID in HANDOFF.md, so the code and severity of a rule
// are written down exactly once and the parser, validator and exporters agree.
export const RULES = {
  F001: { code: "FILE_EMPTY", severity: "error" },
  F003: { code: "UNSUPPORTED_FORMAT", severity: "error" },
  F004: { code: "FILE_ENCODING", severity: "error" },
  F005: { code: "MISSING_REQUIRED_COLUMN", severity: "error" },
  F006: { code: "DUPLICATE_COLUMN", severity: "error" },
  F007: { code: "TOO_MANY_ROWS", severity: "error" },
  R001: { code: "LAST_NAME_REQUIRED", severity: "error" },
  R002: { code: "DATE_INVALID", severity: "error" },
  R003: { code: "DEPARTURE_NOT_AFTER_ARRIVAL", severity: "error" },
  R004: { code: "STAY_OUTSIDE_BLOCK", severity: "error" },
  R005: { code: "ROOM_TYPE_UNKNOWN", severity: "error" },
  R006: { code: "ROOMS_INVALID", severity: "error" },
  R007: { code: "OCCUPANCY_INVALID", severity: "error" },
  R008: { code: "EMAIL_INVALID", severity: "error" },
  R009: { code: "LINE_DUPLICATE", severity: "error" },
  R010: { code: "SHARER_NOT_FOUND", severity: "error" },
  R011: { code: "SHARER_SELF", severity: "error" },
  R012: { code: "SHARER_CHAIN", severity: "error" },
  R013: { code: "OCCUPANCY_EXCEEDS_MAX", severity: "error" },
  R014: { code: "LINE_INVALID", severity: "error" },
  // Not in HANDOFF.md: added by owner decision, docs/DECISIONS.md 2026-10-06.
  R015: { code: "FIELD_TOO_LONG", severity: "error" },
  W201: { code: "UNMAPPED_COLUMN", severity: "warning" },
  W202: { code: "STAY_IN_SHOULDER", severity: "warning" },
  W203: { code: "DUPLICATE_GUEST", severity: "warning" },
  W204: { code: "ROOM_TYPE_MISSING", severity: "warning" },
  W205: { code: "AMBIGUOUS_DATE_ORDER", severity: "warning" },
  W206: { code: "SHARER_MISMATCH", severity: "warning" },
  W207: { code: "NAME_SPLIT_GUESSED", severity: "warning" },
  W208: { code: "GENDER_UNRECOGNISED", severity: "warning" },
  X001: { code: "EXPORT_FIELD_REQUIRED", severity: "error" },
  X101: { code: "EXPORT_OVER_RECOMMENDED_LIMIT", severity: "warning" },
} as const satisfies Record<string, { code: string; severity: Severity }>;

export type RuleId = keyof typeof RULES;

const MAX_VALUE_LENGTH = 80;

export function makeIssue(
  ruleId: RuleId,
  message: string,
  location: {
    line?: number;
    row?: number;
    field?: string;
    value?: string;
  } = {},
): Issue {
  const issue: Issue = {
    severity: RULES[ruleId].severity,
    ruleId,
    code: RULES[ruleId].code,
    message,
  };
  // Keys are added only when present: the API never returns null or undefined fields.
  if (location.line !== undefined) issue.line = location.line;
  if (location.row !== undefined) issue.row = location.row;
  if (location.field !== undefined) issue.field = location.field;
  if (location.value !== undefined)
    issue.value = location.value.slice(0, MAX_VALUE_LENGTH);
  return issue;
}

/** Errors first, then by row (issues without a row first), then by rule ID. */
export function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
    const rowA = a.row ?? 0;
    const rowB = b.row ?? 0;
    if (rowA !== rowB) return rowA - rowB;
    return a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0;
  });
}
