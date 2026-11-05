"use client";

import type { CanonicalField, ValidateReport } from "@alihdrndm/roomlist-core";
import Link from "next/link";
import { useId } from "react";
import { ResetIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Badge, Callout, EmptyState } from "@/components/ui/feedback";
import { selectClass } from "@/components/ui/field";
import { cx } from "@/lib/cx";
import { CANONICAL_FIELD_LABELS, CANONICAL_FIELDS } from "@/lib/fields";

export type ColumnMap = Record<string, CanonicalField | null>;

const IGNORE = "__ignore__";

/**
 * How each column of the file was read, with a select to read it differently. The
 * choice travels in the request's existing `options.columnMap` (keys are the header
 * text exactly as in the file); nothing is stored.
 */
export function ColumnsTab({
  report,
  columnMap,
  onChange,
  stale,
}: {
  report: ValidateReport;
  columnMap: ColumnMap;
  onChange: (map: ColumnMap) => void;
  stale: boolean;
}) {
  const id = useId();
  const changed = Object.keys(columnMap).length;
  const used = new Map<CanonicalField, number>();
  for (const column of report.columns) {
    const field = Object.hasOwn(columnMap, column.header)
      ? columnMap[column.header]
      : column.field;
    if (field) used.set(field, (used.get(field) ?? 0) + 1);
  }

  if (report.columns.length === 0)
    return (
      <EmptyState title="No columns were read.">
        The file has no header row we could find. Check that the first rows hold
        the column names.
      </EmptyState>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[13px] leading-6 text-ink-2">
          Every column of your file and the field it is read as. Headers are
          recognised by name (see the{" "}
          <Link
            href="/guide#columns"
            className="text-accent underline underline-offset-2"
          >
            list of names
          </Link>
          ); if one is read wrongly or ignored, choose the right field and
          validate again. Your file is not changed.
        </p>
        {changed > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange({})}>
            <ResetIcon className="size-3.5" />
            Reset {changed} {changed === 1 ? "change" : "changes"}
          </Button>
        )}
      </div>
      {stale && changed > 0 && (
        <Callout
          tone="accent"
          title="Validate again to apply the new mapping."
        />
      )}
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div
          aria-hidden="true"
          className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_120px] gap-x-4 border-b border-line bg-sunken/60 px-4 py-2 text-[11px] font-medium tracking-wide text-ink-2 uppercase sm:grid"
        >
          <span>Column in your file</span>
          <span>Read as</span>
          <span>Status</span>
        </div>
        <ul className="divide-y divide-line">
          {report.columns.map((column, index) => {
            const selectId = `${id}-${index}`;
            const own = Object.hasOwn(columnMap, column.header);
            const field = own ? columnMap[column.header] : column.field;
            const duplicate =
              field !== null &&
              field !== undefined &&
              (used.get(field) ?? 0) > 1;
            return (
              <li
                key={`${column.header}-${index}`}
                className="grid items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_120px]"
              >
                <label
                  htmlFor={selectId}
                  className="min-w-0 truncate font-mono text-[13px] text-ink"
                  title={column.header}
                >
                  <span className="sr-only">Column </span>
                  {column.header}
                </label>
                <select
                  id={selectId}
                  value={field ?? IGNORE}
                  onChange={(event) => {
                    const value = event.target.value;
                    const next: ColumnMap = { ...columnMap };
                    const chosen =
                      value === IGNORE ? null : (value as CanonicalField);
                    // Choosing what the file was read as anyway needs no override.
                    if (!own && chosen === column.field) return;
                    next[column.header] = chosen;
                    onChange(next);
                  }}
                  className={cx(
                    selectClass,
                    "h-9",
                    field === null && "text-ink-3",
                  )}
                >
                  <option value={IGNORE}>Ignore this column</option>
                  {CANONICAL_FIELDS.map((candidate) => (
                    <option key={candidate} value={candidate}>
                      {CANONICAL_FIELD_LABELS[candidate]}
                    </option>
                  ))}
                </select>
                <span className="flex flex-wrap gap-1">
                  {duplicate ? (
                    <Badge tone="danger">Used twice</Badge>
                  ) : own ? (
                    <Badge tone="accent">Set by you</Badge>
                  ) : field === null ? (
                    <Badge tone="warning">Ignored</Badge>
                  ) : (
                    <Badge tone="success">Recognised</Badge>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
