"use client";

import { useState } from "react";
import { FileField } from "@/components/file-field";
import {
  Button,
  EmptyState,
  ProblemNotice,
  Status,
  Tile,
  Tiles,
} from "@/components/ui";
import { signed } from "@/lib/forms";
import { type Problem, readProblem } from "@/lib/problem";
import type { DiffReport } from "@/lib/types";

type DateOrder = "MDY" | "DMY";
type Entry = DiffReport["added"][number];

function guestName(entry: Entry): string {
  const last = entry.lastName ?? "(no last name)";
  return entry.firstName ? `${last}, ${entry.firstName}` : last;
}

function stay(entry: Entry): string {
  return `${entry.arrivalDate ?? "?"} → ${entry.departureDate ?? "?"}`;
}

export function Compare() {
  const [before, setBefore] = useState<File | undefined>();
  const [after, setAfter] = useState<File | undefined>();
  const [dateOrder, setDateOrder] = useState<DateOrder>("MDY");
  const [report, setReport] = useState<DiffReport | undefined>();
  const [comparing, setComparing] = useState(false);
  const [problem, setProblem] = useState<Problem | undefined>();
  // What the live region announces when a comparison finishes.
  const [outcome, setOutcome] = useState("");

  const changeInputs = () => {
    setReport(undefined);
    setProblem(undefined);
    setOutcome("");
  };

  const compare = async () => {
    if (before === undefined || after === undefined) return;
    setComparing(true);
    changeInputs();
    try {
      const form = new FormData();
      form.append("before", before, before.name);
      form.append("after", after, after.name);
      form.append("options", JSON.stringify({ dateOrder }));
      const response = await fetch("/api/diff", { method: "POST", body: form });
      if (response.ok) {
        const result = (await response.json()) as DiffReport;
        setReport(result);
        const { added, removed, changed } = result.summary;
        setOutcome(
          `Compared: ${added} added, ${removed} removed, ${changed} changed.`,
        );
      } else {
        const failure = await readProblem(response);
        setProblem(failure);
        setOutcome(`Comparison failed: ${failure.title}.`);
      }
    } catch {
      setOutcome("Comparison failed: no connection.");
      setProblem({
        status: 0,
        code: "NETWORK",
        title: "No connection",
        detail:
          "The request did not reach the server. Check your connection and try again.",
      });
    } finally {
      setComparing(false);
    }
  };

  const ready = before !== undefined && after !== undefined;

  return (
    <div className="space-y-8">
      <section aria-labelledby="files-heading" className="space-y-4">
        <h2 id="files-heading" className="text-xl font-semibold">
          1. Two versions of the list
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <FileField
            label="Earlier list"
            file={before}
            onChange={(file) => {
              setBefore(file);
              changeInputs();
            }}
          />
          <FileField
            label="Later list"
            file={after}
            onChange={(file) => {
              setAfter(file);
              changeInputs();
            }}
          />
        </div>
        <fieldset>
          <legend className="text-sm font-medium">
            Date order in both files
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
                  name="compare-date-order"
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
        <div className="flex items-center gap-3">
          <Button onClick={compare} disabled={!ready || comparing}>
            Compare
          </Button>
          <Status>
            {comparing
              ? "Comparing…"
              : ready
                ? outcome
                : "Choose both files first."}
          </Status>
        </div>
      </section>

      <section aria-labelledby="changes-heading" className="space-y-6">
        <h2 id="changes-heading" className="text-xl font-semibold">
          2. Changes
        </h2>
        {problem !== undefined && <ProblemNotice problem={problem} />}
        {report === undefined && problem === undefined && (
          <EmptyState>
            {comparing
              ? "Comparing the lists…"
              : "No comparison yet. Choose both files and press Compare."}
          </EmptyState>
        )}
        {report !== undefined && <DiffResult report={report} />}
      </section>
    </div>
  );
}

function DiffResult({ report }: { report: DiffReport }) {
  const { summary } = report;
  return (
    <>
      <Tiles>
        <Tile label="Added" value={summary.added} />
        <Tile label="Removed" value={summary.removed} />
        <Tile label="Changed" value={summary.changed} />
        <Tile
          label="Room-night change"
          value={signed(summary.roomNightsDelta)}
        />
      </Tiles>
      <p className="text-sm text-zinc-700">
        Room nights: {summary.roomNightsBefore} before,{" "}
        {summary.roomNightsAfter} after. {summary.unchanged} guest
        {summary.unchanged === 1 ? "" : "s"} unchanged.
      </p>
      <EntryTable caption="Added" entries={report.added} />
      <EntryTable caption="Removed" entries={report.removed} />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Changed</h3>
        {report.changed.length === 0 ? (
          <EmptyState>No guest changed.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-300 bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Changed guests, one row per changed field
              </caption>
              <thead className="bg-zinc-100">
                <tr>
                  {["Guest", "Field", "Before → after"].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-3 py-2 font-semibold"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.changed.flatMap((item) =>
                  item.changes.map((change, index) => (
                    <tr
                      key={`${item.after.line}-${change.field}`}
                      className="border-t border-zinc-200"
                    >
                      {index === 0 && (
                        <th
                          scope="row"
                          rowSpan={item.changes.length}
                          className="px-3 py-2 align-top font-medium"
                        >
                          {guestName(item.after)}
                        </th>
                      )}
                      <td className="px-3 py-2">{change.field}</td>
                      <td className="px-3 py-2">
                        {change.before ?? "(empty)"} →{" "}
                        {change.after ?? "(empty)"}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function EntryTable({
  caption,
  entries,
}: {
  caption: string;
  entries: Entry[];
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">{caption}</h3>
      {entries.length === 0 ? (
        <EmptyState>No guest {caption.toLowerCase()}.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-300 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{caption} guests</caption>
            <thead className="bg-zinc-100">
              <tr>
                {["Line", "Guest", "Stay", "Room type", "Rooms"].map(
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
              {entries.map((entry) => (
                <tr key={entry.line} className="border-t border-zinc-200">
                  <td className="px-3 py-2">{entry.line}</td>
                  <td className="px-3 py-2">{guestName(entry)}</td>
                  <td className="px-3 py-2">{stay(entry)}</td>
                  <td className="px-3 py-2">{entry.roomType ?? "–"}</td>
                  <td className="px-3 py-2">{entry.rooms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
