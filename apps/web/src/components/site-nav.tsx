"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

const NAV = [
  { href: "/", label: "Validate & convert", short: "Validate" },
  { href: "/compare", label: "Compare", short: "Compare" },
  { href: "/formats", label: "Formats", short: "Formats" },
  { href: "/guide", label: "Guide", short: "Guide" },
] as const;

/** The main navigation; the current page is marked with aria-current and an underline. */
export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="min-w-0">
      <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {NAV.map((item) => {
          const current =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "relative inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150",
                  current
                    ? "bg-sunken text-ink"
                    : "text-ink-2 hover:bg-sunken/70 hover:text-ink",
                )}
              >
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{item.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
