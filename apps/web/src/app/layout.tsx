import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "roomlist-kit",
  description:
    "Validate hotel rooming lists and convert them to the import file each hotel system expects.",
};

const NAV = [
  { href: "/", label: "Validate & convert" },
  { href: "/compare", label: "Compare" },
  { href: "/formats", label: "Formats" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:outline focus:outline-2 focus:outline-blue-800"
        >
          Skip to content
        </a>
        <header className="border-b border-zinc-300 bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="text-lg font-semibold text-zinc-900">
              roomlist-kit
            </Link>
            <nav aria-label="Main">
              <ul className="flex flex-wrap gap-4">
                {NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-blue-800 underline-offset-4 hover:underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <a
              href="https://github.com/alihdrndm/roomlist-kit"
              className="ml-auto text-blue-800 underline-offset-4 hover:underline"
            >
              GitHub
            </a>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
