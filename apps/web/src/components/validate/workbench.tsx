"use client";

import type {
  DateOrder,
  Issue,
  ValidateReport,
} from "@alihdrndm/roomlist-core";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { FileDrop, fileKind } from "@/components/file-drop";
import { useHandoff } from "@/components/handoff";
import {
  ArrowRightIcon,
  CheckIcon,
  ColumnsIcon,
  FileIcon,
  ListIcon,
  MoonIcon,
  ResetIcon,
  SwapIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import {
  Callout,
  ProgressBar,
  Skeleton,
  Status,
} from "@/components/ui/feedback";
import { Field, inputClass } from "@/components/ui/field";
import { ProblemNotice } from "@/components/ui/problem-notice";
import { Card, Eyebrow } from "@/components/ui/surface";
import { isoOrUndefined } from "@/lib/dates";
import {
  type BlockForm,
  blockFormFrom,
  buildBlock,
  EMPTY_BLOCK,
  roomTypeList,
} from "@/lib/forms";
import type { Problem } from "@/lib/problem";
import {
  countIssues,
  type IssueFilter,
  plural,
  skippedBlockChecks,
} from "@/lib/report";
import { postForm } from "@/lib/request";
import { BlockPanel } from "./block-panel";
import type { ColumnMap } from "./columns-tab";
import { type ExportLock, ExportPanel } from "./export-panel";
import { type ReportTab, ReportView } from "./report-view";

/** Everything one validate request is made of. */
type Inputs = {
  file: File;
  block: BlockForm;
  dateOrder: DateOrder;
  columnMap: ColumnMap;
  sheetName: string;
};

/** A finished validation and the inputs it was made with. */
type Run = { key: string; inputs: Inputs; report: ValidateReport };

/** Identifies a set of inputs, so a report can tell when it no longer matches them. */
function keyOf(inputs: Inputs): string {
  const { file } = inputs;
  return JSON.stringify([
    file.name,
    file.size,
    file.lastModified,
    buildBlock(inputs.block) ?? null,
    inputs.dateOrder,
    inputs.columnMap,
    inputs.sheetName.trim(),
  ]);
}

/** The form parts every request shares: the file, the block (if any) and the reading options. */
function formOf(inputs: Inputs): FormData {
  const form = new FormData();
  form.append("file", inputs.file, inputs.file.name);
  const block = buildBlock(inputs.block);
  if (block !== undefined) form.append("block", JSON.stringify(block));
  const sheetName = inputs.sheetName.trim();
  form.append(
    "options",
    JSON.stringify({
      dateOrder: inputs.dateOrder,
      ...(Object.keys(inputs.columnMap).length > 0
        ? { columnMap: inputs.columnMap }
        : {}),
      ...(sheetName !== "" ? { sheetName } : {}),
    }),
  );
  return form;
}

const DATE_ORDERS = [
  { value: "MDY", label: "MM/DD", hint: "US" },
  { value: "DMY", label: "DD/MM", hint: "Europe" },
] as const;

export function Workbench() {
  const router = useRouter();
  const handoff = useHandoff();
  const sheetId = useId();
  const [file, setFile] = useState<File | undefined>();
  const [block, setBlock] = useState<BlockForm>(EMPTY_BLOCK);
  const [dateOrder, setDateOrder] = useState<DateOrder>("MDY");
  const [columnMap, setColumnMap] = useState<ColumnMap>({});
  const [sheetName, setSheetName] = useState("");
  const [run, setRun] = useState<Run | undefined>();
  const [problem, setProblem] = useState<Problem | undefined>();
  const [validating, setValidating] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [sampleStatus, setSampleStatus] = useState("");
  const [tab, setTab] = useState<ReportTab>("issues");
  const [filter, setFilter] = useState<IssueFilter>("all");
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  // Only the latest request may update the page, if an older one answers late.
  const latest = useRef(0);

  const inputs: Inputs | undefined =
    file === undefined
      ? undefined
      : { file, block, dateOrder, columnMap, sheetName };
  const stale =
    run !== undefined && inputs !== undefined && keyOf(inputs) !== run.key;

  // On narrow screens the report sits below the settings: bring it into view when
  // a check finishes, unless its top is already visible.
  const revealReport = () => {
    requestAnimationFrame(() => {
      const top = reportRef.current?.getBoundingClientRect().top;
      if (
        top !== undefined &&
        (top > window.innerHeight * 0.8 || top < 0) &&
        window.innerWidth < 1024
      )
        reportRef.current?.scrollIntoView({
          behavior: scrollBehavior(),
          block: "start",
        });
    });
  };

  const validate = async (next: Inputs) => {
    const request = ++latest.current;
    setValidating(true);
    setProblem(undefined);
    setOutcome("");
    const result = await postForm(
      "/api/validate",
      formOf(next),
      async (response) => (await response.json()) as ValidateReport,
    );
    if (request !== latest.current) return;
    setValidating(false);
    if (result.ok) {
      const report = result.value;
      setRun({ key: keyOf(next), inputs: next, report });
      const { errors, warnings } = countIssues(report.issues);
      setOutcome(
        `Validated: ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}.`,
      );
      // A file whose required columns were not found is fixed by mapping them.
      if (report.issues.some((issue) => issue.ruleId === "F005"))
        setTab("columns");
      revealReport();
    } else {
      setRun(undefined);
      setProblem(result.problem);
      setOutcome(
        result.problem.code === "NETWORK"
          ? "Validation failed: no connection."
          : `Validation failed: ${result.problem.title}.`,
      );
    }
  };

  const chooseFile = (chosen: File | undefined) => {
    setFile(chosen);
    setSampleStatus("");
    if (chosen === undefined) {
      latest.current++;
      setValidating(false);
      setRun(undefined);
      setProblem(undefined);
      setOutcome("");
      return;
    }
    // Choosing a file is an explicit action, so the check starts at once.
    void validate({ file: chosen, block, dateOrder, columnMap, sheetName });
  };

  // A file handed over from Compare ("Open in Validate").
  useEffect(() => {
    const given = handoff.take("validate");
    if (given !== undefined) chooseFile(given.file);
  }, []);

  const loadSample = async () => {
    setSampleStatus("Loading the sample…");
    try {
      const [csv, blockJson] = await Promise.all([
        fetch("/samples/we1.csv"),
        fetch("/samples/tech26.json"),
      ]);
      if (!csv.ok || !blockJson.ok) throw new Error("sample missing");
      const sample = new File([await csv.blob()], "we1.csv", {
        type: "text/csv",
      });
      const sampleBlock = blockFormFrom(await blockJson.json());
      setFile(sample);
      setBlock(sampleBlock);
      setDateOrder("MDY");
      setColumnMap({});
      setSheetName("");
      setSampleStatus("Sample loaded: we1.csv with the TECH26 block.");
      void validate({
        file: sample,
        block: sampleBlock,
        dateOrder: "MDY",
        columnMap: {},
        sheetName: "",
      });
    } catch {
      setSampleStatus("The sample could not be loaded. Please try again.");
    }
  };

  const openBlock = (field?: string) => {
    const details = detailsRef.current;
    if (details === null) return;
    details.open = true;
    const target = details.querySelector<HTMLElement>(
      field === undefined ? "input" : `[data-field="${field}"]`,
    );
    target?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
    target?.focus({ preventScroll: true });
  };

  const showErrors = () => {
    setTab("issues");
    setFilter("error");
    reportRef.current?.scrollIntoView({
      behavior: scrollBehavior(),
      block: "start",
    });
  };

  const usedBlock = run?.inputs.block;
  const blockErrors: Partial<Record<string, string>> = {};
  for (const error of problem?.errors ?? []) {
    if (error.path.startsWith("block.")) {
      const field = error.path.slice("block.".length).split(".")[0] ?? "";
      blockErrors[field] = error.message;
    }
  }

  const issueActions = (issue: Issue) => {
    if (run === undefined) return null;
    const switchOrder = run.inputs.dateOrder === "MDY" ? "DMY" : "MDY";
    switch (issue.ruleId) {
      case "W201":
      case "F005":
      case "F006":
        return (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setTab("columns")}
          >
            <ColumnsIcon className="size-3.5" />
            {issue.ruleId === "W201" ? "Map this column" : "Check the columns"}
          </Button>
        );
      case "R002":
      case "W205":
        return (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setDateOrder(switchOrder);
              void validate({ ...run.inputs, dateOrder: switchOrder });
            }}
          >
            <SwapIcon className="size-3.5" />
            Read dates as {switchOrder === "DMY" ? "DD/MM" : "MM/DD"}
          </Button>
        );
      case "R004":
      case "W202":
      case "R005":
      case "W204":
      case "R013":
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              openBlock(
                issue.ruleId === "R005" || issue.ruleId === "W204"
                  ? "roomTypes"
                  : issue.ruleId === "R013"
                    ? undefined
                    : "startDate",
              )
            }
          >
            Edit block details
          </Button>
        );
      default:
        return null;
    }
  };

  const lock: ExportLock =
    run === undefined
      ? { kind: "no-report" }
      : stale
        ? { kind: "stale" }
        : countIssues(run.report.issues).errors > 0
          ? { kind: "errors", errors: countIssues(run.report.issues).errors }
          : { kind: "open" };

  const isExcel =
    file !== undefined &&
    (fileKind(file.name) === "XLSX" || run?.report.format === "xlsx");

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,350px)_minmax(0,1fr)]">
      <aside
        aria-label="Rooming list and settings"
        className="space-y-4 print:hidden"
      >
        <section aria-labelledby="list-heading" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="list-heading">
              <Eyebrow>1 · Rooming list</Eyebrow>
            </h2>
          </div>
          <FileDrop
            label="Rooming list file"
            file={file}
            onChange={chooseFile}
          />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] text-ink-3">No file to hand?</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadSample}
              className="-ml-1 text-accent hover:text-accent-strong"
            >
              Load sample
            </Button>
          </div>
          <Status className="text-xs empty:hidden">{sampleStatus}</Status>
          {isExcel && (
            <Field
              id={sheetId}
              label="Worksheet"
              optional
              hint="Leave blank to read the first sheet of the workbook."
            >
              <input
                id={sheetId}
                type="text"
                value={sheetName}
                placeholder="First sheet"
                aria-describedby={`${sheetId}-hint`}
                onChange={(event) => setSheetName(event.target.value)}
                className={inputClass}
              />
            </Field>
          )}
        </section>

        <section aria-labelledby="block-heading" className="space-y-3">
          <h2 id="block-heading">
            <Eyebrow>2 · Room block</Eyebrow>
          </h2>
          <BlockPanel
            block={block}
            onChange={setBlock}
            errors={blockErrors}
            detailsRef={detailsRef}
          />
        </section>

        <section aria-labelledby="reading-heading" className="space-y-3">
          <h2 id="reading-heading">
            <Eyebrow>3 · Reading</Eyebrow>
          </h2>
          <Card className="space-y-3 px-4 py-3.5">
            <Segmented
              legend="Date order in the file"
              name="date-order"
              value={dateOrder}
              onChange={setDateOrder}
              options={DATE_ORDERS}
            />
            <p className="text-xs leading-5 text-ink-3">
              How to read dates like 03/04/2026. Dates written 2026-04-03 always
              read correctly.
            </p>
            {Object.keys(columnMap).length > 0 && (
              <p className="flex items-center gap-2 border-t border-line pt-3 text-[13px] text-ink-2">
                <ColumnsIcon className="size-4 text-accent" />
                {plural(Object.keys(columnMap).length, "column")} read your way
                <button
                  type="button"
                  className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-strong"
                  onClick={() => setColumnMap({})}
                >
                  <ResetIcon className="size-3.5" /> Reset
                </button>
              </p>
            )}
          </Card>
        </section>

        <div className="space-y-2 pt-1">
          <Button
            size="lg"
            className="w-full"
            disabled={file === undefined}
            aria-disabled={validating || undefined}
            pending={validating}
            onClick={() => {
              if (inputs !== undefined && !validating) void validate(inputs);
            }}
          >
            {!validating && <CheckIcon />}
            {stale ? "Validate again" : "Validate"}
          </Button>
          <Status className="text-center">
            {validating
              ? "Validating…"
              : file === undefined
                ? "Choose a file or load the sample first."
                : outcome}
          </Status>
        </div>
      </aside>

      <div className="min-w-0 space-y-8">
        <div
          ref={reportRef}
          className="scroll-mt-6 space-y-4"
          aria-busy={validating}
        >
          {validating && <ProgressBar label="Validating the rooming list" />}
          {problem !== undefined && (
            <ProblemNotice problem={problem}>
              {inputs !== undefined && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void validate(inputs)}
                >
                  <ResetIcon className="size-3.5" />
                  Try again
                </Button>
              )}
              {Object.keys(blockErrors).length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openBlock(Object.keys(blockErrors)[0])}
                >
                  Fix the block details
                </Button>
              )}
            </ProblemNotice>
          )}
          {run === undefined &&
            problem === undefined &&
            (validating ? <ReportSkeleton /> : <Intro onSample={loadSample} />)}
          {run !== undefined && (
            <>
              {stale && !validating && (
                <Callout
                  tone="accent"
                  title="Your settings changed since this report."
                  actions={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        inputs !== undefined && void validate(inputs)
                      }
                    >
                      Apply the changes
                    </Button>
                  }
                >
                  The report below shows the previous settings. Converting waits
                  until the list is checked again.
                </Callout>
              )}
              <ReportView
                report={run.report}
                fileName={run.inputs.file.name}
                stale={stale}
                tab={tab}
                onTab={setTab}
                filter={filter}
                onFilter={setFilter}
                blockWindow={{
                  start: isoOrUndefined(run.inputs.block.startDate),
                  end: isoOrUndefined(run.inputs.block.endDate),
                  shoulderDays: /^\d+$/.test(
                    run.inputs.block.shoulderDays.trim(),
                  )
                    ? Number(run.inputs.block.shoulderDays)
                    : 0,
                }}
                maxOccupancy={usedBlock?.maxOccupancy}
                skippedChecks={
                  usedBlock === undefined
                    ? []
                    : skippedBlockChecks({
                        hasDates:
                          usedBlock.startDate.trim() !== "" ||
                          usedBlock.endDate.trim() !== "",
                        hasRoomTypes: roomTypeList(usedBlock).length > 0,
                        hasMaxOccupancy:
                          Object.keys(usedBlock.maxOccupancy ?? {}).length > 0,
                      })
                }
                columnMap={columnMap}
                onColumnMap={setColumnMap}
                issueActions={issueActions}
                onAddBlock={() => openBlock()}
                verdictActions={
                  <>
                    {countIssues(run.report.issues).errors > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={showErrors}
                      >
                        Show the errors
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handoff.give({
                          to: "compare",
                          before: run.inputs.file,
                        });
                        router.push("/compare");
                      }}
                    >
                      <SwapIcon className="size-3.5" />
                      Compare with a newer version
                    </Button>
                  </>
                }
              />
            </>
          )}
        </div>
        <div className="print:hidden">
          <ExportPanel
            lock={lock}
            buildForm={() =>
              inputs === undefined ? undefined : formOf(inputs)
            }
            onOpenBlock={openBlock}
            onJumpToErrors={showErrors}
          />
        </div>
      </div>
    </div>
  );
}

/** Smooth scrolling, unless the person asked their system for reduced motion. */
function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

/** What the report will hold, before there is one: real descriptions, no fake data. */
function Intro({ onSample }: { onSample: () => void }) {
  const items = [
    {
      icon: <ListIcon className="size-5" />,
      title: "Every issue, by row",
      text: "31 numbered checks: names, dates, the block window, room types, occupancy, sharers and duplicates, each with the fix.",
    },
    {
      icon: <MoonIcon className="size-5" />,
      title: "Rooms per night",
      text: "Rooms and room nights per night and per room type: the numbers you hold against the contract.",
    },
    {
      icon: <FileIcon className="size-5" />,
      title: "The hotel's import file",
      text: "OPERA 5 XML, OPERA Cloud Excel or Maestro CSV, written only when the list has no errors.",
    },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-6 py-6 sm:px-8 sm:py-8">
        <p className="font-display text-2xl leading-8 font-medium text-ink sm:text-[28px]">
          Check a rooming list before the hotel does.
        </p>
        <p className="mt-2 max-w-xl text-[15px] leading-6 text-ink-2">
          Choose the client&apos;s spreadsheet on the left. It is checked as
          soon as you choose it; add the room block to check dates, room types
          and occupancy too.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onSample}>
            Try it with the sample list
            <ArrowRightIcon />
          </Button>
        </div>
      </div>
      <ul className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((item) => (
          <li key={item.title} className="px-6 py-5">
            <span className="text-accent">{item.icon}</span>
            <p className="mt-2 text-sm font-semibold text-ink">{item.title}</p>
            <p className="mt-1 text-[13px] leading-5 text-ink-2">{item.text}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-28 rounded-xl" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
      <Skeleton className="h-9 w-2/3" />
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-14" />
      ))}
    </div>
  );
}
