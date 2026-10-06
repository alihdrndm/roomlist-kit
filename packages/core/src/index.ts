// Public API of @alihdrndm/roomlist-core. Everything else is internal.

export {
  type DiffChange,
  DiffChangeSchema,
  type DiffReport,
  DiffReportSchema,
  diffRoomingLists,
} from "./diff.js";
export { exportRoomingList } from "./export/export.js";
export { getTarget, listTargets, type TargetInfo } from "./export/registry.js";
export {
  ExportOptionsError,
  ExportPreconditionError,
  type ExportResult,
  type Provenance,
  TARGET_IDS,
  type TargetId,
  UnknownTargetError,
} from "./export/types.js";
export { makeIssue, RULES, type RuleId, sortIssues } from "./issues.js";
export * from "./model.js";
export { nameKey, normaliseName } from "./name-key.js";
export { parseRoomingList } from "./parse/parse.js";
export {
  addDays,
  compareDates,
  diffDays,
  eachNight,
  type IsoDate,
  parseIsoDate,
} from "./plain-date.js";
export { type Summary, SummarySchema, summarize } from "./summarize.js";
export {
  type ValidateOptions,
  validateRoomingList,
} from "./validate/validate.js";
