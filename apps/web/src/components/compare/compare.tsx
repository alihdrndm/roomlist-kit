"use client";

import type { DateOrder, DiffReport } from "@alihdrndm/roomlist-core";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { FileDrop } from "@/components/file-drop";
import { useHandoff } from "@/components/handoff";
import {
  ArrowRightIcon,
  CopyIcon,
  DownloadIcon,
  ResetIcon,
  SearchIcon,
  SwapIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Pagination, Segmented } from "@/components/ui/controls";
import {
  Badge,
  EmptyState,
  ProgressBar,
  Status,
} from "@/components/ui/feedback";
import { inputClass } from "@/components/ui/field";
import { ProblemNotice } from "@/components/ui/problem-notice";
import { Stat, StatGrid } from "@/components/ui/stat";
import { Card, Eyebrow, SectionTitle } from "@/components/ui/surface";
import { csvBlob, toCsv } from "@/lib/csv";
import { cx } from "@/lib/cx";
import { dateRange, dayMonth, nightsOf, weekday } from "@/lib/dates";
import {
  type ChangeKind,
  type ChangeRow,
  changeCsvRows,
  changeRows,
  deltas,
  filterChanges,
  signedDelta,
  updateNote,
} from "@/lib/diff";
import { baseName, copyText, saveBlob } from "@/lib/download";
import { fieldLabel } from "@/lib/fields";
import type { Problem } from "@/lib/problem";
import { guestName, plural } from "@/lib/report";
import { postForm } from "@/lib/request";

const PAGE_SIZE = 50;

const KIND_STYLE: Record<
  ChangeKind,
  {
    mark: string;
    word: string;
    tone: "success" | "danger" | "accent";
    rule: string;
  }
> = {
  added: {
    mark: "+",
    word: "Added",
    tone: "success",
    rule: "before:bg-success",
  },
  removed: {
    mark: "−",
    word: "Removed",
    tone: "danger",
    rule: "before:bg-danger",
  },
  changed: {
    mark: "~",
    word: "Changed",
    tone: "accent",
    rule: "before:bg-accent",
  },
};

export function Compare() {
  const router = useRouter();
  const handoff = useHandoff();
  const [before, setBefore] = useState<File | undefined>();
  const [after, setAfter] = useState<File | undefined>();
  const [dateOrder, setDateOrder] = useState<DateOrder>("MDY");
  const [report, setReport] = useState<DiffReport | undefined>();
  const [names, setNames] = useState({ before: "", after: "" });
  const [comparing, setComparing] = useState(false);
  const [problem, setProblem] = useState<Problem | undefined>();
  const [outcome, setOutcome] = useState("");
  const [sampleStatus, setSampleStatus] = useState("");

  // A list handed over from Validate ("Compare with a newer version") is the earlier one.
  useEffect(() => {
    const given = handoff.take("compare");
    if (given !== undefined) setBefore(given.before);
  }, []);

  const clearResult = () => {
    setReport(undefined);
    setProblem(undefined);
    setOutcome("");
  };

  const compare = async (first = before, second = after, order = dateOrder) => {
    if (first === undefined || second === undefined) return;
    setComparing(true);
    clearResult();
    const form = new FormData();
    form.append("before", first, first.name);
    form.append("after", second, second.name);
    form.append("options", JSON.stringify({ dateOrder: order }));
    const result = await postForm(
      "/api/diff",
      form,
      async (response) => (await response.json()) as DiffReport,
    );
    setComparing(false);
    if (result.ok) {
      setReport(result.value);
      setNames({ before: first.name, after: second.name });
      const { added, removed, changed } = result.value.summary;
      setOutcome(
        `Compared: ${added} added, ${removed} removed, ${changed} changed.`,
      );
    } else {
      setProblem(result.problem);
      setOutcome(
        result.problem.code === "NETWORK"
          ? "Comparison failed: no connection."
          : `Comparison failed: ${result.problem.title}.`,
      );
    }
  };

  const loadSamples = async () => {
    setSampleStatus("Loading the sample pair…");
    try {
      const [v1, v2] = await Promise.all([
        fetch("/samples/list-v1.csv"),
        fetch("/samples/list-v2.csv"),
      ]);
      if (!v1.ok || !v2.ok) throw new Error("sample missing");
      const first = new File([await v1.blob()], "list-v1.csv", {
        type: "text/csv",
      });
      const second = new File([await v2.blob()], "list-v2.csv", {
        type: "text/csv",
      });
      setBefore(first);
      setAfter(second);
      setDateOrder("MDY");
      setSampleStatus("Sample pair loaded: list-v1.csv and list-v2.csv.");
      void compare(first, second, "MDY");
    } catch {
      setSampleStatus("The samples could not be loaded. Please try again.");
    }
  };

  const ready = before !== undefined && after !== undefined;
  const sides = new Set(
    (problem?.issues ?? [])
      .filter((issue) => issue.severity === "error")
      .map((issue) => issue.side),
  );
  const openInValidate = (file: File | undefined) => {
    if (file === undefined) return;
    handoff.give({ to: "validate", file });
    router.push("/");
  };

  return (
    <div className="space-y-10">
      <Card as="section" labelledBy="files-heading" className="p-5 sm:p-6">
        <h2 id="files-heading">
          <Eyebrow>Two versions of the same list</Eyebrow>
        </h2>
        <div className="mt-4 grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <FileDrop
            label="Earlier list"
            file={before}
            compact
            onChange={(file) => {
              setBefore(file);
              clearResult();
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="justify-self-center"
            disabled={before === undefined && after === undefined}
            onClick={() => {
              setBefore(after);
              setAfter(before);
              clearResult();
            }}
            aria-label="Swap the earlier and later list"
          >
            <SwapIcon className="size-4 md:rotate-0" />
            <span className="md:sr-only">Swap</span>
          </Button>
          <FileDrop
            label="Later list"
            file={after}
            compact
            onChange={(file) => {
              setAfter(file);
              clearResult();
            }}
          />
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-4 border-t border-line pt-5">
          <Segmented
            legend="Date order in both files"
            name="compare-date-order"
            value={dateOrder}
            onChange={(value) => {
              setDateOrder(value);
              clearResult();
            }}
            options={[
              { value: "MDY", label: "MM/DD", hint: "US" },
              { value: "DMY", label: "DD/MM", hint: "Europe" },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            <Button
              variant="ghost"
              onClick={loadSamples}
              className="text-accent hover:text-accent-strong"
            >
              Load sample pair
            </Button>
            <Button
              onClick={() => void compare()}
              disabled={!ready}
              pending={comparing}
              size="lg"
            >
              {!comparing && <SwapIcon />}
              Compare
            </Button>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <Status>
            {comparing
              ? "Comparing…"
              : ready
                ? outcome
                : "Choose both files first."}
          </Status>
          <Status className="text-xs empty:hidden">{sampleStatus}</Status>
        </div>
      </Card>

      <section
        aria-labelledby="changes-heading"
        className="space-y-5"
        aria-busy={comparing}
      >
        <SectionTitle
          id="changes-heading"
          description="Guests are matched by confirmation number first, then by name; line numbers are ignored, because lists get renumbered."
        >
          Changes
        </SectionTitle>
        {comparing && <ProgressBar label="Comparing the lists" />}
        {problem !== undefined && (
          <ProblemNotice problem={problem}>
            {sides.has("before") && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openInValidate(before)}
              >
                Open the earlier list in Validate
                <ArrowRightIcon className="size-3.5" />
              </Button>
            )}
            {sides.has("after") && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openInValidate(after)}
              >
                Open the later list in Validate
                <ArrowRightIcon className="size-3.5" />
              </Button>
            )}
            {problem.code !== "LIST_INVALID" && ready && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void compare()}
              >
                <ResetIcon className="size-3.5" />
                Try again
              </Button>
            )}
          </ProblemNotice>
        )}
        {report === undefined && problem === undefined && !comparing && (
          <EmptyState
            icon={<SwapIcon className="size-5" />}
            title="No comparison yet."
            actions={
              <Button variant="secondary" size="sm" onClick={loadSamples}>
                Try the sample pair
              </Button>
            }
          >
            Choose the version you sent to the hotel and the one the client just
            sent. You get who was added, removed and changed, where the room
            nights moved, and an update you can paste into an email.
          </EmptyState>
        )}
        {report !== undefined && <DiffResult report={report} names={names} />}
      </section>
    </div>
  );
}

function DiffResult({
  report,
  names,
}: {
  report: DiffReport;
  names: { before: string; after: string };
}) {
  const { summary } = report;
  const searchId = useId();
  const [kind, setKind] = useState<ChangeKind | "all">("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [shareStatus, setShareStatus] = useState("");
  const rows = useMemo(() => changeRows(report), [report]);
  const shown = filterChanges(rows, kind, query);
  const moved = useMemo(() => deltas(report), [report]);
  const peak = Math.max(
    1,
    ...moved.byNight.map((night) => Math.abs(night.delta)),
  );
  const deltaTone =
    summary.roomNightsDelta > 0
      ? "success"
      : summary.roomNightsDelta < 0
        ? "danger"
        : "neutral";

  return (
    <div className="space-y-8 motion-safe:animate-rise">
      <Card className="p-5 sm:p-6">
        <StatGrid>
          <Stat
            id="added"
            label="Added"
            value={summary.added}
            tone={summary.added > 0 ? "success" : "neutral"}
            detail="New guests"
          />
          <Stat
            id="removed"
            label="Removed"
            value={summary.removed}
            tone={summary.removed > 0 ? "danger" : "neutral"}
            detail="Cancellations"
          />
          <Stat
            id="changed"
            label="Changed"
            value={summary.changed}
            detail={`${plural(summary.unchanged, "guest")} unchanged`}
          />
          <Stat
            id="room-night-change"
            label="Room-night change"
            value={signedDelta(summary.roomNightsDelta)}
            tone={deltaTone === "neutral" ? "neutral" : deltaTone}
            detail={`${summary.roomNightsBefore} → ${summary.roomNightsAfter} room nights`}
          />
        </StatGrid>
        {(moved.byNight.length > 0 || moved.byRoomType.length > 0) && (
          <div className="mt-6 grid gap-6 border-t border-line pt-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div>
              <h3 className="text-[13px] font-semibold text-ink">
                Rooms per night, change
              </h3>
              <ul className="mt-3 space-y-1.5">
                {moved.byNight.map((night) => (
                  <li
                    key={night.date}
                    className="grid grid-cols-[96px_minmax(0,1fr)_44px] items-center gap-3 text-[13px]"
                  >
                    <span className="text-ink-2">
                      {weekday(night.date)} {dayMonth(night.date)}
                    </span>
                    <span
                      aria-hidden="true"
                      className="relative h-2.5 rounded-full bg-sunken"
                    >
                      <span
                        className={cx(
                          "absolute inset-y-0 rounded-full",
                          night.delta > 0
                            ? "left-1/2 bg-success"
                            : "right-1/2 bg-danger",
                        )}
                        style={{
                          width: `${(Math.abs(night.delta) / peak) * 50}%`,
                        }}
                      />
                      <span className="absolute inset-y-[-3px] left-1/2 w-px bg-line-strong" />
                    </span>
                    <span
                      className={cx(
                        "text-right font-medium tabular-nums",
                        night.delta > 0
                          ? "text-success-ink"
                          : "text-danger-ink",
                      )}
                    >
                      {signedDelta(night.delta)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-ink">
                Room nights by room type
              </h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {moved.byRoomType.map((type) => (
                  <li key={type.roomType}>
                    <Badge
                      mono
                      tone={type.delta > 0 ? "success" : "danger"}
                      className="text-[12px]"
                    >
                      {type.roomType} {signedDelta(type.delta)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <fieldset className="flex flex-wrap gap-1.5">
            <legend className="sr-only">Show changes</legend>
            {(
              [
                ["all", "All", rows.length],
                ["added", "Added", summary.added],
                ["removed", "Removed", summary.removed],
                ["changed", "Changed", summary.changed],
              ] as const
            ).map(([value, label, count]) => (
              <Button
                key={value}
                variant="secondary"
                size="sm"
                pressed={kind === value}
                onClick={() => {
                  setKind(value);
                  setPage(0);
                }}
              >
                {label}
                <span className="font-mono text-[11px] text-ink-3">
                  {count}
                </span>
              </Button>
            ))}
          </fieldset>
          <div className="relative min-w-48 flex-1 sm:max-w-72">
            <label htmlFor={searchId} className="sr-only">
              Search changes
            </label>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" />
            <input
              id={searchId}
              type="search"
              value={query}
              placeholder="Search guest, room type…"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              className={cx(inputClass, "h-8 pl-8 text-[13px]")}
            />
          </div>
          <div className="flex gap-1.5 sm:ml-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const copied = await copyText(updateNote(report, names));
                setShareStatus(
                  copied
                    ? "Copied the update: paste it into your email to the hotel."
                    : "The browser did not allow copying. Save the changes as CSV instead.",
                );
              }}
            >
              <CopyIcon className="size-3.5" />
              Copy update for the hotel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const name = `${baseName(names.after)}-changes.csv`;
                saveBlob(csvBlob(toCsv(changeCsvRows(report))), name);
                setShareStatus(`Saved ${name}.`);
              }}
            >
              <DownloadIcon className="size-3.5" />
              Save changes (CSV)
            </Button>
          </div>
        </div>
        <p
          role="status"
          aria-live="polite"
          className="-mt-2 text-xs text-ink-2 empty:hidden"
        >
          {shareStatus}
        </p>
        {rows.length === 0 ? (
          <EmptyState title="The two lists are the same.">
            No guest was added, removed or changed.
          </EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState title="No changes match.">
            Change the filter or the search.
          </EmptyState>
        ) : (
          <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {shown
              .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
              .map((row) => (
                <ChangeItem key={row.key} row={row} />
              ))}
          </ol>
        )}
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={shown.length}
          onPage={setPage}
          noun="changes"
        />
      </div>
    </div>
  );
}

function ChangeItem({ row }: { row: ChangeRow }) {
  const style = KIND_STYLE[row.kind];
  const { entry } = row;
  const nights = nightsOf(entry.arrivalDate, entry.departureDate);
  return (
    <li
      className={cx(
        "relative grid gap-x-4 gap-y-2 px-4 py-3.5 text-sm before:absolute before:inset-y-0 before:left-0 before:w-[3px] md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1.4fr)]",
        style.rule,
      )}
    >
      <span>
        <Badge tone={style.tone}>
          <span aria-hidden="true" className="font-mono">
            {style.mark}
          </span>
          {style.word}
        </Badge>
      </span>
      <div className="min-w-0">
        <p
          className={cx(
            "font-medium",
            row.kind === "removed"
              ? "text-ink-2 line-through decoration-ink-3"
              : "text-ink",
          )}
        >
          {guestName(entry)}
        </p>
        <p className="mt-0.5 font-mono text-[11.5px] text-ink-3">
          Line {entry.line}
          {entry.confirmationNumber !== undefined &&
            ` · conf. ${entry.confirmationNumber}`}
        </p>
      </div>
      <div className="min-w-0 text-ink-2">
        {row.kind === "changed" ? (
          <ul className="space-y-1">
            {row.changes.map((change) => (
              <li
                key={change.field}
                className="flex flex-wrap items-baseline gap-x-2"
              >
                <span className="w-28 shrink-0 text-[13px] text-ink-3">
                  {fieldLabel(change.field)}
                </span>
                <del className="text-ink-3 decoration-ink-3">
                  {change.before ?? "(empty)"}
                </del>
                <span aria-hidden="true" className="text-ink-3">
                  →
                </span>
                <ins className="font-medium text-ink no-underline">
                  {change.after ?? "(empty)"}
                </ins>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {entry.arrivalDate !== undefined &&
            entry.departureDate !== undefined
              ? `${dateRange(entry.arrivalDate, entry.departureDate)} · ${plural(nights, "night")}`
              : "Dates missing"}
            {entry.roomType !== undefined && (
              <>
                {" · "}
                <Badge mono>{entry.roomType}</Badge>
              </>
            )}
            {entry.rooms > 1 && ` · ${entry.rooms} rooms`}
          </p>
        )}
      </div>
    </li>
  );
}
