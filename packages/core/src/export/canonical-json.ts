import { ENTRY_FIELDS, type RoomingEntry } from "../model.js";
import type { ExportInput } from "./types.js";

/** Rebuilds the entry with keys in table order and no undefined values; hand-built lists may use any key order. */
function inTableOrder(entry: RoomingEntry): Partial<RoomingEntry> {
  const ordered: Record<string, unknown> = {};
  for (const field of ENTRY_FIELDS) {
    const value = entry[field];
    if (value !== undefined) ordered[field] = value;
  }
  return ordered;
}

export function canonicalJson(input: ExportInput): string {
  const document = {
    ...(input.block !== undefined ? { block: input.block } : {}),
    entries: input.entries.map(inTableOrder),
    summary: input.summary,
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}
