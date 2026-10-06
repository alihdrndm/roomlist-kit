import { z } from "zod";
import {
  type ParsedEntry,
  ParsedEntrySchema,
  type RoomingList,
} from "./model.js";
import { nameKey } from "./name-key.js";
import { compareDates } from "./plain-date.js";
import { summarize } from "./summarize.js";

export const DiffChangeSchema = z.strictObject({
  field: z.string(),
  // The spec defines null for "no value" here (e.g. no email before, one after).
  before: z.string().nullable(),
  after: z.string().nullable(),
});
export type DiffChange = z.infer<typeof DiffChangeSchema>;

export const DiffReportSchema = z.strictObject({
  summary: z.strictObject({
    added: z.int(),
    removed: z.int(),
    changed: z.int(),
    unchanged: z.int(),
    roomNightsBefore: z.int(),
    roomNightsAfter: z.int(),
    roomNightsDelta: z.int(),
  }),
  added: z.array(ParsedEntrySchema),
  removed: z.array(ParsedEntrySchema),
  changed: z.array(
    z.strictObject({
      before: ParsedEntrySchema,
      after: ParsedEntrySchema,
      changes: z.array(DiffChangeSchema),
    }),
  ),
});
export type DiffReport = z.infer<typeof DiffReportSchema>;

/** Fields a planner and hotel care about when a guest's booking changes, in report order. */
const COMPARED_FIELDS = [
  "arrivalDate",
  "departureDate",
  "roomType",
  "rooms",
  "adults",
  "children",
  "infants",
  "email",
  "phone",
  "specialRequests",
] as const;

type Pair = { before: ParsedEntry; after: ParsedEntry };

/**
 * Compares two versions of a rooming list the way a hotel would: first by
 * confirmation number (the hotel's own id for a booking), then by guest name.
 * Line numbers are never used to match, because planners renumber freely.
 */
export function diffRoomingLists(
  before: RoomingList,
  after: RoomingList,
): DiffReport {
  const byLine = (a: ParsedEntry, b: ParsedEntry) => a.line - b.line;
  const beforeEntries = [...before.entries].sort(byLine);
  const afterEntries = [...after.entries].sort(byLine);

  // Matched entries are tracked per side: the same object may appear in both
  // lists (diffing a list against itself), and must be matched once on each side.
  const matchedBefore = new Set<ParsedEntry>();
  const matchedAfter = new Set<ParsedEntry>();
  const pairs: Pair[] = [];
  const pair = (b: ParsedEntry, a: ParsedEntry) => {
    pairs.push({ before: b, after: a });
    matchedBefore.add(b);
    matchedAfter.add(a);
  };

  // Step 1: same confirmation number on both sides (case-insensitive). If a number
  // repeats on one side, entries are paired in line order and the rest go to step 2.
  const afterByConfirmation = groupBy(afterEntries, confirmationKey);
  for (const entry of beforeEntries) {
    const key = confirmationKey(entry);
    if (key === undefined) continue;
    const candidate = afterByConfirmation.get(key)?.shift();
    if (candidate !== undefined) pair(entry, candidate);
  }

  // Step 2: same name key. Within one name, the n-th stay before is paired with the
  // n-th stay after, ordered by arrival date then line, so two "John Smith"s who
  // arrive on different days are matched to the right booking.
  const byArrival = (a: ParsedEntry, b: ParsedEntry) => {
    if (a.arrivalDate === undefined || b.arrivalDate === undefined) {
      // A missing arrival date (already an R002) sorts before every date.
      const missing =
        Number(b.arrivalDate === undefined) -
        Number(a.arrivalDate === undefined);
      return missing !== 0 ? missing : a.line - b.line;
    }
    return compareDates(a.arrivalDate, b.arrivalDate) || a.line - b.line;
  };
  const restAfterByName = groupBy(
    afterEntries.filter((entry) => !matchedAfter.has(entry)),
    nameKey,
  );
  const restBeforeByName = groupBy(
    beforeEntries.filter((entry) => !matchedBefore.has(entry)),
    nameKey,
  );
  for (const [key, beforeGroup] of restBeforeByName) {
    const afterGroup = (restAfterByName.get(key) ?? []).sort(byArrival);
    beforeGroup.sort(byArrival).forEach((entry, index) => {
      const candidate = afterGroup[index];
      if (candidate !== undefined) pair(entry, candidate);
    });
  }

  // Step 3: whatever is left was removed or added.
  const removed = beforeEntries.filter((entry) => !matchedBefore.has(entry));
  const added = afterEntries.filter((entry) => !matchedAfter.has(entry));

  // Step 4: a pair is changed when any compared field differs.
  const primaryNameBefore = primaryNameResolver(before);
  const primaryNameAfter = primaryNameResolver(after);
  const changed: DiffReport["changed"] = [];
  let unchanged = 0;
  for (const { before: b, after: a } of pairs) {
    const changes: DiffChange[] = [];
    for (const field of COMPARED_FIELDS) {
      const beforeValue = asText(b[field]);
      const afterValue = asText(a[field]);
      if (beforeValue !== afterValue)
        changes.push({ field, before: beforeValue, after: afterValue });
    }
    // A sharer is compared by who it shares with (the primary's name), not by the
    // primary's line number, which differs between the two files.
    const sharesBefore = primaryNameBefore(b);
    const sharesAfter = primaryNameAfter(a);
    if (sharesBefore.key !== sharesAfter.key) {
      changes.push({
        field: "sharesWith",
        before: sharesBefore.display,
        after: sharesAfter.display,
      });
    }
    if (changes.length > 0) changed.push({ before: b, after: a, changes });
    else unchanged++;
  }

  changed.sort((x, y) => x.after.line - y.after.line);
  const roomNightsBefore = summarize(before).roomNights;
  const roomNightsAfter = summarize(after).roomNights;
  return {
    summary: {
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged,
      roomNightsBefore,
      roomNightsAfter,
      roomNightsDelta: roomNightsAfter - roomNightsBefore,
    },
    added,
    removed,
    changed,
  };
}

function confirmationKey(entry: ParsedEntry): string | undefined {
  const key = entry.confirmationNumber?.trim().toLowerCase();
  return key === undefined || key === "" ? undefined : key;
}

function groupBy(
  entries: ParsedEntry[],
  keyOf: (entry: ParsedEntry) => string | undefined,
): Map<string, ParsedEntry[]> {
  const groups = new Map<string, ParsedEntry[]>();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (key === undefined) continue;
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [entry]);
    else group.push(entry);
  }
  return groups;
}

function asText(value: string | number | undefined): string | null {
  return value === undefined ? null : String(value);
}

/** "Okafor, Ada", or just "Okafor" when there is no first name. */
function displayName(entry: ParsedEntry): string {
  const last = entry.lastName ?? "";
  return entry.firstName === undefined ? last : `${last}, ${entry.firstName}`;
}

/**
 * For one list: who does an entry share with? `key` is what is compared (the
 * primary's name key), `display` is what the report shows. Both are null for a
 * guest who shares with nobody.
 */
function primaryNameResolver(list: RoomingList) {
  const byLine = new Map<number, ParsedEntry>();
  for (const entry of list.entries) {
    if (!byLine.has(entry.line)) byLine.set(entry.line, entry);
  }
  return (
    entry: ParsedEntry,
  ): { key: string | null; display: string | null } => {
    if (entry.sharesWithLine === undefined) return { key: null, display: null };
    const primary = byLine.get(entry.sharesWithLine);
    // Only possible for an invalid list (R010); the API refuses those before diffing.
    if (primary === undefined) {
      return {
        key: `missing-line:${entry.sharesWithLine}`,
        display: `line ${entry.sharesWithLine} (not in the list)`,
      };
    }
    return { key: nameKey(primary), display: displayName(primary) };
  };
}
