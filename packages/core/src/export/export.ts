import { makeIssue } from "../issues.js";
import {
  type Issue,
  type RoomingEntry,
  RoomingEntrySchema,
  type RoomingList,
} from "../model.js";
import { summarize } from "../summarize.js";
import { validateRoomingList } from "../validate/validate.js";
import { orderForExport } from "./ordering.js";
import { getTarget } from "./registry.js";
import {
  ExportOptionsError,
  ExportPreconditionError,
  type ExportResult,
} from "./types.js";

/**
 * Validates the list, then writes it in the target's format. Refuses (throws
 * ExportPreconditionError) when the list has any error or the target's own
 * requirements (X001) are not met, so a hotel never receives a half-valid file.
 * Async because exceljs writes workbooks asynchronously.
 */
export async function exportRoomingList(
  list: RoomingList,
  targetId: string,
  options?: unknown,
): Promise<ExportResult> {
  const target = getTarget(targetId);

  const optionsResult = target.optionsSchema.safeParse(options ?? {});
  if (!optionsResult.success)
    throw new ExportOptionsError(optionsResult.error.issues);

  const validation = validateRoomingList(list);
  const errors = validation.filter((issue) => issue.severity === "error");
  if (errors.length > 0) throw new ExportPreconditionError(errors);
  const warnings = validation.filter((issue) => issue.severity === "warning");

  const { entries, missing } = narrowEntries(list);
  if (missing.length > 0) throw new ExportPreconditionError(missing);

  const input = { entries, block: list.block, summary: summarize(list) };
  const unmet = target.preconditions(input, optionsResult.data);
  if (unmet.length > 0) throw new ExportPreconditionError(unmet);

  const built = await target.build(input, optionsResult.data);
  return {
    fileName: target.fileName,
    contentType: target.contentType,
    bytes: built.bytes,
    issues: [...warnings, ...built.issues],
  };
}

/**
 * Validation cannot see a date cell that failed to parse (the parser reported it
 * as R002 and left the field empty), so the strict schema is the last gate: any
 * entry still missing a required field is an X001, never a crash.
 */
function narrowEntries(list: RoomingList): {
  entries: RoomingEntry[];
  missing: Issue[];
} {
  const entries: RoomingEntry[] = [];
  const missing: Issue[] = [];
  for (const entry of list.entries) {
    const result = RoomingEntrySchema.safeParse(entry);
    if (result.success) {
      entries.push(result.data);
      continue;
    }
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? "entry");
      missing.push(
        makeIssue(
          "X001",
          `Line ${entry.line}: ${field} is required for export (${issue.message}). Fix it and try again.`,
          {
            line: entry.line,
            field,
          },
        ),
      );
    }
  }
  // Sharers are written after their primary whatever order the list came in.
  return { entries: orderForExport(entries).entries, missing };
}
