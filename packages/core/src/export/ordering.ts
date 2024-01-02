import type { RoomingEntry } from "../model.js";

export type Ordered = {
  /** Entries in output order: each primary, then its sharers, primaries by ascending line. */
  entries: RoomingEntry[];
  /** New 1..n sequence number of each entry, by its position in `entries`. */
  sequence: number[];
  /** The primary's new sequence number for each sharer position, else undefined. */
  primarySequence: (number | undefined)[];
};

/**
 * Hotels want a sharer listed after the guest it shares with, and numbered from
 * the output sequence rather than the planner's own line numbers. Validation has
 * already guaranteed every sharer points at an existing primary.
 */
export function orderForExport(entries: RoomingEntry[]): Ordered {
  const byLine = (a: RoomingEntry, b: RoomingEntry) => a.line - b.line;
  const primaries = entries
    .filter((entry) => entry.sharesWithLine === undefined)
    .sort(byLine);
  const sharers = entries
    .filter((entry) => entry.sharesWithLine !== undefined)
    .sort(byLine);

  const ordered: RoomingEntry[] = [];
  const primarySequence: (number | undefined)[] = [];
  for (const primary of primaries) {
    ordered.push(primary);
    primarySequence.push(undefined);
    const ownSequence = ordered.length;
    for (const sharer of sharers) {
      if (sharer.sharesWithLine === primary.line) {
        ordered.push(sharer);
        primarySequence.push(ownSequence);
      }
    }
  }
  return {
    entries: ordered,
    sequence: ordered.map((_, index) => index + 1),
    primarySequence,
  };
}
