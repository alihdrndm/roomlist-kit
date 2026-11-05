import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 ease-out disabled:cursor-not-allowed";

const VARIANTS: Record<ButtonVariant, string> = {
  // Ink, like a stamp: the one main action on a screen.
  primary:
    "bg-ink text-white shadow-card hover:bg-ink-2 disabled:bg-line-strong disabled:text-ink-2 disabled:shadow-none",
  accent:
    "bg-accent text-white shadow-card hover:bg-accent-strong disabled:bg-line-strong disabled:text-ink-2",
  secondary:
    "border border-field bg-surface text-ink hover:bg-sunken disabled:border-line disabled:bg-sunken disabled:text-ink-3 aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-strong",
  ghost:
    "text-ink-2 hover:bg-sunken hover:text-ink disabled:text-ink-3 aria-pressed:bg-accent-soft aria-pressed:text-accent-strong",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[15px]",
};

/** The class string of a button, for links that look like one. */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
): string {
  return cx(BASE, VARIANTS[variant], SIZES[size], extra);
}

type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "type"
> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: "button" | "submit";
  pressed?: boolean;
  /** Shows a spinner and keeps the button's width; the caller also disables it. */
  pending?: boolean;
  className?: string;
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  type = "button",
  pressed,
  pending = false,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      aria-busy={pending || undefined}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      className={cx(
        "shrink-0 animate-spin motion-reduce:animate-none",
        className,
      )}
    >
      <circle
        cx="10"
        cy="10"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M17 10a7 7 0 0 0-7-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
