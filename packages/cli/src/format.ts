import { styleText } from "node:util";
import type {
  DiffReport,
  Issue,
  ParsedEntry,
  Summary,
  TargetInfo,
} from "@alihdrndm/roomlist-core";

/** The few styles the CLI uses. Colour is only ever added on top of words, never instead of them. */
export type Style = "red" | "yellow" | "green" | "bold" | "dim";

/** Wraps text in a style, or returns it unchanged when colour is off. */
export type Colorize = (style: Style, text: string) => string;

/** No colour at all; used by tests and as the safe default. */
export const plain: Colorize = (_style, text) => text;

/**
 * The spec's rule, written out: colour only when the stream is a terminal and
 * NO_COLOR is not set. Deliberately stricter than Node's own check, which lets
 * FORCE_COLOR override NO_COLOR. Pure, so each condition can be tested alone.
 */
export function shouldUseColor(
  env: Readonly<Record<string, string | undefined>>,
  isTTY: boolean,
): boolean {
  return isTTY && env.NO_COLOR === undefined;
}

/** Colour for one output stream (stdout for reports, stderr for problems). */
export function colorFor(
  stream: NodeJS.WriteStream,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Colorize {
  if (!shouldUseColor(env, stream.isTTY === true)) return plain;
  // validateStream: false — the decision was made above, so Node must not re-decide it.
  return (style, text) => styleText(style, text, { validateStream: false });
}

function pad(text: string, width: number): string {
  return text.padEnd(width, " ");
}

function severityStyle(issue: Issue): Style {
  return issue.severity === "error" ? "red" : "yellow";
}

/** A table of issues with the columns Severity, Row, Field, Code, Message. */
export function formatIssues(
  issues: readonly Issue[],
  color: Colorize = plain,
): string {
  if (issues.length === 0) return "No issues found.";
  const header = ["Severity", "Row", "Field", "Code", "Message"];
  const rows = issues.map((issue) => [
    issue.severity,
    issue.row === undefined ? "-" : String(issue.row),
    issue.field ?? "-",
    issue.code,
    issue.message,
  ]);
  // Widths come from the plain text so that colour codes never skew the columns.
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => row[column]?.length ?? 0)),
  );
  const line = (cells: readonly string[], issue?: Issue): string =>
    cells
      .map((cell, column) => {
        const padded =
          column === cells.length - 1 ? cell : pad(cell, widths[column] ?? 0);
        return column === 0 && issue
          ? color(severityStyle(issue), padded)
          : padded;
      })
      .join("  ");
  const lines = [
    color("bold", line(header)),
    ...rows.map((row, index) => line(row, issues[index])),
  ];
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.length - errors;
  lines.push(
    "",
    `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`,
  );
  return lines.join("\n");
}

/** The numbers a planner compares against the hotel's own list. */
export function formatSummary(
  summary: Summary,
  color: Colorize = plain,
): string {
  const rows: [string, string][] = [
    ["Entries", String(summary.entries)],
    ["Primaries", String(summary.primaries)],
    ["Sharers", String(summary.sharers)],
    ["Rooms", String(summary.rooms)],
    ["People", String(summary.people)],
    ["Room nights", String(summary.roomNights)],
    ["First arrival", summary.firstArrival ?? "-"],
    ["Last departure", summary.lastDeparture ?? "-"],
  ];
  const width = Math.max(...rows.map(([label]) => label.length));
  const lines = [
    color("bold", "Summary"),
    ...rows.map(([label, value]) => `  ${pad(label, width)}  ${value}`),
  ];
  if (summary.byRoomType.length > 0) {
    lines.push("", color("bold", "By room type (rooms, room nights)"));
    const typeWidth = Math.max(
      ...summary.byRoomType.map((row) => row.roomType.length),
    );
    for (const row of summary.byRoomType)
      lines.push(
        `  ${pad(row.roomType, typeWidth)}  ${row.rooms}  ${row.roomNights}`,
      );
  }
  if (summary.byNight.length > 0) {
    lines.push("", color("bold", "Rooms per night"));
    for (const night of summary.byNight)
      lines.push(`  ${night.date}  ${night.rooms}`);
  }
  return lines.join("\n");
}

/** "+4", "-2" or "0": the sign is always shown for a change so it cannot be misread. */
export function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function describeEntry(entry: ParsedEntry): string {
  const name = [entry.lastName ?? "(no last name)", entry.firstName]
    .filter(Boolean)
    .join(", ");
  return `line ${entry.line}: ${name} (${entry.arrivalDate ?? "?"} to ${entry.departureDate ?? "?"})`;
}

function shown(value: string | null): string {
  return value === null ? "(none)" : value;
}

/** Summary counts, the room-night change, then the Added, Removed and Changed sections. */
export function formatDiff(
  report: DiffReport,
  color: Colorize = plain,
): string {
  const { summary } = report;
  const lines = [
    color("bold", "Diff summary"),
    `  Added      ${summary.added}`,
    `  Removed    ${summary.removed}`,
    `  Changed    ${summary.changed}`,
    `  Unchanged  ${summary.unchanged}`,
    `  Room nights  ${summary.roomNightsBefore} -> ${summary.roomNightsAfter} (${signed(summary.roomNightsDelta)})`,
  ];
  if (report.added.length > 0) {
    lines.push("", color("green", `Added (${report.added.length})`));
    for (const entry of report.added) lines.push(`  + ${describeEntry(entry)}`);
  }
  if (report.removed.length > 0) {
    lines.push("", color("red", `Removed (${report.removed.length})`));
    for (const entry of report.removed)
      lines.push(`  - ${describeEntry(entry)}`);
  }
  if (report.changed.length > 0) {
    lines.push("", color("yellow", `Changed (${report.changed.length})`));
    for (const item of report.changed) {
      lines.push(`  ~ ${describeEntry(item.after)}`);
      for (const change of item.changes) {
        lines.push(
          `      ${change.field}: ${shown(change.before)} → ${shown(change.after)}`,
        );
      }
    }
  }
  return lines.join("\n");
}

/** One block per export target: id, label, extension, then what is verified and what is assumed. */
export function formatTargets(
  targets: readonly TargetInfo[],
  color: Colorize = plain,
): string {
  const blocks = targets.map((target) => {
    const lines = [
      `${color("bold", target.id)}  ${target.label}  (${target.fileExtension})`,
    ];
    for (const item of target.provenance) {
      const status =
        item.status === "verified"
          ? color("green", "verified")
          : color("yellow", "assumed ");
      lines.push(`  ${status}  ${item.aspect}`);
      // The source is what makes "verified" checkable, so it is always shown.
      lines.push(`            source: ${item.source}`);
    }
    return lines.join("\n");
  });
  return blocks.join("\n\n");
}
