import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { HandoffProvider } from "@/components/handoff";
import { BrandMark, GitHubIcon, LockIcon } from "@/components/icons";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "roomlist-kit: validate and convert hotel rooming lists",
    template: "%s · roomlist-kit",
  },
  description:
    "Check a hotel rooming list against the room block, count the room nights, and download the import file OPERA 5, OPERA Cloud or Maestro expects. Nothing you upload is stored.",
};

export const viewport: Viewport = { themeColor: "#f7f5f0" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* The two faces every page uses first; the rest load on demand. */}
        <link
          rel="preload"
          href="/fonts/plex-sans-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/newsreader-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-50 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-raised"
        >
          Skip to content
        </a>
        <header
          data-site
          className="border-b border-line bg-canvas/95 print:hidden"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-md text-ink"
              aria-label="roomlist-kit, home"
            >
              <BrandMark />
              <span className="font-display text-[19px] leading-none font-semibold tracking-[-0.01em]">
                roomlist
                <span className="font-mono text-[13px] font-medium text-ink-3">
                  -kit
                </span>
              </span>
            </Link>
            <div className="order-last w-full sm:order-none sm:w-auto">
              <SiteNav />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Link
                href="/guide#privacy"
                className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-ink-2 hover:bg-sunken hover:text-ink md:inline-flex"
              >
                <LockIcon className="size-3.5" />
                Nothing you upload is stored
              </Link>
              <a
                href="https://github.com/alihdrndm/roomlist-kit"
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-ink-2 hover:bg-sunken hover:text-ink"
              >
                <GitHubIcon />
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </header>
        <main
          id="main"
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
        >
          <HandoffProvider>{children}</HandoffProvider>
        </main>
        <footer data-site className="border-t border-line print:hidden">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-[13px] leading-6 text-ink-2 sm:px-6 md:grid-cols-[1.4fr_1fr] lg:px-8">
            <div className="flex gap-3">
              <LockIcon className="mt-1 size-4 text-ink-3" />
              <p className="max-w-xl">
                Files are read in memory for one request and never stored or
                logged. Up to 5 MB and 5,000 guest rows per file. Formats follow
                public vendor documentation; check the{" "}
                <Link
                  href="/formats"
                  className="text-accent underline underline-offset-2"
                >
                  assumptions
                </Link>{" "}
                against your hotel&apos;s template before a real import.
              </p>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 md:justify-end">
              <li>
                <Link href="/guide" className="hover:text-ink">
                  Guide
                </Link>
              </li>
              <li>
                <Link href="/formats" className="hover:text-ink">
                  Formats
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/alihdrndm/roomlist-kit"
                  className="hover:text-ink"
                >
                  Source code
                </a>
              </li>
              <li>MIT licence</li>
            </ul>
          </div>
        </footer>
      </body>
    </html>
  );
}
