"use client";

import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";
import { ChevronIcon } from "@/components/icons";
import { cx } from "@/lib/cx";
import { Button } from "./button";

export type TabItem<T extends string> = {
  id: T;
  label: string;
  count?: number;
  icon?: ReactNode;
};

/**
 * Tabs with the ARIA tabs pattern: one tab stop, arrow keys (and Home/End) move
 * between tabs and select them. Panels are rendered by the caller with
 * `tabPanelProps`.
 */
export function Tabs<T extends string>({
  label,
  items,
  value,
  onChange,
  idBase,
}: {
  label: string;
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  idBase: string;
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const move = (event: KeyboardEvent, index: number) => {
    const last = items.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    const item = items[next];
    if (item === undefined) return;
    onChange(item.id);
    refs.current.get(item.id)?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className="-mb-px flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]"
    >
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(node) => {
              if (node) refs.current.set(item.id, node);
              else refs.current.delete(item.id);
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => move(event, index)}
            className={cx(
              "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 pt-2 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-150",
              selected
                ? "border-ink text-ink"
                : "border-transparent text-ink-2 hover:border-line-strong hover:text-ink",
            )}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && (
              <span
                className={cx(
                  "rounded-sm px-1.5 font-mono text-[11px] leading-5",
                  selected ? "bg-ink text-white" : "bg-sunken text-ink-2",
                )}
              >
                {item.count.toLocaleString("en-US")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function tabPanelProps(idBase: string, id: string) {
  return {
    role: "tabpanel" as const,
    id: `${idBase}-panel-${id}`,
    "aria-labelledby": `${idBase}-tab-${id}`,
    tabIndex: 0,
  };
}

/**
 * A choice between a few options, drawn as joined segments but built from native
 * radio buttons, so arrow keys and screen readers work without extra code.
 */
export function Segmented<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  hideLegend = false,
  size = "md",
}: {
  legend: string;
  name: string;
  options: readonly { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
  hideLegend?: boolean;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <fieldset className="min-w-0">
      <legend
        className={cx(
          "mb-1.5 text-[13px] font-medium text-ink",
          hideLegend && "sr-only",
        )}
      >
        {legend}
      </legend>
      <div className="inline-flex max-w-full rounded-md border border-field bg-sunken p-0.5">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              htmlFor={`${id}-${option.value}`}
              className={cx(
                "relative inline-flex items-center gap-1.5 rounded-[5px] font-medium whitespace-nowrap transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent",
                size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
                checked
                  ? "bg-surface text-ink shadow-card"
                  : "text-ink-2 hover:text-ink",
              )}
            >
              <input
                id={`${id}-${option.value}`}
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
              {option.hint !== undefined && (
                <span className="font-normal text-ink-3">{option.hint}</span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** "1–50 of 312" with previous/next buttons; renders nothing when everything fits on one page. */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  noun,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  noun: string;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const first = page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);
  return (
    <nav
      aria-label={`${noun} pages`}
      className="flex items-center justify-between gap-3 pt-3 text-[13px] text-ink-2"
    >
      <p>
        <span className="font-medium text-ink tabular-nums">
          {first.toLocaleString("en-US")}–{last.toLocaleString("en-US")}
        </span>{" "}
        of {total.toLocaleString("en-US")} {noun}
      </p>
      <div className="flex gap-1">
        <Button
          variant="secondary"
          size="sm"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronIcon className="size-4 rotate-180" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages - 1}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronIcon className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
