import type { ReactNode } from "react";
import type { Problem } from "@/lib/problem";

// Small presentational pieces shared by the pages. No component library: plain
// elements and Tailwind classes, colours chosen for WCAG AA contrast on white.

/** One number with its label; the group is named by the label so it can be found and read aloud. */
export function Tile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "error" | "warning";
}) {
  const id = `tile-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const toneClass =
    tone === "error"
      ? "border-red-700"
      : tone === "warning"
        ? "border-amber-700"
        : "border-zinc-300";
  return (
    // biome-ignore lint/a11y/useSemanticElements: a tile is a labelled figure, not a form group; a fieldset would be announced as form controls.
    <section
      role="group"
      aria-labelledby={id}
      className={`rounded-lg border-2 ${toneClass} bg-white p-4`}
    >
      <h3 id={id} className="text-sm font-medium text-zinc-700">
        {label}
      </h3>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
    </section>
  );
}

export function Tiles({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {children}
    </div>
  );
}

/** Severity as an icon AND a word: colour is never the only signal. */
export function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "error") {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-red-800">
        <span aria-hidden="true">✖</span> error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-medium text-amber-800">
      <span aria-hidden="true">▲</span> warning
    </span>
  );
}

/** An API problem shown to the user: its title and detail, plus field errors when there are any. */
export function ProblemNotice({ problem }: { problem: Problem }) {
  return (
    <div
      role="alert"
      className="rounded-lg border-2 border-red-700 bg-red-50 p-4 text-red-900"
    >
      <p className="font-semibold">{problem.title}</p>
      <p className="mt-1">{problem.detail}</p>
      {problem.errors !== undefined && problem.errors.length > 0 && (
        <ul className="mt-2 list-disc pl-5">
          {problem.errors.map((error) => (
            <li key={`${error.path}-${error.code}`}>
              <code>{error.path || "(request)"}</code>: {error.message}
            </li>
          ))}
        </ul>
      )}
      <IssueList issues={problem.issues ?? []} />
    </div>
  );
}

const SIDE_LABEL = { before: "Earlier list", after: "Later list" } as const;
const SHOWN_ISSUES = 10;

/** The first error issues of a LIST_INVALID problem, each saying which list (for compare) and row it is in. */
function IssueList({ issues }: { issues: NonNullable<Problem["issues"]> }) {
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length === 0) return null;
  const hidden = errors.length - SHOWN_ISSUES;
  return (
    <>
      <ul className="mt-2 list-disc pl-5">
        {errors.slice(0, SHOWN_ISSUES).map((issue, index) => {
          const where = [
            issue.side === undefined ? undefined : SIDE_LABEL[issue.side],
            issue.row === undefined ? undefined : `row ${issue.row}`,
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <li
              key={`${issue.side ?? ""}-${issue.ruleId}-${issue.row ?? ""}-${index}`}
            >
              {where !== "" && <strong>{where}: </strong>}
              {issue.message}
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <p className="mt-1">
          …and {hidden} more error{hidden === 1 ? "" : "s"}.
        </p>
      )}
    </>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  type = "button",
  variant = "primary",
  pressed,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: "primary" | "secondary";
  pressed?: boolean;
}) {
  const base =
    "rounded-md px-4 py-2 font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800 disabled:cursor-not-allowed disabled:opacity-50";
  const look =
    variant === "primary"
      ? "bg-blue-700 text-white hover:bg-blue-800"
      : "border border-zinc-400 bg-white text-zinc-900 hover:bg-zinc-100 aria-pressed:bg-zinc-900 aria-pressed:text-white";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={`${base} ${look}`}
    >
      {children}
    </button>
  );
}

/** A polite live region: screen readers hear progress ("Validating…") and the outcome ("Validated: …") without focus moving. */
export function Status({ children }: { children: ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="text-sm text-zinc-700">
      {children}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-zinc-400 p-4 text-zinc-700">
      {children}
    </p>
  );
}
