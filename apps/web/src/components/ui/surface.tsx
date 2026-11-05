import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** A white card on the paper canvas. `as="section"` with a heading id makes it a landmark. */
export function Card({
  children,
  className,
  as: Tag = "div",
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "aside";
  labelledBy?: string;
}) {
  return (
    <Tag
      aria-labelledby={labelledBy}
      className={cx(
        "rounded-lg border border-line bg-surface shadow-card",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Page title block: an eyebrow, the title in the display face, and one lede sentence. */
export function PageHeader({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="max-w-2xl">
        <p className="font-mono text-[11px] font-medium tracking-[0.12em] text-ink-3 uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-[32px] leading-[1.08] font-medium tracking-[-0.01em] text-ink sm:text-[40px]">
          {title}
        </h1>
        {children !== undefined && (
          <div className="mt-3 text-[15px] leading-6 text-ink-2">
            {children}
          </div>
        )}
      </div>
      {actions !== undefined && (
        <div className="flex flex-wrap gap-2">{actions}</div>
      )}
    </div>
  );
}

/** A section title inside a page: display face, with optional supporting text and actions. */
export function SectionTitle({
  id,
  children,
  description,
  actions,
  level = 2,
}: {
  id?: string;
  children: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <Heading
          id={id}
          className={cx(
            "font-display font-medium tracking-[-0.005em] text-ink",
            level === 2 ? "text-2xl leading-8" : "text-xl leading-7",
          )}
        >
          {children}
        </Heading>
        {description !== undefined && (
          <p className="mt-1 text-sm leading-6 text-ink-2">{description}</p>
        )}
      </div>
      {actions !== undefined && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** Small uppercase label used above groups of controls. */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cx(
        "font-mono text-[11px] font-medium tracking-[0.12em] text-ink-3 uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}
