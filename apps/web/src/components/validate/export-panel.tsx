"use client";

import type { TargetInfo, TargetsResponse } from "@alihdrndm/roomlist-core";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CheckCircleIcon,
  DownloadIcon,
  LockIcon,
  WarningIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Status } from "@/components/ui/feedback";
import { Field, inputClass, selectClass } from "@/components/ui/field";
import { ProblemNotice } from "@/components/ui/problem-notice";
import { Card, SectionTitle } from "@/components/ui/surface";
import { saveBlob } from "@/lib/download";
import { labelFor } from "@/lib/fields";
import {
  buildTargetOptions,
  fileNameFrom,
  type OptionField,
  optionFields,
} from "@/lib/forms";
import type { Problem } from "@/lib/problem";
import { plural } from "@/lib/report";
import { getJson, postForm } from "@/lib/request";

export type ExportLock =
  | { kind: "open" }
  | { kind: "no-report" }
  | { kind: "errors"; errors: number }
  | { kind: "stale" };

/** What a target writes: a short line per format, shown under the select. */
const PURPOSE: Record<string, string> = {
  "opera5-xml": "XML for the OPERA 5 rooming list import.",
  "opera-cloud-xlsx": "Excel workbook for the OPERA Cloud room list import.",
  "maestro-csv": "CSV for the Maestro group rooming list import.",
  "canonical-json": "Every field, as JSON: for scripts and other tools.",
  "canonical-csv":
    "Every field, as a clean CSV: for spreadsheets and other tools.",
};

export function ExportPanel({
  lock,
  buildForm,
  onOpenBlock,
  onJumpToErrors,
}: {
  lock: ExportLock;
  /** The validate request's form (file, block, options); the target is added here. */
  buildForm: () => FormData | undefined;
  onOpenBlock: (field?: string) => void;
  onJumpToErrors: () => void;
}) {
  const id = useId();
  const [targets, setTargets] = useState<TargetInfo[] | undefined>();
  const [targetsProblem, setTargetsProblem] = useState<Problem | undefined>();
  const [targetId, setTargetId] = useState("");
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [converting, setConverting] = useState(false);
  const [problem, setProblem] = useState<Problem | undefined>();
  const [status, setStatus] = useState("");
  const [done, setDone] = useState<
    { name: string; warnings: number } | undefined
  >();
  const optionRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    let cancelled = false;
    getJson<TargetsResponse>("/api/formats").then((outcome) => {
      if (cancelled) return;
      if (outcome.ok) {
        setTargets(outcome.value.targets);
        setTargetId(
          (current) => current || (outcome.value.targets[0]?.id ?? ""),
        );
      } else {
        setTargetsProblem({
          ...outcome.problem,
          detail: `The list of formats could not be loaded. ${outcome.problem.detail}`,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A new validation (or a change to the inputs) makes the last download's message stale.
  const lockKind = lock.kind;
  useEffect(() => {
    if (lockKind !== "open") {
      setStatus("");
      setDone(undefined);
      setProblem(undefined);
    }
  }, [lockKind]);

  const target = targets?.find((candidate) => candidate.id === targetId);
  const fields: OptionField[] = useMemo(
    () => (target ? optionFields(target.optionsSchema) : []),
    [target],
  );
  const assumed =
    target?.provenance.filter((item) => item.status === "assumed") ?? [];
  const verified =
    target?.provenance.filter((item) => item.status === "verified") ?? [];
  const enabled = lock.kind === "open";

  const download = async () => {
    const form = buildForm();
    if (form === undefined || target === undefined || converting) return;
    setConverting(true);
    setProblem(undefined);
    setDone(undefined);
    setStatus("Converting…");
    form.append("target", target.id);
    form.append(
      "targetOptions",
      JSON.stringify(buildTargetOptions(fields, values)),
    );
    const outcome = await postForm("/api/convert", form, (response) =>
      response.blob(),
    );
    setConverting(false);
    if (!outcome.ok) {
      setProblem(outcome.problem);
      setStatus("");
      return;
    }
    const name = fileNameFrom(
      outcome.response.headers.get("content-disposition"),
      `rooming-list.${target.fileExtension}`,
    );
    saveBlob(outcome.value, name);
    const warnings = Number(
      outcome.response.headers.get("x-roomlist-warnings") ?? "0",
    );
    setDone({ name, warnings });
    setStatus(
      `Downloaded ${name}${warnings > 0 ? ` (${plural(warnings, "warning")})` : ""}.`,
    );
  };

  /** Recovery actions for an export precondition (X001) or an option error. */
  const recovery = (failure: Problem) => {
    const fieldsNamed = new Set([
      ...(failure.issues ?? []).map((issue) => issue.field ?? ""),
      ...(failure.errors ?? []).map((error) =>
        error.path.replace(/^targetOptions\./, ""),
      ),
    ]);
    return (
      <>
        {fieldsNamed.has("groupReservationNumber") && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenBlock("groupReservationNumber")}
          >
            Add the group reservation number
          </Button>
        )}
        {fields
          .filter((field) => fieldsNamed.has(field.name))
          .map((field) => (
            <Button
              key={field.name}
              variant="secondary"
              size="sm"
              onClick={() => optionRefs.current.get(field.name)?.focus()}
            >
              Fill in {labelFor(field.name).toLowerCase()}
            </Button>
          ))}
      </>
    );
  };

  return (
    <Card as="section" labelledBy={`${id}-heading`} className="overflow-hidden">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <SectionTitle
          id={`${id}-heading`}
          description="Write the list in the shape your hotel's system imports."
          actions={
            enabled ? (
              <Badge tone="success">
                <CheckCircleIcon className="size-3.5" /> Ready
              </Badge>
            ) : (
              <Badge tone="neutral">
                <LockIcon className="size-3.5" /> Locked
              </Badge>
            )
          }
        >
          Convert for the hotel
        </SectionTitle>
      </div>
      <div className="space-y-5 px-5 py-5 sm:px-6">
        {lock.kind === "no-report" && (
          <p className="text-sm text-ink-2">
            Validate the list first. Converting opens once the list has no
            errors.
          </p>
        )}
        {lock.kind === "errors" && (
          <Callout
            tone="danger"
            title={`Fix ${plural(lock.errors, "error")} to convert.`}
            actions={
              <Button variant="secondary" size="sm" onClick={onJumpToErrors}>
                Show the errors
              </Button>
            }
          >
            A file with errors would be refused by the hotel or import wrong
            reservations, so it is never written.
          </Callout>
        )}
        {lock.kind === "stale" && (
          <Callout
            tone="accent"
            title="Validate again to convert with your changes."
          />
        )}
        {targetsProblem !== undefined && (
          <ProblemNotice problem={targetsProblem} />
        )}
        {targets === undefined && targetsProblem === undefined && (
          <Status>Loading the formats…</Status>
        )}
        {targets !== undefined && (
          // No opacity on the fieldset: it would fade the assumptions below AA contrast.
          <fieldset
            disabled={!enabled || converting}
            className="min-w-0 space-y-5"
          >
            <legend className="sr-only">Export options</legend>
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <Field
                  id="target"
                  label="Format"
                  hint={target === undefined ? undefined : PURPOSE[target.id]}
                >
                  <select
                    id="target"
                    value={targetId}
                    aria-describedby="target-hint"
                    onChange={(event) => {
                      setTargetId(event.target.value);
                      setValues({});
                      setProblem(undefined);
                      setDone(undefined);
                      setStatus("");
                    }}
                    className={selectClass}
                  >
                    {targets.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.label}
                      </option>
                    ))}
                  </select>
                </Field>
                {fields.map((field) => (
                  <OptionInput
                    key={`${targetId}-${field.name}`}
                    field={field}
                    values={values}
                    onChange={setValues}
                    inputRef={(node) => {
                      if (node) optionRefs.current.set(field.name, node);
                      else optionRefs.current.delete(field.name);
                    }}
                  />
                ))}
              </div>
              {target !== undefined && (
                <div className="rounded-lg border border-line bg-canvas/60 p-4 text-[13px] leading-5">
                  <p className="flex flex-wrap items-center gap-2 text-ink">
                    <span className="font-medium">{target.label}</span>
                    <Badge mono>.{target.fileExtension}</Badge>
                  </p>
                  {target.provenance.length === 0 ? (
                    <p className="mt-2 text-ink-2">
                      Our own format: nothing to verify against a hotel system.
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 text-ink-2">
                        {plural(verified.length, "detail")} checked against the
                        vendor&apos;s documentation.
                        {assumed.length > 0 &&
                          " Assumed, not verified against a real system:"}
                      </p>
                      {assumed.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {assumed.map((item) => (
                            <li
                              key={item.aspect}
                              className="flex gap-2 text-ink-2"
                            >
                              <WarningIcon className="mt-0.5 size-3.5 text-warning" />
                              <span>{item.aspect}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-3">
                        <Link
                          href={`/formats#${target.id}`}
                          className="text-accent underline underline-offset-2"
                        >
                          What is verified and assumed for {target.label}
                        </Link>
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <Button
                onClick={download}
                disabled={!enabled}
                pending={converting}
                size="lg"
              >
                {!converting && <DownloadIcon />}
                Download
              </Button>
              <Status>{status}</Status>
            </div>
          </fieldset>
        )}
        {done !== undefined && done.warnings > 0 && (
          <p className="text-[13px] text-ink-2">
            The file was written with {plural(done.warnings, "warning")}; they
            are listed with the issues above.
          </p>
        )}
        {problem !== undefined && (
          <ProblemNotice problem={problem}>{recovery(problem)}</ProblemNotice>
        )}
      </div>
    </Card>
  );
}

function OptionInput({
  field,
  values,
  onChange,
  inputRef,
}: {
  field: OptionField;
  values: Record<string, string | boolean>;
  onChange: (values: Record<string, string | boolean>) => void;
  inputRef: (node: HTMLElement | null) => void;
}) {
  const id = `option-${field.name}`;
  const label = labelFor(field.name);
  if (field.kind === "checkbox") {
    const checked = (values[field.name] ?? field.defaultValue) === true;
    return (
      <label
        htmlFor={id}
        className="flex items-center gap-2.5 text-[13px] font-medium text-ink"
      >
        <input
          ref={inputRef}
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) =>
            onChange({ ...values, [field.name]: event.target.checked })
          }
          className="size-4"
        />
        {label}
      </label>
    );
  }
  const value = String(values[field.name] ?? field.defaultValue);
  return (
    <Field id={id} label={label} optional={!field.required}>
      {field.kind === "select" ? (
        <select
          ref={inputRef}
          id={id}
          value={value}
          onChange={(event) =>
            onChange({ ...values, [field.name]: event.target.value })
          }
          className={selectClass}
        >
          {field.choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      ) : (
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(event) =>
            onChange({ ...values, [field.name]: event.target.value })
          }
          className={inputClass}
        />
      )}
    </Field>
  );
}
