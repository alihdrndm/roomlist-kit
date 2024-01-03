import { z } from "zod";
import {
  IsoDateSchema,
  IssueSchema,
  type ParsedEntry,
  ParsedEntrySchema,
  ParseResultSchema,
  type RoomingList,
} from "./model.js";
import {
  compareDates,
  diffDays,
  eachNight,
  type IsoDate,
} from "./plain-date.js";

export const SummarySchema = z.strictObject({
  entries: z.int(),
  primaries: z.int(),
  sharers: z.int(),
  rooms: z.int(),
  people: z.int(),
  roomNights: z.int(),
  firstArrival: IsoDateSchema.optional(),
  lastDeparture: IsoDateSchema.optional(),
  byRoomType: z.array(
    z.strictObject({
      roomType: z.string(),
      rooms: z.int(),
      roomNights: z.int(),
    }),
  ),
  byNight: z.array(z.strictObject({ date: IsoDateSchema, rooms: z.int() })),
});
export type Summary = z.infer<typeof SummarySchema>;

/**
 * Everything a validation run tells a planner: the parsed list, every issue, and
 * the summary. The API's POST /v1/rooming-lists/validate returns exactly this, and
 * the web app reads it, so both use this one schema.
 */
export const ValidateReportSchema = z.strictObject({
  ok: z.boolean(),
  format: ParseResultSchema.shape.format,
  rowCount: z.int(),
  columns: ParseResultSchema.shape.columns,
  entries: z.array(ParsedEntrySchema),
  issues: z.array(IssueSchema),
  summary: SummarySchema,
});
export type ValidateReport = z.infer<typeof ValidateReportSchema>;

const NO_ROOM_TYPE = "(none)";

type Stay = { arrival: IsoDate; departure: IsoDate; nights: number };

/** A usable stay, or undefined when a date is missing or departure is not after arrival. */
function stayOf(entry: ParsedEntry): Stay | undefined {
  const { arrivalDate, departureDate } = entry;
  if (arrivalDate === undefined || departureDate === undefined)
    return undefined;
  const nights = diffDays(arrivalDate, departureDate);
  return nights > 0
    ? { arrival: arrivalDate, departure: departureDate, nights }
    : undefined;
}

/**
 * The numbers a planner and the hotel compare: rooms, room nights, and rooms
 * needed per night. A sharer takes no room of its own, so it counts towards
 * people but never towards rooms or room nights.
 */
export function summarize(list: RoomingList): Summary {
  const entries = list.entries;
  const primaries = entries.filter(
    (entry) => entry.sharesWithLine === undefined,
  );

  let firstArrival: IsoDate | undefined;
  let lastDeparture: IsoDate | undefined;
  for (const entry of entries) {
    const stay = stayOf(entry);
    if (stay === undefined) continue;
    if (
      firstArrival === undefined ||
      compareDates(stay.arrival, firstArrival) < 0
    )
      firstArrival = stay.arrival;
    if (
      lastDeparture === undefined ||
      compareDates(stay.departure, lastDeparture) > 0
    )
      lastDeparture = stay.departure;
  }

  const byType = new Map<string, { rooms: number; roomNights: number }>();
  const roomsByNight = new Map<IsoDate, number>();
  let roomNights = 0;
  for (const entry of primaries) {
    const key = entry.roomType ?? NO_ROOM_TYPE;
    const totals = byType.get(key) ?? { rooms: 0, roomNights: 0 };
    totals.rooms += entry.rooms;
    const stay = stayOf(entry);
    if (stay !== undefined) {
      totals.roomNights += stay.nights * entry.rooms;
      roomNights += stay.nights * entry.rooms;
      for (const night of eachNight(stay.arrival, stay.departure)) {
        roomsByNight.set(night, (roomsByNight.get(night) ?? 0) + entry.rooms);
      }
    }
    byType.set(key, totals);
  }

  // One element per night from first arrival to the night before last departure, zeros included.
  const byNight =
    firstArrival === undefined || lastDeparture === undefined
      ? []
      : eachNight(firstArrival, lastDeparture).map((date) => ({
          date,
          rooms: roomsByNight.get(date) ?? 0,
        }));

  const byRoomType = [...byType.entries()]
    // Plain code-point order (not locale order) so the result is the same on every machine.
    .sort(([a], [b]) =>
      a === NO_ROOM_TYPE
        ? 1
        : b === NO_ROOM_TYPE
          ? -1
          : a < b
            ? -1
            : a > b
              ? 1
              : 0,
    )
    .map(([roomType, totals]) => ({ roomType, ...totals }));

  return {
    entries: entries.length,
    primaries: primaries.length,
    sharers: entries.length - primaries.length,
    rooms: primaries.reduce((sum, entry) => sum + entry.rooms, 0),
    people: entries.reduce(
      (sum, entry) => sum + entry.adults + entry.children + entry.infants,
      0,
    ),
    roomNights,
    ...(firstArrival !== undefined ? { firstArrival } : {}),
    ...(lastDeparture !== undefined ? { lastDeparture } : {}),
    byRoomType,
    byNight,
  };
}
