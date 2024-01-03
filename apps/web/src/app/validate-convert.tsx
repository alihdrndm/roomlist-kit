"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileField } from "@/components/file-field";
import {
  Button,
  EmptyState,
  ProblemNotice,
  SeverityBadge,
  Status,
  Tile,
  Tiles,
} from "@/components/ui";
import {
  type BlockForm,
  blockFormFrom,
  buildBlock,
  buildTargetOptions,
  EMPTY_BLOCK,
  fileNameFrom,
  type OptionField,
  optionFields,
} from "@/lib/forms";
import { type Problem, readProblem } from "@/lib/problem";
import type { TargetInfo, TargetsResponse, ValidateReport } from "@/lib/types";

type DateOrder = "MDY" | "DMY";
type IssueFilter = "all" | "error" | "warning";

const BLOCK_FIELDS: {
  key: Exclude<keyof BlockForm, "maxOccupancy">;
  label: string;
  type: string;
  hint?: string;
}[] = [
  { key: "propertyCode", label: "Property code", type: "text" },
  { key: "blockCode", label: "Block code", type: "text" },
  {
    key: "groupReservationNumber",
    label: "Group reservation number",
    type: "text",
  },
  { key: "startDate", label: "Start date", type: "date" },
  {
    key: "endDate",
    label: "End date",
    type: "date",
    hint: "The last departure date of the block.",
  },
  { key: "shoulderDays", label: "Shoulder days", type: "number" },
  {
    key: "roomTypes",
    label: "Room types",
    type: "text",
    hint: "Comma-separated, for example KING, QQ.",
  },
];

/** "buildingCode" → "Building code". */
function labelFor(name: string): string {
  const words = name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The form parts every request shares: the file, the block (if any) and the date order. */
function baseForm(
  file: File,
  block: BlockForm,
  dateOrder: DateOrder,
): FormData {
  const form = new FormData();
  form.append("file", file, file.name);
  const blockJson = buildBlock(block);
  if (blockJson !== undefined) form.append("block", JSON.stringify(blockJson));
  form.append("options", JSON.stringify({ dateOrder }));
  return form;
}

export function ValidateConvert() {
  const [file, setFile] = useState<File | undefined>();
  const [block, setBlock] = useState<BlockForm>(EMPTY_BLOCK);
  const [dateOrder, setDateOrder] = useState<DateOrder>("MDY");
  const [report, setReport] = useState<ValidateReport | undefined>();
  const [validating, setValidating] = useState(false);
  const [problem, setProblem] = useState<Problem | undefined>();
  const [filter, setFilter] = useState<IssueFilter>("all");
  const [sampleStatus, setSampleStatus] = useState("");
  // What the live region announces when a validation finishes.
  const [outcome, setOutcome] = useState("");

  // Any change to the inputs makes the last report stale, so it is cleared.
  const changeInputs = () => {
    setReport(undefined);
    setProblem(undefined);
    setOutcome("");
  };

  const loadSample = async () => {
    setSampleStatus("Loading the sample…");
    try {
      const [csv, blockJson] = await Promise.all([
        fetch("/samples/we1.csv"),
        fetch("/samples/tech26.json"),
      ]);
      if (!csv.ok || !blockJson.ok) throw new Error("sample missing");
      setFile(new File([await csv.blob()], "we1.csv", { type: "text/csv" }));
      setBlock(blockFormFrom(await blockJson.json()));
      setDateOrder("MDY");
      changeInputs();
      setSampleStatus(
        "Sample loaded: we1.csv with the TECH26 block. Press Validate.",
      );
    } catch {
      setSampleStatus("The sample could not be loaded. Please try again.");
    }
  };

  const validate = async () => {
    if (file === undefined) return;
    setValidating(true);
    setProblem(undefined);
    setReport(undefined);
    setOutcome("");
    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        body: baseForm(file, block, dateOrder),
      });
      if (response.ok) {
        const result = (await response.json()) as ValidateReport;
        setReport(result);
        const errorCount = result.issues.filter(
          (issue) => issue.severity === "error",
        ).length;
        setOutcome(
          `Validated: ${errorCount} error${errorCount === 1 ? "" : "s"}, ${result.issues.length - errorCount} warning${result.issues.length - errorCount === 1 ? "" : "s"}.`,
        );
      } else {
        const failure = await readProblem(response);
        setProblem(failure);
        setOutcome(`Validation failed: ${failure.title}.`);
      }
    } catch {
      setOutcome("Validation failed: no connection.");
      setProblem({
        status: 0,
        code: "NETWORK",
        title: "No connection",
        detail:
          "The request did not reach the server. Check your connection and try again.",
      });
    } finally {
      setValidating(false);
    }
  };

  const errors =
    report?.issues.filter((issue) => issue.severity === "error").length ?? 0;
  const warnings = (report?.issues.length ?? 0) - errors;

  return (
    <div className="space-y-8">
      <section aria-labelledby="upload-heading" className="space-y-4">
        <h2 id="upload-heading" className="text-xl font-semibold">
          1. Rooming list
        </h2>
        <FileField
          label="Rooming list file"
          file={file}
          onChange={(chosen) => {
            setFile(chosen);
            changeInputs();
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={loadSample}>
            Load sample
          </Button>
          <Status>{sampleStatus}</Status>
        </div>

        <details className="rounded-lg border border-zinc-300 bg-white p-4">
          <summary className="cursor-pointer font-medium">
            Block details (optional)
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {BLOCK_FIELDS.map((field) => (
              <div key={field.key}>
                <label
                  htmlFor={`block-${field.key}`}
                  className="block text-sm font-medium"
                >
                  {field.label}
                </label>
                <input
                  id={`block-${field.key}`}
                  type={field.type}
                  min={field.type === "number" ? 0 : undefined}
                  max={field.type === "number" ? 7 : undefined}
                  value={block[field.key]}
                  aria-describedby={
                    field.hint ? `block-${field.key}-hint` : undefined
                  }
                  onChange={(event) => {
                    setBlock({ ...block, [field.key]: event.target.value });
                    changeInputs();
                  }}
                  className="mt-1 w-full rounded-md border border-zinc-400 px-3 py-2"
                />
                {field.hint && (
                  <p
                    id={`block-${field.key}-hint`}
                    className="mt-1 text-sm text-zinc-700"
                  >
                    {field.hint}
                  </p>
                )}
              </div>
            ))}
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium">
                Date order in the file
              </legend>
              <div className="mt-1 flex gap-6">
                {(
                  [
                    ["MDY", "MM/DD"],
                    ["DMY", "DD/MM"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="date-order"
                      value={value}
                      checked={dateOrder === value}
                      onChange={() => {
                        setDateOrder(value);
                        changeInputs();
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </details>

        <div className="flex items-center gap-3">
          <Button
            onClick={validate}
            disabled={file === undefined || validating}
          >
            Validate
          </Button>
          <Status>
            {validating
              ? "Validating…"
              : file === undefined
                ? "Choose a file or load the sample first."
                : outcome}
          </Status>
        </div>
      </section>

      <section aria-labelledby="result-heading" className="space-y-4">
        <h2 id="result-heading" className="text-xl font-semibold">
          2. Result
        </h2>
        {problem !== undefined && <ProblemNotice problem={problem} />}
        {report === undefined && problem === undefined && (
          <EmptyState>
            {validating
              ? "Validating the list…"
              : "No result yet. Choose a file and press Validate."}
          </EmptyState>
        )}
        {report !== undefined && (
          <>
            <Tiles>
              <Tile label="Guests" value={report.summary.entries} />
              <Tile label="Rooms" value={report.summary.rooms} />
              <Tile label="Room nights" value={report.summary.roomNights} />
              <Tile
                label="Errors"
                value={errors}
                tone={errors > 0 ? "error" : "neutral"}
              />
              <Tile
                label="Warnings"
                value={warnings}
                tone={warnings > 0 ? "warning" : "neutral"}
              />
            </Tiles>
            <IssuesTable report={report} filter={filter} onFilter={setFilter} />
            <NightsTable report={report} />
          </>
        )}
      </section>

      <ConvertPanel
        file={file}
        block={block}
        dateOrder={dateOrder}
        enabled={report !== undefined && errors === 0}
      />
    </div>
  );
}

function IssuesTable({
  report,
  filter,
  onFilter,
}: {
  report: ValidateReport;
  filter: IssueFilter;
  onFilter: (filter: IssueFilter) => void;
}) {
  // The API already sorts errors first; filtering keeps that order.
  const shown = report.issues.filter(
    (issue) => filter === "all" || issue.severity === filter,
  );
  return (
    <div className="space-y-3">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Show issues</legend>
        {(
          [
            ["all", "All"],
            ["error", "Errors"],
            ["warning", "Warnings"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            variant="secondary"
            pressed={filter === value}
            onClick={() => onFilter(value)}
          >
            {label}
          </Button>
        ))}
      </fieldset>
      {shown.length === 0 ? (
        <EmptyState>
          {report.issues.length === 0
            ? "No issues found."
            : "No issues of this kind."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-300 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Issues found in the rooming list
            </caption>
            <thead className="bg-zinc-100">
              <tr>
                {["Severity", "Row", "Field", "Code", "Message"].map(
                  (heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-3 py-2 font-semibold"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {shown.map((issue, index) => (
                <tr
                  key={`${issue.ruleId}-${issue.row ?? ""}-${index}`}
                  className="border-t border-zinc-200"
                >
                  <td className="px-3 py-2">
                    <SeverityBadge severity={issue.severity} />
                  </td>
                  <td className="px-3 py-2">{issue.row ?? "–"}</td>
                  <td className="px-3 py-2">{issue.field ?? "–"}</td>
                  <td className="px-3 py-2">
                    <code>{issue.code}</code>
                  </td>
                  <td className="px-3 py-2">{issue.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NightsTable({ report }: { report: ValidateReport }) {
  if (report.summary.byNight.length === 0)
    return <EmptyState>No nights to show: no stay has valid dates.</EmptyState>;
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-300 bg-white sm:max-w-sm">
      <table className="w-full text-left text-sm">
        <caption className="px-3 py-2 text-left font-semibold">Nights</caption>
        <thead className="bg-zinc-100">
          <tr>
            <th scope="col" className="px-3 py-2">
              Night of
            </th>
            <th scope="col" className="px-3 py-2">
              Rooms
            </th>
          </tr>
        </thead>
        <tbody>
          {report.summary.byNight.map((night) => (
            <tr key={night.date} className="border-t border-zinc-200">
              <td className="px-3 py-2">{night.date}</td>
              <td className="px-3 py-2">{night.rooms}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConvertPanel({
  file,
  block,
  dateOrder,
  enabled,
}: {
  file: File | undefined;
  block: BlockForm;
  dateOrder: DateOrder;
  enabled: boolean;
}) {
  const [targets, setTargets] = useState<TargetInfo[] | undefined>();
  const [targetsProblem, setTargetsProblem] = useState<Problem | undefined>();
  const [targetId, setTargetId] = useState("");
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [converting, setConverting] = useState(false);
  const [problem, setProblem] = useState<Problem | undefined>();
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/formats")
      .then(async (response) => {
        if (cancelled) return;
        if (response.ok) {
          const body = (await response.json()) as TargetsResponse;
          setTargets(body.targets);
          setTargetId((current) => current || (body.targets[0]?.id ?? ""));
        } else {
          setTargetsProblem(await readProblem(response));
        }
      })
      .catch(() => {
        if (!cancelled)
          setTargetsProblem({
            status: 0,
            code: "NETWORK",
            title: "No connection",
            detail: "The list of formats could not be loaded.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const target = targets?.find((candidate) => candidate.id === targetId);
  const fields: OptionField[] = useMemo(
    () => (target ? optionFields(target.optionsSchema) : []),
    [target],
  );
  const assumed =
    target?.provenance.filter((item) => item.status === "assumed") ?? [];

  const download = async () => {
    if (file === undefined || target === undefined) return;
    setConverting(true);
    setProblem(undefined);
    setStatus("Converting…");
    try {
      const form = baseForm(file, block, dateOrder);
      form.append("target", target.id);
      form.append(
        "targetOptions",
        JSON.stringify(buildTargetOptions(fields, values)),
      );
      const response = await fetch("/api/convert", {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        setProblem(await readProblem(response));
        setStatus("");
        return;
      }
      const name = fileNameFrom(
        response.headers.get("content-disposition"),
        `rooming-list.${target.fileExtension}`,
      );
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      // Revoking in the same tick can cancel the download in Firefox and Safari.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      const warningCount = Number(
        response.headers.get("x-roomlist-warnings") ?? "0",
      );
      setStatus(
        `Downloaded ${name}${warningCount > 0 ? ` (${warningCount} warning${warningCount === 1 ? "" : "s"})` : ""}.`,
      );
    } catch {
      setProblem({
        status: 0,
        code: "NETWORK",
        title: "No connection",
        detail: "The request did not reach the server. Try again.",
      });
      setStatus("");
    } finally {
      setConverting(false);
    }
  };

  return (
    <section
      aria-labelledby="convert-heading"
      className="space-y-4 rounded-lg border border-zinc-300 bg-white p-4"
    >
      <h2 id="convert-heading" className="text-xl font-semibold">
        3. Convert
      </h2>
      {!enabled && (
        <p className="text-zinc-700">
          Validate the list first. Converting is possible when it has no errors.
        </p>
      )}
      {targetsProblem !== undefined && (
        <ProblemNotice problem={targetsProblem} />
      )}
      {targets === undefined && targetsProblem === undefined && (
        <Status>Loading the formats…</Status>
      )}
      {targets !== undefined && (
        // No opacity on the fieldset: it would also fade the assumed-aspects text
        // below AA contrast. Disabled controls get the browser's own styling.
        <fieldset disabled={!enabled || converting} className="space-y-4">
          <legend className="sr-only">Export options</legend>
          <div>
            <label htmlFor="target" className="block text-sm font-medium">
              Format
            </label>
            <select
              id="target"
              value={targetId}
              onChange={(event) => {
                setTargetId(event.target.value);
                setValues({});
                setProblem(undefined);
              }}
              className="mt-1 rounded-md border border-zinc-400 bg-white px-3 py-2"
            >
              {targets.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
            </select>
          </div>
          {fields.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <OptionInput
                  key={`${targetId}-${field.name}`}
                  field={field}
                  values={values}
                  onChange={setValues}
                />
              ))}
            </div>
          )}
          {assumed.length > 0 && (
            <div className="text-sm text-zinc-700">
              <p>Assumed, not verified against a real system:</p>
              <ul className="mt-1 list-disc pl-5">
                {assumed.map((item) => (
                  <li key={item.aspect}>{item.aspect}</li>
                ))}
              </ul>
              <p className="mt-1">
                <Link href="/formats" className="text-blue-800 underline">
                  See what is verified and what is assumed for every format
                </Link>
                .
              </p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button onClick={download} disabled={!enabled || converting}>
              Download
            </Button>
            <Status>{status}</Status>
          </div>
        </fieldset>
      )}
      {problem !== undefined && <ProblemNotice problem={problem} />}
    </section>
  );
}

function OptionInput({
  field,
  values,
  onChange,
}: {
  field: OptionField;
  values: Record<string, string | boolean>;
  onChange: (values: Record<string, string | boolean>) => void;
}) {
  const id = `option-${field.name}`;
  const label = labelFor(field.name);
  if (field.kind === "checkbox") {
    const checked = (values[field.name] ?? field.defaultValue) === true;
    return (
      <label
        htmlFor={id}
        className="inline-flex items-center gap-2 text-sm font-medium"
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) =>
            onChange({ ...values, [field.name]: event.target.checked })
          }
        />
        {label}
      </label>
    );
  }
  const value = String(values[field.name] ?? field.defaultValue);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {field.kind === "select" ? (
        <select
          id={id}
          value={value}
          onChange={(event) =>
            onChange({ ...values, [field.name]: event.target.value })
          }
          className="mt-1 rounded-md border border-zinc-400 bg-white px-3 py-2"
        >
          {field.choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) =>
            onChange({ ...values, [field.name]: event.target.value })
          }
          className="mt-1 w-full rounded-md border border-zinc-400 px-3 py-2"
        />
      )}
    </div>
  );
}
