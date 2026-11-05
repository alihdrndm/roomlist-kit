"use client";

import { type ReactNode, useId, useRef, useState } from "react";
import { CloseIcon, FileIcon, UploadIcon } from "@/components/icons";
import { cx } from "@/lib/cx";
import { formatBytes, MAX_FILE_BYTES } from "@/lib/forms";

const ACCEPT =
  ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** "CSV" or "XLSX" from the file name, for the file badge. */
export function fileKind(name: string): string {
  const extension = name.split(".").pop()?.toUpperCase() ?? "";
  return extension === "" || extension.length > 5 ? "FILE" : extension;
}

/**
 * A file picker that also accepts a dropped file. The native input (visually hidden,
 * still focusable) is the keyboard and screen-reader path; its label is drawn as the
 * button, and the whole zone takes drops. Files over 5 MB are refused here already,
 * so nobody waits for an upload the API would reject.
 */
export function FileDrop({
  label,
  file,
  onChange,
  compact = false,
  footer,
}: {
  label: string;
  file: File | undefined;
  onChange: (file: File | undefined) => void;
  compact?: boolean;
  footer?: ReactNode;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | undefined>();
  const [dragging, setDragging] = useState(false);

  const accept = (candidate: File | undefined) => {
    // Clear the native value so choosing the same file again still fires a change.
    if (input.current) input.current.value = "";
    if (candidate === undefined) return;
    if (candidate.size > MAX_FILE_BYTES) {
      setError(
        `${candidate.name} is ${formatBytes(candidate.size)}; the limit is 5 MB. Split the list into smaller files.`,
      );
      return;
    }
    setError(undefined);
    onChange(candidate);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the drop zone is a mouse convenience; the labelled file input inside it is the keyboard and screen-reader path.
    <div
      className={cx(
        "relative rounded-lg border border-dashed transition-colors duration-150",
        dragging
          ? "border-accent bg-accent-soft"
          : file === undefined
            ? "border-field bg-surface hover:border-ink-3"
            : "border-line bg-surface",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        accept(event.dataTransfer.files[0]);
      }}
    >
      <input
        ref={input}
        id={id}
        type="file"
        accept={ACCEPT}
        aria-describedby={`${id}-hint${error === undefined ? "" : ` ${id}-error`}`}
        className="peer sr-only"
        onChange={(event) => accept(event.target.files?.[0])}
      />
      {file === undefined ? (
        <div
          className={cx(
            "flex flex-col items-center text-center",
            compact ? "px-4 py-6" : "px-5 py-8",
          )}
        >
          <span className="grid size-10 place-items-center rounded-full bg-sunken text-ink-2">
            <UploadIcon className="size-5" />
          </span>
          <p className="mt-3 text-sm font-medium text-ink">{label}</p>
          <p id={`${id}-hint`} className="mt-1 text-xs leading-5 text-ink-3">
            Drop a CSV or Excel (.xlsx) file here, up to 5 MB
          </p>
          <label
            htmlFor={id}
            className="mt-3 inline-flex h-8 items-center rounded-md border border-field bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:bg-sunken peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
          >
            Choose a file
          </label>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-3.5 py-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-sunken text-ink-2">
            <FileIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-3">{label}</p>
            <p
              className="truncate text-sm font-medium text-ink"
              title={file.name}
            >
              <span className="sr-only">Chosen: </span>
              {file.name}
            </p>
            <p id={`${id}-hint`} className="font-mono text-[11px] text-ink-3">
              {fileKind(file.name)} · {formatBytes(file.size)}
            </p>
          </div>
          <label
            htmlFor={id}
            className="inline-flex h-8 shrink-0 items-center rounded-md px-2.5 text-[13px] font-medium text-accent transition-colors hover:bg-accent-soft peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
          >
            Replace
          </label>
          <button
            type="button"
            onClick={() => {
              setError(undefined);
              onChange(undefined);
            }}
            className="grid size-8 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
            aria-label={`Remove ${file.name}`}
          >
            <CloseIcon />
          </button>
        </div>
      )}
      {error !== undefined && (
        <p
          id={`${id}-error`}
          role="alert"
          className="border-t border-danger-line bg-danger-soft px-3.5 py-2 text-[13px] font-medium text-danger-ink"
        >
          {error}
        </p>
      )}
      {footer}
    </div>
  );
}
