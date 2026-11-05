"use client";

import type { Issue, ValidateReport } from "@alihdrndm/roomlist-core";
import type { ReactNode } from "react";
import {
  BedIcon,
  CheckCircleIcon,
  ColumnsIcon,
  ErrorIcon,
  ListIcon,
  MoonIcon,
  PrintIcon,
  WarningIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { type TabItem, Tabs, tabPanelProps } from "@/components/ui/controls";
import { Stat, StatGrid } from "@/components/ui/stat";
import { cx } from "@/lib/cx";
import { type BlockWindow, dateRange } from "@/lib/dates";
import { countIssues, type IssueFilter, plural } from "@/lib/report";
import { type ColumnMap, ColumnsTab } from "./columns-tab";
import { GuestsTab } from "./guests-tab";
import { IssuesTab } from "./issues-tab";
import { NightsTab } from "./nights-tab";

export type ReportTab = "issues" | "guests" | "nights" | "columns";

const TAB_ID = "report";

export function ReportView({
  report,
  fileName,
  stale,
  tab,
  onTab,
  filter,
  onFilter,
  blockWindow,
  maxOccupancy,
  skippedChecks,
  columnMap,
  onColumnMap,
  issueActions,
  onAddBlock,
  verdictActions,
}: {
  report: ValidateReport;
  fileName: string;
  stale: boolean;
  tab: ReportTab;
  onTab: (tab: ReportTab) => void;
  filter: IssueFilter;
  onFilter: (filter: IssueFilter) => void;
  blockWindow: BlockWindow;
  maxOccupancy: Record<string, number> | undefined;
  skippedChecks: string[];
  columnMap: ColumnMap;
  onColumnMap: (map: ColumnMap) => void;
  issueActions: (issue: Issue) => ReactNode;
  onAddBlock: () => void;
  verdictActions: ReactNode;
}) {
  const { errors, warnings } = countIssues(report.issues);
  const summary = report.summary;
  const ignoredColumns = report.columns.filter(
    (column) => column.field === null,
  ).length;
  const tabs: TabItem<ReportTab>[] = [
    {
      id: "issues",
      label: "Issues",
      count: report.issues.length,
      icon: <ListIcon />,
    },
    {
      id: "guests",
      label: "Guests & rooms",
      count: summary.entries,
      icon: <BedIcon />,
    },
    { id: "nights", label: "Nights", icon: <MoonIcon /> },
    {
      id: "columns",
      label: "Columns",
      count: report.columns.length,
      icon: <ColumnsIcon />,
    },
  ];

  return (
    <div
      className={cx(
        "space-y-6 motion-safe:animate-rise",
        stale && "opacity-75",
      )}
    >
      <Verdict
        errors={errors}
        warnings={warnings}
        stay={
          summary.firstArrival !== undefined &&
          summary.lastDeparture !== undefined
            ? dateRange(summary.firstArrival, summary.lastDeparture)
            : undefined
        }
        fileName={fileName}
        rowCount={report.rowCount}
        format={report.format}
        actions={verdictActions}
      />
      {skippedChecks.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink-2">
          <WarningIcon className="size-4 text-warning" />
          <span>
            Without block details, these checks did not run:{" "}
            {skippedChecks.join(", ")}.
          </span>
          <button
            type="button"
            onClick={onAddBlock}
            className="font-medium text-accent underline underline-offset-2 hover:text-accent-strong print:hidden"
          >
            Add block details
          </button>
        </p>
      )}
      <StatGrid>
        <Stat
          id="guests"
          label="Guests"
          value={summary.entries}
          detail={`${plural(summary.people, "person", "people")}`}
        />
        <Stat
          id="rooms"
          label="Rooms"
          value={summary.rooms}
          detail={`${plural(summary.sharers, "sharer")}`}
        />
        <Stat
          id="room-nights"
          label="Room nights"
          value={summary.roomNights}
          detail={`${plural(summary.byNight.length, "night")}`}
        />
        <Stat
          id="errors"
          label="Errors"
          value={errors}
          tone={errors > 0 ? "danger" : "neutral"}
          detail={errors > 0 ? "Must be fixed" : "None"}
        />
        <Stat
          id="warnings"
          label="Warnings"
          value={warnings}
          tone={warnings > 0 ? "warning" : "neutral"}
          detail={
            ignoredColumns > 0
              ? `${plural(ignoredColumns, "column")} ignored`
              : "To review"
          }
        />
      </StatGrid>
      <div>
        <div className="print:hidden">
          <Tabs
            label="Report sections"
            items={tabs}
            value={tab}
            onChange={onTab}
            idBase={TAB_ID}
          />
        </div>
        <div
          {...tabPanelProps(TAB_ID, tab)}
          className="pt-5 focus-visible:outline-offset-4"
        >
          {tab === "issues" && (
            <IssuesTab
              report={report}
              fileName={fileName}
              filter={filter}
              onFilter={onFilter}
              actions={issueActions}
            />
          )}
          {tab === "guests" && (
            <GuestsTab report={report} maxOccupancy={maxOccupancy} />
          )}
          {tab === "nights" && (
            <NightsTab
              report={report}
              window={blockWindow}
              maxOccupancy={maxOccupancy}
            />
          )}
          {tab === "columns" && (
            <ColumnsTab
              report={report}
              columnMap={columnMap}
              onChange={onColumnMap}
              stale={stale}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** The answer first: can this list go to the hotel? Designed ready / warnings / blocked states. */
function Verdict({
  errors,
  warnings,
  stay,
  fileName,
  rowCount,
  format,
  actions,
}: {
  errors: number;
  warnings: number;
  stay: string | undefined;
  fileName: string;
  rowCount: number;
  format: string;
  actions: ReactNode;
}) {
  const state = errors > 0 ? "blocked" : warnings > 0 ? "review" : "ready";
  const look = {
    blocked: {
      box: "border-danger-line bg-danger-soft",
      icon: <ErrorIcon className="size-6 text-danger" />,
      title: `${plural(errors, "error")} to fix before converting`,
    },
    review: {
      box: "border-success-line bg-success-soft",
      icon: <CheckCircleIcon className="size-6 text-success" />,
      title: `Ready to convert, with ${plural(warnings, "warning")} to review`,
    },
    ready: {
      box: "border-success-line bg-success-soft",
      icon: <CheckCircleIcon className="size-6 text-success" />,
      title: "Ready to convert",
    },
  }[state];
  const detail =
    state === "blocked"
      ? "Correct them in the spreadsheet (or here, if a setting is the cause) and validate again."
      : state === "review"
        ? "Warnings never block the file, but each one is worth a look before the hotel sees it."
        : "Every check passed. Choose the hotel's format below.";
  return (
    <div
      className={cx("rounded-xl border px-5 py-4 sm:px-6 sm:py-5", look.box)}
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <span className="mt-0.5">{look.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[22px] leading-7 font-medium text-ink sm:text-2xl">
            {look.title}
          </p>
          <p className="mt-1 text-sm leading-6 text-ink-2">{detail}</p>
          <p className="mt-2 font-mono text-[11.5px] text-ink-3">
            {fileName} · {format.toUpperCase()} · {plural(rowCount, "row")}
            {stay !== undefined && ` · ${stay}`}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:pl-10 print:hidden">
          {actions}
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <PrintIcon className="size-3.5" />
            Print report
          </Button>
        </div>
      </div>
    </div>
  );
}
