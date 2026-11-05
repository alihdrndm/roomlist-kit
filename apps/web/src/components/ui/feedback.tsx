import type { ReactNode } from "react";
import {
  CheckCircleIcon,
  ErrorIcon,
  InfoIcon,
  WarningIcon,
} from "@/components/icons";
import { cx } from "@/lib/cx";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const BADGE_TONES: Record<Tone, string> = {
  neutral: "border-line bg-sunken text-ink-2",
  accent: "border-accent-line bg-accent-soft text-accent-strong",
  success: "border-success-line bg-success-soft text-success-ink",
  warning: "border-warning-line bg-warning-soft text-warning-ink",
  danger: "border-danger-line bg-danger-soft text-danger-ink",
};

/** A small label. `mono` for codes and values (R004, KING, 2026-11-10). */
export function Badge({
  children,
  tone = "neutral",
  mono = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1 rounded-sm border px-1.5 py-px text-xs leading-5",
        mono ? "font-mono text-[11.5px]" : "font-medium",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Severity as an icon AND a word: colour is never the only signal. */
export function SeverityBadge({ severity }: { severity: string }) {
  return severity === "error" ? (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-danger-ink">
      <ErrorIcon /> Error
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-warning-ink">
      <WarningIcon /> Warning
    </span>
  );
}

const CALLOUT_TONES: Record<
  Exclude<Tone, "neutral">,
  { box: string; icon: ReactNode }
> = {
  accent: {
    box: "border-accent-line bg-accent-soft text-ink",
    icon: <InfoIcon className="size-5 text-accent" />,
  },
  success: {
    box: "border-success-line bg-success-soft text-ink",
    icon: <CheckCircleIcon className="size-5 text-success" />,
  },
  warning: {
    box: "border-warning-line bg-warning-soft text-ink",
    icon: <WarningIcon className="size-5 text-warning" />,
  },
  danger: {
    box: "border-danger-line bg-danger-soft text-ink",
    icon: <ErrorIcon className="size-5 text-danger" />,
  },
};

/** A boxed message with an icon. Pass role="alert" only for errors that just happened. */
export function Callout({
  tone = "accent",
  title,
  children,
  actions,
  role,
  className,
}: {
  tone?: Exclude<Tone, "neutral">;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  role?: "alert" | "status";
  className?: string;
}) {
  const style = CALLOUT_TONES[tone];
  return (
    <div
      role={role}
      className={cx(
        "flex gap-3 rounded-lg border px-4 py-3 text-sm leading-6",
        style.box,
        className,
      )}
    >
      <span className="mt-0.5">{style.icon}</span>
      <div className="min-w-0 flex-1">
        {title !== undefined && <p className="font-semibold">{title}</p>}
        {children !== undefined && (
          <div className={cx("text-ink-2", title !== undefined && "mt-0.5")}>
            {children}
          </div>
        )}
        {actions !== undefined && (
          <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}

/** A polite live region: screen readers hear progress and outcomes without focus moving. */
export function Status({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cx("text-[13px] leading-5 text-ink-2", className)}
    >
      {children}
    </p>
  );
}

export function EmptyState({
  title,
  children,
  icon,
  actions,
  className,
}: {
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center",
        className,
      )}
    >
      {icon !== undefined && (
        <span className="mb-3 grid size-10 place-items-center rounded-full bg-sunken text-ink-2">
          {icon}
        </span>
      )}
      {title !== undefined && <p className="font-medium text-ink">{title}</p>}
      {children !== undefined && (
        <div className="mt-1 max-w-md text-sm leading-6 text-ink-2">
          {children}
        </div>
      )}
      {actions !== undefined && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

/** An indeterminate bar for requests whose length is unknown. */
export function ProgressBar({ label }: { label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      className="relative h-1 w-full overflow-hidden rounded-full bg-accent-soft"
    >
      <span className="absolute inset-y-0 left-0 w-2/5 animate-progress rounded-full bg-accent motion-reduce:animate-none" />
    </div>
  );
}

/** Placeholder blocks while a result loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "block animate-pulse rounded-md bg-sunken motion-reduce:animate-none",
        className,
      )}
    />
  );
}
