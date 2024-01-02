import { sortIssues } from "../issues.js";
import type { Issue, RoomingList } from "../model.js";
import { createRuleContext, ENTRY_RULES } from "./rules.js";

export type ValidateOptions = {
  /**
   * Source row of entries[i], from `ParseResult.entryRows`. With it, issues name
   * the spreadsheet row the planner sees; without it, they name the line.
   */
  entryRows?: number[];
};

/**
 * Checks a rooming list against every entry-level rule and returns the issues
 * sorted errors first, then by row, then by rule ID. Rules that need the raw
 * cell text were already reported by `parseRoomingList`; merge both lists.
 */
export function validateRoomingList(
  list: RoomingList,
  options: ValidateOptions = {},
): Issue[] {
  const ctx = createRuleContext(list, options.entryRows);
  return sortIssues(ENTRY_RULES.flatMap((rule) => rule(ctx)));
}
