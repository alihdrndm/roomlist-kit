import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

// Form building blocks: a label, an optional hint and an optional error, wired to
// the control with htmlFor / aria-describedby so screen readers read all three.

export const inputClass =
  "block h-10 w-full rounded-md border border-field bg-surface px-3 text-sm text-ink placeholder:text-ink-3 transition-colors duration-150 hover:border-ink-3 aria-invalid:border-danger aria-invalid:bg-danger-soft disabled:border-line disabled:bg-sunken disabled:text-ink-3";

export const selectClass = cx(
  inputClass,
  "appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9",
  // A chevron drawn as an inline SVG data URI, in ink-2.
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%2345464e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 8l4 4 4-4'/%3E%3C/svg%3E\")]",
);

export function hintId(id: string): string {
  return `${id}-hint`;
}
export function errorId(id: string): string {
  return `${id}-error`;
}

/** The ids a control's aria-describedby should name, or undefined when there are none. */
export function describedBy(
  id: string,
  hint: ReactNode | undefined,
  error: ReactNode | undefined,
): string | undefined {
  const ids = [
    hint === undefined ? undefined : hintId(id),
    error === undefined ? undefined : errorId(id),
  ].filter(Boolean);
  return ids.length === 0 ? undefined : ids.join(" ");
}

export function Field({
  id,
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("min-w-0", className)}>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink"
      >
        {label}
        {optional && (
          <span className="text-xs font-normal text-ink-3">Optional</span>
        )}
      </label>
      {children}
      {hint !== undefined && (
        <p id={hintId(id)} className="mt-1.5 text-xs leading-5 text-ink-3">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p
          id={errorId(id)}
          className="mt-1.5 text-xs leading-5 font-medium text-danger-ink"
        >
          {error}
        </p>
      )}
    </div>
  );
}
