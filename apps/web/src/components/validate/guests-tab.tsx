"use client";

import type { ParsedEntry, ValidateReport } from "@alihdrndm/roomlist-core";
import { useId, useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/controls";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { inputClass } from "@/components/ui/field";
import { cx } from "@/lib/cx";
import { dateRange, nightsOf } from "@/lib/dates";
import {
  groupRooms,
  guestName,
  makeGuestLookup,
  plural,
  type Room,
} from "@/lib/report";

const PAGE_SIZE = 40;

/** Issues per guest line, so rows with problems can be marked and filtered. */
function issuesByLine(
  report: ValidateReport,
): Map<number, { errors: number; warnings: number }> {
  const guestOf = makeGuestLookup(report);
  const counts = new Map<number, { errors: number; warnings: number }>();
  for (const issue of report.issues) {
    const guest = guestOf(issue);
    if (guest === undefined) continue;
    const count = counts.get(guest.line) ?? { errors: 0, warnings: 0 };
    if (issue.severity === "error") count.errors++;
    else count.warnings++;
    counts.set(guest.line, count);
  }
  return counts;
}

export function GuestsTab({
  report,
  maxOccupancy,
}: {
  report: ValidateReport;
  maxOccupancy: Record<string, number> | undefined;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [page, setPage] = useState(0);
  const { rooms, orphans } = useMemo(
    () => groupRooms(report.entries),
    [report.entries],
  );
  const flags = useMemo(() => issuesByLine(report), [report]);

  const flagged = (entry: ParsedEntry) => flags.has(entry.line);
  const needle = query.trim().toLowerCase();
  const matches = (entry: ParsedEntry) =>
    needle === "" ||
    [
      guestName(entry),
      entry.roomType ?? "",
      entry.email ?? "",
      entry.confirmationNumber ?? "",
      `line ${entry.line}`,
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  const shown = rooms.filter((room) => {
    const members = [room.primary, ...room.sharers];
    return members.some(matches) && (!onlyFlagged || members.some(flagged));
  });
  const pageRooms = shown.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (report.entries.length === 0)
    return (
      <EmptyState title="No guests were read.">
        Fix the file-level issues first; the guest list appears here once rows
        can be read.
      </EmptyState>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1 sm:max-w-80">
          <label htmlFor={searchId} className="sr-only">
            Search guests
          </label>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" />
          <input
            id={searchId}
            type="search"
            value={query}
            placeholder="Search name, room type, email…"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            className={cx(inputClass, "h-8 pl-8 text-[13px]")}
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          pressed={onlyFlagged}
          onClick={() => {
            setOnlyFlagged(!onlyFlagged);
            setPage(0);
          }}
        >
          Only rooms with issues
        </Button>
        <p className="text-[13px] text-ink-2 sm:ml-auto">
          {plural(rooms.length, "room booking")} ·{" "}
          {plural(report.summary.sharers, "sharer")}
        </p>
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No guests match.">
          Change the search or the filter.
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div
            aria-hidden="true"
            className="hidden grid-cols-[56px_minmax(0,1.4fr)_minmax(0,1.3fr)_88px_92px] gap-x-4 border-b border-line bg-sunken/60 px-4 py-2 text-[11px] font-medium tracking-wide text-ink-2 uppercase md:grid"
          >
            <span>Line</span>
            <span>Guests in the room</span>
            <span>Stay</span>
            <span>Room</span>
            <span className="text-right">People</span>
          </div>
          <ol className="divide-y divide-line">
            {pageRooms.map((room) => (
              <RoomRow
                key={`${room.primary.line}-${guestName(room.primary)}`}
                room={room}
                flags={flags}
                max={
                  room.primary.roomType === undefined
                    ? undefined
                    : maxOccupancy?.[room.primary.roomType]
                }
              />
            ))}
          </ol>
        </div>
      )}
      {orphans.length > 0 && (
        <p className="text-[13px] text-ink-2">
          {plural(orphans.length, "sharer points", "sharers point")} at a line
          that is not in the list:{" "}
          {orphans
            .map((entry) => `${guestName(entry)} (line ${entry.line})`)
            .join(", ")}
          . See the issues.
        </p>
      )}
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={shown.length}
        onPage={setPage}
        noun="rooms"
      />
    </div>
  );
}

function RoomRow({
  room,
  flags,
  max,
}: {
  room: Room;
  flags: Map<number, { errors: number; warnings: number }>;
  max: number | undefined;
}) {
  const members = [room.primary, ...room.sharers];
  const over = max !== undefined && room.people > max;
  const { arrivalDate, departureDate } = room.primary;
  return (
    <li className="grid gap-x-4 gap-y-1 px-4 py-3 text-sm md:grid-cols-[56px_minmax(0,1.4fr)_minmax(0,1.3fr)_88px_92px]">
      <span className="font-mono text-xs text-ink-2 md:pt-0.5">
        <span className="md:sr-only">Line </span>
        {room.primary.line}
      </span>
      <ul className="min-w-0 space-y-1">
        {members.map((entry, index) => {
          const flag = flags.get(entry.line);
          return (
            <li
              key={`${entry.line}-${index}`}
              className="flex min-w-0 items-center gap-2"
            >
              {index > 0 && (
                <span aria-hidden="true" className="text-ink-3">
                  ↳
                </span>
              )}
              <span
                className={cx(
                  "truncate",
                  index === 0 ? "font-medium text-ink" : "text-ink-2",
                )}
              >
                {guestName(entry)}
              </span>
              {index > 0 && (
                <span className="sr-only">(shares, line {entry.line})</span>
              )}
              {flag !== undefined && (
                <Badge tone={flag.errors > 0 ? "danger" : "warning"}>
                  {flag.errors > 0
                    ? plural(flag.errors, "error")
                    : plural(flag.warnings, "warning")}
                </Badge>
              )}
            </li>
          );
        })}
      </ul>
      <span className="text-ink-2">
        {arrivalDate !== undefined && departureDate !== undefined ? (
          <>
            {dateRange(arrivalDate, departureDate)}
            <span className="text-ink-3">
              {" "}
              · {plural(nightsOf(arrivalDate, departureDate), "night")}
            </span>
          </>
        ) : (
          <span className="text-danger-ink">Dates missing</span>
        )}
      </span>
      <span className="flex items-center gap-1.5">
        {room.primary.roomType === undefined ? (
          <span className="text-ink-3">No type</span>
        ) : (
          <Badge mono>{room.primary.roomType}</Badge>
        )}
        {room.primary.rooms > 1 && (
          <span className="text-xs text-ink-2">×{room.primary.rooms}</span>
        )}
      </span>
      <span
        className={cx(
          "tabular-nums md:text-right",
          over ? "font-semibold text-danger-ink" : "text-ink-2",
        )}
      >
        {room.people}
        {max !== undefined && <span className="text-ink-3"> / {max}</span>}
        <span className="text-ink-3 md:sr-only">
          {" "}
          {room.people === 1 ? "person" : "people"}
        </span>
      </span>
    </li>
  );
}
