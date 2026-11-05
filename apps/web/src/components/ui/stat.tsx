import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type StatTone = "neutral" | "danger" | "warning" | "success";

const TONES: Record<StatTone, string> = {
  neutral: "text-ink",
  danger: "text-danger-ink",
  warning: "text-warning-ink",
  success: "text-success-ink",
};

/**
 * One number with its label. The group is named by the label so it can be found and
 * read aloud ("Room nights, 9"); the value is the only <p> inside it.
 */
export function Stat({
  id,
  label,
  value,
  detail,
  tone = "neutral",
  className,
}: {
  /** Unique on the page; the label's id is derived from it. */
  id: string;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: StatTone;
  className?: string;
}) {
  const labelId = `stat-${id}`;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a stat is a labelled figure, not a form group; a fieldset would be announced as form controls.
    <section
      role="group"
      aria-labelledby={labelId}
      className={cx("min-w-0", className)}
    >
      <h3
        id={labelId}
        className="text-[12px] leading-4 font-medium tracking-wide text-ink-2"
      >
        {label}
      </h3>
      <p
        className={cx(
          "mt-1.5 font-display text-[30px] leading-none font-medium tabular-nums",
          TONES[tone],
        )}
      >
        {value}
      </p>
      {detail !== undefined && (
        <div className="mt-1.5 truncate text-xs text-ink-3">{detail}</div>
      )}
    </section>
  );
}

/** A row of stats separated by hairlines; wraps on narrow screens. */
export function StatGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:flex lg:flex-wrap lg:gap-x-0 lg:gap-y-5 lg:[&>*]:min-w-28 lg:[&>*]:flex-1 lg:[&>*]:border-l lg:[&>*]:border-line lg:[&>*]:px-5 lg:[&>*:first-child]:border-l-0 lg:[&>*:first-child]:pl-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
