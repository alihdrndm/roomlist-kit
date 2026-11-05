"use client";

import type { Issue, ValidateReport } from "@alihdrndm/roomlist-core";
import { type ReactNode, useId, useMemo, useState } from "react";
import {
  CheckCircleIcon,
  CopyIcon,
  DownloadIcon,
  SearchIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Pagination, Segmented } from "@/components/ui/controls";
import { Badge, EmptyState, SeverityBadge } from "@/components/ui/feedback";
import { inputClass } from "@/components/ui/field";
import { csvBlob, toCsv } from "@/lib/csv";
import { cx } from "@/lib/cx";
import { baseName, copyText, saveBlob } from "@/lib/download";
import { fieldLabel } from "@/lib/fields";
import {
  clientNote,
  countIssues,
  filterIssues,
  groupByRule,
  guestName,
  type IssueFilter,
  issueRows,
  makeGuestLookup,
  messageBody,
} from "@/lib/report";
import { ruleGuide } from "@/lib/rules";

const PAGE_SIZE = 50;

type Grouping = "row" | "rule";

export function IssuesTab({
  report,
  fileName,
  filter,
  onFilter,
  actions,
}: {
  report: ValidateReport;
  fileName: string;
  filter: IssueFilter;
  onFilter: (filter: IssueFilter) => void;
  /** Fix-it buttons for an issue (map a column, switch date order, open the block). */
  actions: (issue: Issue) => ReactNode;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [grouping, setGrouping] = useState<Grouping>("row");
  const [page, setPage] = useState(0);
  const [shareStatus, setShareStatus] = useState("");
  const guestOf = useMemo(() => makeGuestLookup(report), [report]);
  const { errors, warnings } = countIssues(report.issues);
  const shown = useMemo(
    () => filterIssues(report.issues, filter, query, guestOf),
    [report.issues, filter, query, guestOf],
  );
  const pageItems = shown.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const groups = groupByRule(pageItems);

  const setFilter = (next: IssueFilter) => {
    onFilter(next);
    setPage(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <fieldset className="flex flex-wrap gap-1.5">
          <legend className="sr-only">Show issues</legend>
          {(
            [
              ["all", "All", report.issues.length],
              ["error", "Errors", errors],
              ["warning", "Warnings", warnings],
            ] as const
          ).map(([value, label, count]) => (
            <Button
              key={value}
              variant="secondary"
              size="sm"
              pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
              <span className="font-mono text-[11px] text-ink-3">{count}</span>
            </Button>
          ))}
        </fieldset>
        <div className="relative min-w-48 flex-1 sm:max-w-72">
          <label htmlFor={searchId} className="sr-only">
            Search issues
          </label>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" />
          <input
            id={searchId}
            type="search"
            value={query}
            placeholder="Search row, guest, field…"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            className={cx(inputClass, "h-8 pl-8 text-[13px]")}
          />
        </div>
        <Segmented
          legend="Group issues"
          hideLegend
          name="issue-grouping"
          size="sm"
          value={grouping}
          onChange={setGrouping}
          options={[
            { value: "row", label: "By row" },
            { value: "rule", label: "By check" },
          ]}
        />
        {report.issues.length > 0 && (
          <div className="flex gap-1.5 sm:ml-auto print:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const name = `${baseName(fileName)}-issues.csv`;
                saveBlob(csvBlob(toCsv(issueRows(report))), name);
                setShareStatus(`Saved ${name}.`);
              }}
            >
              <DownloadIcon className="size-3.5" />
              Save issue list (CSV)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const copied = await copyText(clientNote(report, fileName));
                setShareStatus(
                  copied
                    ? "Copied a note for the list's owner: paste it into an email."
                    : "The browser did not allow copying. Save the issue list instead.",
                );
              }}
            >
              <CopyIcon className="size-3.5" />
              Copy note for the client
            </Button>
          </div>
        )}
      </div>
      <p
        role="status"
        aria-live="polite"
        className="-mt-2 text-xs text-ink-2 empty:hidden"
      >
        {shareStatus}
      </p>

      {shown.length === 0 ? (
        report.issues.length === 0 ? (
          <EmptyState
            icon={<CheckCircleIcon className="size-5 text-success" />}
            title="No issues found."
          >
            Every row passed every check that applies to this list.
          </EmptyState>
        ) : (
          <EmptyState title="No issues match.">
            Change the filter or the search to see more.
          </EmptyState>
        )
      ) : grouping === "row" ? (
        <IssueList issues={pageItems} guestOf={guestOf} actions={actions} />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const guide = ruleGuide(group.ruleId);
            return (
              <section
                key={group.ruleId}
                aria-labelledby={`${searchId}-${group.ruleId}`}
                className="overflow-hidden rounded-lg border border-line bg-surface"
              >
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1 border-b border-line bg-sunken/60 px-4 py-3">
                  <SeverityBadge
                    severity={group.issues[0]?.severity ?? "warning"}
                  />
                  <div className="min-w-0 flex-1">
                    <h3
                      id={`${searchId}-${group.ruleId}`}
                      className="text-sm font-semibold text-ink"
                    >
                      {guide.title}{" "}
                      <span className="font-normal text-ink-2">
                        · {group.issues.length}
                      </span>
                    </h3>
                    {guide.help !== "" && (
                      <p className="mt-0.5 text-[13px] leading-5 text-ink-2">
                        {guide.help}
                      </p>
                    )}
                  </div>
                  <Badge mono>
                    {group.ruleId} {group.code}
                  </Badge>
                </div>
                <IssueList
                  issues={group.issues}
                  guestOf={guestOf}
                  actions={actions}
                  bare
                />
              </section>
            );
          })}
        </div>
      )}
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={shown.length}
        onPage={setPage}
        noun="issues"
      />
    </div>
  );
}

const GRID =
  "md:grid md:grid-cols-[92px_64px_minmax(0,1fr)_minmax(0,190px)] md:gap-x-4";

function IssueList({
  issues,
  guestOf,
  actions,
  bare = false,
}: {
  issues: Issue[];
  guestOf: ReturnType<typeof makeGuestLookup>;
  actions: (issue: Issue) => ReactNode;
  bare?: boolean;
}) {
  return (
    <div
      className={cx(
        "overflow-hidden bg-surface",
        !bare && "rounded-lg border border-line",
      )}
    >
      <div
        aria-hidden="true"
        className={cx(
          GRID,
          "hidden border-b border-line bg-sunken/60 px-4 py-2 text-[11px] font-medium tracking-wide text-ink-2 uppercase",
          bare && "md:hidden",
        )}
      >
        <span>Severity</span>
        <span>Row</span>
        <span>Problem</span>
        <span>Check</span>
      </div>
      <ol className="divide-y divide-line">
        {issues.map((issue, index) => {
          const guest = guestOf(issue);
          const fix = actions(issue);
          return (
            <li
              key={`${issue.ruleId}-${issue.row ?? ""}-${issue.field ?? ""}-${index}`}
              className={cx(
                GRID,
                "relative px-4 py-3 text-sm",
                issue.severity === "error"
                  ? "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-danger"
                  : "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-warning-fill",
              )}
            >
              <div className="flex items-center gap-3 md:block">
                <SeverityBadge severity={issue.severity} />
                <span className="font-mono text-xs text-ink-2 md:hidden">
                  {issue.row === undefined ? "File" : `Row ${issue.row}`}
                </span>
              </div>
              <div className="hidden pt-0.5 font-mono text-xs text-ink-2 md:block">
                {issue.row === undefined ? (
                  <span className="text-ink-3">File</span>
                ) : (
                  <>
                    <span className="sr-only">Row </span>
                    {issue.row}
                  </>
                )}
              </div>
              <div className="mt-1.5 min-w-0 md:mt-0">
                {(guest !== undefined || issue.field !== undefined) && (
                  <p className="text-[13px] text-ink-2">
                    {guest !== undefined && (
                      <span className="font-medium text-ink">
                        {guestName(guest)}
                      </span>
                    )}
                    {guest !== undefined && issue.field !== undefined && " · "}
                    {issue.field !== undefined && fieldLabel(issue.field)}
                  </p>
                )}
                <p className="leading-6 text-ink">
                  {messageBody(issue.message)}
                </p>
                {issue.value !== undefined && (
                  <p className="mt-1">
                    <span className="sr-only">Value: </span>
                    <code className="rounded-sm border border-line bg-sunken px-1.5 py-px font-mono text-[12px] break-all text-ink underline decoration-danger/60 decoration-wavy underline-offset-4">
                      {issue.value}
                    </code>
                  </p>
                )}
                {fix !== null && fix !== undefined && fix !== false && (
                  <div className="mt-2 flex flex-wrap gap-1.5 print:hidden">
                    {fix}
                  </div>
                )}
              </div>
              <p className="mt-1.5 font-mono text-[11px] leading-5 break-all text-ink-3 md:mt-0 md:pt-0.5">
                {issue.ruleId} {issue.code}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
