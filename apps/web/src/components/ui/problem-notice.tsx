import type { ReactNode } from "react";
import { ErrorIcon } from "@/components/icons";
import { fieldLabel } from "@/lib/fields";
import type { Problem } from "@/lib/problem";

const SIDE_LABEL = { before: "Earlier list", after: "Later list" } as const;
const SHOWN_ISSUES = 10;

/**
 * An API problem shown to the user: its title and detail, field errors when there
 * are any, the first error issues of a LIST_INVALID problem, and the request id so
 * a persistent failure can be reported. `children` holds recovery actions.
 */
export function ProblemNotice({
  problem,
  children,
}: {
  problem: Problem;
  children?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-lg border border-danger-line bg-danger-soft px-4 py-3.5 text-sm leading-6 text-ink"
    >
      <ErrorIcon className="mt-0.5 size-5 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-danger-ink">{problem.title}</p>
        <p className="mt-0.5 text-ink-2">{problem.detail}</p>
        {problem.errors !== undefined && problem.errors.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-ink-2">
            {problem.errors.map((error) => (
              <li key={`${error.path}-${error.code}`}>
                <code className="font-mono text-[12.5px] text-ink">
                  {fieldPathLabel(error.path)}
                </code>
                : {error.message}
              </li>
            ))}
          </ul>
        )}
        <IssueList issues={problem.issues ?? []} />
        {children !== undefined && (
          <div className="mt-3 flex flex-wrap gap-2">{children}</div>
        )}
        {problem.instance !== undefined && (
          <p className="mt-2 font-mono text-[11.5px] text-ink-3">
            Request id {problem.instance}
          </p>
        )}
      </div>
    </div>
  );
}

/** "block.startDate" → "Block · Start date"; "(request)" when the path is empty. */
function fieldPathLabel(path: string): string {
  if (path === "") return "(request)";
  const [head, ...rest] = path.split(".");
  if (head === "block" && rest.length > 0)
    return `Block · ${fieldLabel(rest.join("."))}`;
  return path;
}

/** The first error issues of a LIST_INVALID problem, each saying which list (for compare) and row it is in. */
function IssueList({ issues }: { issues: NonNullable<Problem["issues"]> }) {
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length === 0) return null;
  const hidden = errors.length - SHOWN_ISSUES;
  return (
    <>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-ink-2">
        {errors.slice(0, SHOWN_ISSUES).map((issue, index) => {
          const where = [
            issue.side === undefined ? undefined : SIDE_LABEL[issue.side],
            issue.row === undefined ? undefined : `row ${issue.row}`,
          ]
            .filter(Boolean)
            .join(", ");
          return (
            // Bare <li>: the unit test counts them.
            <li
              key={`${issue.side ?? ""}-${issue.ruleId}-${issue.row ?? ""}-${index}`}
            >
              {where !== "" && <strong className="text-ink">{where}: </strong>}
              {issue.message}
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <p className="mt-1 text-ink-2">
          …and {hidden} more error{hidden === 1 ? "" : "s"}.
        </p>
      )}
    </>
  );
}
