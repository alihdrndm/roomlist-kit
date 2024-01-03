"use client";

import { useId, useState } from "react";
import { formatBytes, MAX_FILE_BYTES } from "@/lib/forms";

/**
 * A file picker that also accepts a dropped file. The native input is the keyboard
 * and screen-reader path; the drop zone is a convenience for mouse users. Files over
 * 5 MB are refused here already, with a message, so nobody waits for an upload the
 * API would reject.
 */
export function FileField({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | undefined;
  onChange: (file: File | undefined) => void;
}) {
  const id = useId();
  const [error, setError] = useState<string | undefined>();
  const [dragging, setDragging] = useState(false);

  const accept = (candidate: File | undefined) => {
    if (candidate !== undefined && candidate.size > MAX_FILE_BYTES) {
      setError(
        `${candidate.name} is ${formatBytes(candidate.size)}; the limit is 5 MB. Split the list into smaller files.`,
      );
      onChange(undefined);
      return;
    }
    setError(undefined);
    onChange(candidate);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the drop zone is a mouse convenience; the labelled file input inside it is the keyboard and screen-reader path.
    <div
      className={`rounded-lg border-2 border-dashed p-4 transition-colors duration-150 ${dragging ? "border-blue-700 bg-blue-50" : "border-zinc-400 bg-white"}`}
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
      <label htmlFor={id} className="block font-medium text-zinc-900">
        {label}
      </label>
      <p className="text-sm text-zinc-700">
        CSV or Excel (.xlsx), up to 5 MB. Drop a file here or choose one.
      </p>
      <input
        id={id}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="mt-2 block w-full text-sm text-zinc-900 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-200 file:px-3 file:py-2 file:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800"
        onChange={(event) => accept(event.target.files?.[0])}
      />
      {file !== undefined && (
        <p className="mt-2 text-sm text-zinc-900">
          Chosen: <strong>{file.name}</strong> ({formatBytes(file.size)})
        </p>
      )}
      {error !== undefined && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
