"use client";

import { type RefObject, useId, useRef, useState } from "react";
import { ChevronIcon, DownloadIcon, UploadIcon } from "@/components/icons";
import { Badge } from "@/components/ui/feedback";
import { describedBy, Field, inputClass } from "@/components/ui/field";
import { dateRange, isoOrUndefined, nightsOf } from "@/lib/dates";
import { saveBlob } from "@/lib/download";
import {
  type BlockForm,
  blockFormFrom,
  buildBlock,
  roomTypeList,
  withMaxOccupancy,
} from "@/lib/forms";
import { plural } from "@/lib/report";

type TextKey = Exclude<keyof BlockForm, "maxOccupancy">;

const FIELDS: {
  key: TextKey;
  label: string;
  type: "text" | "date" | "number";
  hint?: string;
  maxLength?: number;
  wide?: boolean;
}[] = [
  { key: "blockCode", label: "Block code", type: "text", maxLength: 40 },
  { key: "propertyCode", label: "Property code", type: "text", maxLength: 20 },
  {
    key: "groupReservationNumber",
    label: "Group reservation number",
    type: "text",
    maxLength: 20,
    hint: "Maestro needs it for every import.",
    wide: true,
  },
  { key: "startDate", label: "Start date", type: "date", hint: "First night." },
  {
    key: "endDate",
    label: "End date",
    type: "date",
    hint: "The last departure date of the block.",
  },
  {
    key: "shoulderDays",
    label: "Shoulder days",
    type: "number",
    hint: "Days allowed on each side (0–7); stays there get a rate warning.",
    wide: true,
  },
  {
    key: "roomTypes",
    label: "Room types",
    type: "text",
    hint: "Comma-separated, for example KING, QQ.",
    wide: true,
  },
];

/** One line describing the block, for the collapsed panel. */
function summaryOf(block: BlockForm): string[] {
  const parts: string[] = [];
  const code = [block.blockCode, block.propertyCode]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
  if (code) parts.push(code);
  const start = isoOrUndefined(block.startDate);
  const end = isoOrUndefined(block.endDate);
  if (start !== undefined && end !== undefined)
    parts.push(
      `${dateRange(start, end)} · ${plural(nightsOf(start, end), "night")}`,
    );
  const shoulder = Number(block.shoulderDays);
  if (block.shoulderDays.trim() !== "" && shoulder > 0)
    parts.push(`±${shoulder} shoulder`);
  const types = roomTypeList(block);
  if (types.length > 0) parts.push(types.join(", "));
  return parts;
}

export function BlockPanel({
  block,
  onChange,
  errors,
  detailsRef,
}: {
  block: BlockForm;
  onChange: (block: BlockForm) => void;
  /** Field errors from the API (VALIDATION_FAILED paths "block.<field>"). */
  errors: Partial<Record<string, string>>;
  detailsRef: RefObject<HTMLDetailsElement | null>;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileStatus, setFileStatus] = useState("");
  const [occupancyText, setOccupancyText] = useState<Record<string, string>>(
    {},
  );
  const summary = summaryOf(block);
  const types = roomTypeList(block);
  const built = buildBlock(block);

  const loadFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = "";
    if (file === undefined) return;
    try {
      const json: unknown = JSON.parse(await file.text());
      onChange(blockFormFrom(json));
      setOccupancyText({});
      setFileStatus(`Loaded ${file.name}.`);
    } catch {
      setFileStatus(`${file.name} is not a block file (JSON).`);
    }
  };

  return (
    <details
      ref={detailsRef}
      className="group rounded-lg border border-line bg-surface shadow-card"
    >
      {/* The label is a direct text child of <summary>, so the element that holds
          "Block details (optional)" is the focusable one (keyboard e2e test). */}
      <summary className="grid list-none grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 rounded-lg px-4 py-3.5 text-sm font-medium text-ink select-none hover:bg-sunken/50">
        <ChevronIcon className="mt-0.5 size-4 text-ink-3 transition-transform duration-150 group-open:rotate-90" />
        Block details (optional)
        <span
          className={`col-start-2 mt-1 block text-[13px] font-normal ${summary.length > 0 ? "text-ink-2" : "text-ink-3"}`}
        >
          {summary.length > 0
            ? summary.join(" · ")
            : "Add the block to check dates, room types and occupancy."}
        </span>
      </summary>
      <div className="border-t border-line px-4 pt-4 pb-4">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          {FIELDS.map((field) => {
            const fieldId = `${id}-${field.key}`;
            const error = errors[field.key];
            return (
              <Field
                key={field.key}
                id={fieldId}
                label={field.label}
                hint={field.hint}
                error={error}
                className={
                  field.wide
                    ? "col-span-2"
                    : "col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1"
                }
              >
                <input
                  id={fieldId}
                  data-field={field.key}
                  type={field.type}
                  inputMode={field.type === "number" ? "numeric" : undefined}
                  min={field.type === "number" ? 0 : undefined}
                  max={field.type === "number" ? 7 : undefined}
                  maxLength={field.maxLength}
                  value={block[field.key]}
                  aria-invalid={error !== undefined || undefined}
                  aria-describedby={describedBy(fieldId, field.hint, error)}
                  onChange={(event) =>
                    onChange({ ...block, [field.key]: event.target.value })
                  }
                  className={inputClass}
                />
              </Field>
            );
          })}
        </div>
        {types.length > 0 && (
          <fieldset className="mt-5">
            <legend className="text-[13px] font-medium text-ink">
              Most guests per room
            </legend>
            <p className="mt-0.5 text-xs leading-5 text-ink-3">
              Adults and children in one room, sharers included (check R013).
              Leave blank to skip.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
              {types.map((type) => {
                const inputId = `${id}-max-${type}`;
                const stored = block.maxOccupancy?.[type];
                const value =
                  occupancyText[type] ??
                  (stored === undefined ? "" : String(stored));
                return (
                  <div
                    key={type}
                    className="flex items-center gap-2 rounded-md border border-line bg-canvas/60 py-1 pr-1 pl-2.5"
                  >
                    <label
                      htmlFor={inputId}
                      className="min-w-0 flex-1 truncate font-mono text-xs text-ink"
                    >
                      {type}
                    </label>
                    <input
                      id={inputId}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={10}
                      placeholder="–"
                      value={value}
                      onChange={(event) => {
                        setOccupancyText({
                          ...occupancyText,
                          [type]: event.target.value,
                        });
                        onChange(
                          withMaxOccupancy(block, type, event.target.value),
                        );
                      }}
                      className="h-8 w-14 rounded-[5px] border border-field bg-surface px-2 text-right text-sm tabular-nums"
                    />
                  </div>
                );
              })}
            </div>
            {errors.maxOccupancy !== undefined && (
              <p className="mt-1.5 text-xs font-medium text-danger-ink">
                {errors.maxOccupancy}
              </p>
            )}
          </fieldset>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <input
            ref={fileInput}
            id={`${id}-file`}
            type="file"
            accept=".json,application/json"
            className="peer sr-only"
            onChange={(event) => loadFile(event.target.files?.[0])}
          />
          <label
            htmlFor={`${id}-file`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-sunken hover:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
          >
            <UploadIcon className="size-3.5" />
            Load block file
          </label>
          <button
            type="button"
            disabled={built === undefined}
            onClick={() => {
              if (built === undefined) return;
              const name = `${(block.blockCode.trim() || "block").replace(/[^\w.-]+/g, "-")}.json`;
              saveBlob(
                new Blob([`${JSON.stringify(built, null, 2)}\n`], {
                  type: "application/json",
                }),
                name,
              );
              setFileStatus(
                `Saved ${name}. Load it next time, or pass it to the CLI with --block.`,
              );
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-sunken hover:text-ink disabled:text-ink-3 disabled:hover:bg-transparent"
          >
            <DownloadIcon className="size-3.5" />
            Save block file
          </button>
          {block.maxOccupancy !== undefined && (
            <Badge tone="neutral" className="ml-auto">
              Occupancy set for{" "}
              {plural(Object.keys(block.maxOccupancy).length, "type")}
            </Badge>
          )}
        </div>
        <p role="status" aria-live="polite" className="mt-1 text-xs text-ink-2">
          {fileStatus}
        </p>
      </div>
    </details>
  );
}
