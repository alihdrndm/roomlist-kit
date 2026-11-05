"use client";

import type { ValidateReport } from "@alihdrndm/roomlist-core";
import { EmptyState } from "@/components/ui/feedback";
import { cx } from "@/lib/cx";
import {
  type BlockWindow,
  dayMonth,
  type NightKind,
  nightKind,
  weekday,
} from "@/lib/dates";
import { nightGrid } from "@/lib/report";

const BAR: Record<NightKind, string> = {
  block: "bg-accent",
  shoulder:
    "bg-warning-fill bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgb(255_255_255/0.45)_4px_7px)]",
  outside:
    "bg-danger bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgb(255_255_255/0.35)_4px_7px)]",
  unknown: "bg-accent",
};

const KIND_LABEL: Record<NightKind, string> = {
  block: "Block night",
  shoulder: "Shoulder night",
  outside: "Outside the block",
  unknown: "Night",
};

/**
 * Rooms needed each night, drawn as a strip of bars with the block window marked,
 * then the same numbers as a room type × night grid (the accessible form of the
 * chart, and the shape of a hotel's block grid), then totals per room type.
 */
export function NightsTab({
  report,
  window,
  maxOccupancy,
}: {
  report: ValidateReport;
  window: BlockWindow;
  maxOccupancy: Record<string, number> | undefined;
}) {
  const grid = nightGrid(report);
  if (grid.nights.length === 0)
    return (
      <EmptyState title="No nights to show.">
        No stay has two valid dates yet. Fix the date issues and validate again.
      </EmptyState>
    );
  const peak = Math.max(1, ...grid.totals);
  const kinds = grid.nights.map((night) => nightKind(night, window));
  const usedKinds = [...new Set(kinds)];
  const totalRoomNights = report.summary.roomNights;

  return (
    <div className="space-y-8">
      <figure className="rounded-lg border border-line bg-surface p-4 sm:p-5">
        <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-ink">
            Rooms per night
          </span>
          <span className="text-[13px] text-ink-2">
            Peak {peak} {peak === 1 ? "room" : "rooms"} ·{" "}
            {totalRoomNights.toLocaleString("en-US")} room nights
          </span>
        </figcaption>
        <div className="mt-4 overflow-x-auto pb-1" aria-hidden="true">
          <div className="flex min-w-full items-end gap-1.5">
            {grid.nights.map((night, index) => {
              const rooms = grid.totals[index] ?? 0;
              const kind = kinds[index] ?? "unknown";
              return (
                <div
                  key={night}
                  className="flex min-w-11 flex-1 flex-col items-center"
                >
                  <span
                    className={cx(
                      "mb-1 text-xs font-medium tabular-nums",
                      rooms === peak ? "text-ink" : "text-ink-2",
                    )}
                  >
                    {rooms}
                  </span>
                  <div className="flex h-32 w-full items-end rounded-sm bg-sunken/70">
                    <div
                      className={cx(
                        "w-full rounded-sm transition-[height] duration-300",
                        BAR[kind],
                      )}
                      style={{
                        height: `${rooms === 0 ? 0 : Math.max(4, (rooms / peak) * 100)}%`,
                      }}
                      title={`${KIND_LABEL[kind]} ${night}: ${rooms} rooms`}
                    />
                  </div>
                  <span className="mt-1.5 text-[11px] leading-4 text-ink-3">
                    {weekday(night)}
                  </span>
                  <span className="text-[11px] leading-4 font-medium whitespace-nowrap text-ink-2">
                    {dayMonth(night)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
          {usedKinds.map((kind) => (
            <li key={kind} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cx("size-2.5 rounded-[2px]", BAR[kind])}
              />
              {KIND_LABEL[kind]}
            </li>
          ))}
          {usedKinds.includes("unknown") && (
            <li className="text-ink-3">
              Add the block dates to see which nights fall inside the block.
            </li>
          )}
        </ul>
      </figure>

      <section aria-labelledby="grid-heading" className="space-y-3">
        <div>
          <h3
            id="grid-heading"
            className="font-display text-xl font-medium text-ink"
          >
            Rooms by night and room type
          </h3>
          <p className="mt-0.5 text-[13px] text-ink-2">
            Sharers count as people, not rooms. Compare these numbers with the
            block in the contract.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Rooms needed per night for each room type, with totals
            </caption>
            <thead>
              <tr className="border-b border-line bg-sunken/60 text-[11px] text-ink-2">
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-sunken px-3 py-2 text-left font-medium tracking-wide uppercase"
                >
                  Room type
                </th>
                {grid.nights.map((night, index) => (
                  <th
                    key={night}
                    scope="col"
                    className={cx(
                      "px-2 py-2 text-right font-medium whitespace-nowrap",
                      headerTone(kinds[index]),
                    )}
                  >
                    <span className="block text-ink-3">{weekday(night)}</span>
                    {dayMonth(night)}
                    <span className="sr-only">
                      {" "}
                      ({KIND_LABEL[kinds[index] ?? "unknown"]})
                    </span>
                  </th>
                ))}
                <th
                  scope="col"
                  className="px-3 py-2 text-right font-medium tracking-wide uppercase"
                >
                  Room nights
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {grid.rows.map((row) => (
                <tr
                  key={row.roomType}
                  className="border-b border-line last:border-b-0"
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-mono text-xs font-medium text-ink"
                  >
                    {row.roomType}
                  </th>
                  {row.cells.map((cell, index) => (
                    <td
                      key={grid.nights[index]}
                      className={cx(
                        "px-2 py-2 text-right",
                        cell === 0 ? "text-ink-3" : "text-ink",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-medium text-ink">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="tabular-nums">
              <tr className="border-t border-line-strong bg-sunken/40 font-semibold">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-sunken px-3 py-2 text-left text-xs tracking-wide text-ink uppercase"
                >
                  Total rooms
                </th>
                {grid.totals.map((total, index) => (
                  <td
                    key={grid.nights[index]}
                    className="px-2 py-2 text-right text-ink"
                  >
                    {total}
                  </td>
                ))}
                <td className="px-3 py-2 text-right text-ink">
                  {totalRoomNights}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section aria-labelledby="types-heading" className="space-y-3">
        <h3
          id="types-heading"
          className="font-display text-xl font-medium text-ink"
        >
          Room types
        </h3>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Rooms and room nights per room type
            </caption>
            <thead>
              <tr className="border-b border-line bg-sunken/60 text-[11px] tracking-wide text-ink-2 uppercase">
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Room type
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Rooms
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Room nights
                </th>
                <th
                  scope="col"
                  className="hidden px-4 py-2 text-left font-medium sm:table-cell"
                >
                  Share
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Max guests
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {report.summary.byRoomType.map((type) => {
                const share =
                  totalRoomNights === 0 ? 0 : type.roomNights / totalRoomNights;
                return (
                  <tr
                    key={type.roomType}
                    className="border-b border-line last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="px-4 py-2.5 text-left font-mono text-xs font-medium text-ink"
                    >
                      {type.roomType}
                    </th>
                    <td className="px-4 py-2.5 text-right">{type.rooms}</td>
                    <td className="px-4 py-2.5 text-right">
                      {type.roomNights}
                    </td>
                    <td className="hidden px-4 py-2.5 sm:table-cell">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-28 overflow-hidden rounded-full bg-sunken"
                        >
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${share * 100}%` }}
                          />
                        </span>
                        <span className="text-xs text-ink-2">
                          {Math.round(share * 100)}%
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink-2">
                      {maxOccupancy?.[type.roomType] ?? (
                        <span className="text-ink-3">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function headerTone(kind: NightKind | undefined): string {
  if (kind === "shoulder") return "text-warning-ink";
  if (kind === "outside") return "text-danger-ink";
  return "text-ink-2";
}
