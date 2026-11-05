import { HEADER_ALIASES } from "@alihdrndm/roomlist-core/header-aliases";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, DownloadIcon, LockIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { Badge, SeverityBadge } from "@/components/ui/feedback";
import { Card, PageHeader, SectionTitle } from "@/components/ui/surface";
import { CANONICAL_FIELD_LABELS, CANONICAL_FIELDS } from "@/lib/fields";
import { ruleCatalogue } from "@/lib/rules";

export const metadata: Metadata = { title: "Guide" };

const REQUIRED = new Set([
  "lastName",
  "fullName",
  "arrivalDate",
  "departureDate",
]);

const GROUPS = [
  {
    prefix: "F",
    title: "Reading the file",
    text: "Checked first; a file that cannot be read stops here.",
  },
  {
    prefix: "R",
    title: "Errors in rows",
    text: "Each one blocks converting until it is fixed.",
  },
  {
    prefix: "W",
    title: "Warnings",
    text: "Worth a look; they never block the file.",
  },
  {
    prefix: "X",
    title: "Export requirements",
    text: "What a chosen format needs on top of a valid list.",
  },
] as const;

const STEPS = [
  {
    title: "Load the list",
    text: "Drop the client's CSV or Excel file. Headers such as “Surname”, “Check-In” or “Guest Name” are recognised; anything else can be mapped by hand under Columns.",
  },
  {
    title: "Add the block",
    text: "Optional, but it powers the checks hotels care about most: stays outside the block dates, room types the block does not hold, and too many people in a room.",
  },
  {
    title: "Fix and convert",
    text: "Fix what the report lists in the spreadsheet, validate again, then download the file for OPERA 5, OPERA Cloud or Maestro. When v2 arrives, Compare shows what changed.",
  },
];

export default function GuidePage() {
  const catalogue = ruleCatalogue();
  return (
    <div className="space-y-14">
      <PageHeader eyebrow="Guide" title="How roomlist-kit reads a list">
        <p>
          What a rooming list needs, which column names are understood, and what
          every check means. Share the template with whoever builds the list and
          most issues never happen.
        </p>
      </PageHeader>

      <section aria-labelledby="steps-heading" className="space-y-5">
        <SectionTitle id="steps-heading">Three steps</SectionTitle>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="rounded-lg border border-line bg-surface p-5 shadow-card"
            >
              <span className="font-display text-3xl font-medium text-accent">
                {index + 1}
              </span>
              <p className="mt-2 text-sm font-semibold text-ink">
                {step.title}
              </p>
              <p className="mt-1 text-[13px] leading-6 text-ink-2">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
        <Link href="/" className={buttonClass("primary")}>
          Validate a list
          <ArrowRightIcon />
        </Link>
      </section>

      <section
        id="columns"
        aria-labelledby="columns-heading"
        className="scroll-mt-6 space-y-5"
      >
        <SectionTitle
          id="columns-heading"
          description="Only a last name (or one full-name column), an arrival and a departure are required. Header names are matched ignoring case, spaces and punctuation, and a title row above the headers is skipped."
          actions={
            <a
              href="/samples/rooming-list-template.csv"
              download
              className={buttonClass("secondary", "sm")}
            >
              <DownloadIcon className="size-3.5" />
              Template (CSV)
            </a>
          }
        >
          Columns we read
        </SectionTitle>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Fields and the column names that map to them
            </caption>
            <thead>
              <tr className="border-b border-line bg-sunken/60 text-left text-[11px] tracking-wide text-ink-2 uppercase">
                <th scope="col" className="px-4 py-2 font-medium">
                  Field
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Column names recognised
                </th>
              </tr>
            </thead>
            <tbody>
              {CANONICAL_FIELDS.map((field) => (
                <tr
                  key={field}
                  className="border-b border-line align-top last:border-b-0"
                >
                  <th
                    scope="row"
                    className="w-1/3 px-4 py-2.5 text-left font-medium text-ink"
                  >
                    {CANONICAL_FIELD_LABELS[field]}
                    {REQUIRED.has(field) && (
                      <Badge tone="accent" className="ml-2">
                        {field === "fullName" || field === "lastName"
                          ? "Name required"
                          : "Required"}
                      </Badge>
                    )}
                  </th>
                  <td className="px-4 py-2.5">
                    <ul className="flex flex-wrap gap-1.5">
                      {[field.toLowerCase(), ...HEADER_ALIASES[field]]
                        .filter(
                          (alias, index, all) => all.indexOf(alias) === index,
                        )
                        .map((alias) => (
                          <li key={alias}>
                            <Badge mono>{alias}</Badge>
                          </li>
                        ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5 text-[13px] leading-6 text-ink-2">
            <p className="text-sm font-semibold text-ink">Dates</p>
            <p className="mt-1">
              2026-11-10 is always read correctly. For 03/04/2026, choose MM/DD
              (US) or DD/MM (Europe); one order applies to the whole file, and a
              warning says when every date could be read both ways.
            </p>
          </Card>
          <Card className="p-5 text-[13px] leading-6 text-ink-2">
            <p className="text-sm font-semibold text-ink">Sharers</p>
            <p className="mt-1">
              A guest who shares a room puts the line number of the guest
              holding the room in “Shares with”. Sharers add people, not rooms
              or room nights.
            </p>
          </Card>
          <Card className="p-5 text-[13px] leading-6 text-ink-2">
            <p className="text-sm font-semibold text-ink">Rows and lines</p>
            <p className="mt-1">
              “Row” is the spreadsheet row you see in Excel; “Line” is the
              guest&apos;s own number in the list. Compare never matches by
              line, because lists get renumbered.
            </p>
          </Card>
        </div>
      </section>

      <section
        id="checks"
        aria-labelledby="checks-heading"
        className="scroll-mt-6 space-y-6"
      >
        <SectionTitle
          id="checks-heading"
          description={`All ${catalogue.length} checks, with their stable codes. A check marked “block” only runs when the block details it needs are given.`}
        >
          Every check
        </SectionTitle>
        {GROUPS.map((group) => {
          const rules = catalogue.filter((rule) =>
            rule.id.startsWith(group.prefix),
          );
          return (
            <Card
              key={group.prefix}
              as="section"
              labelledBy={`checks-${group.prefix}`}
              className="overflow-hidden"
            >
              <div className="border-b border-line bg-sunken/50 px-5 py-3">
                <h3
                  id={`checks-${group.prefix}`}
                  className="text-sm font-semibold text-ink"
                >
                  {group.title}{" "}
                  <span className="font-normal text-ink-3">
                    · {rules.length}
                  </span>
                </h3>
                <p className="text-[13px] text-ink-2">{group.text}</p>
              </div>
              <ul className="divide-y divide-line">
                {rules.map((rule) => (
                  <li
                    key={rule.id}
                    id={rule.id}
                    className="grid gap-x-4 gap-y-1 px-5 py-3 text-sm md:grid-cols-[180px_minmax(0,1fr)_110px]"
                  >
                    <p className="font-mono text-xs text-ink-2 md:pt-0.5">
                      <span className="font-medium text-ink">{rule.id}</span>{" "}
                      {rule.code}
                    </p>
                    <div>
                      <p className="font-medium text-ink">
                        {rule.guide.title}
                        {rule.guide.needsBlock !== undefined && (
                          <Badge className="ml-2">block</Badge>
                        )}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-6 text-ink-2">
                        {rule.guide.help}
                      </p>
                    </div>
                    <span className="md:pt-0.5 md:text-right">
                      <SeverityBadge severity={rule.severity} />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </section>

      <section
        id="privacy"
        aria-labelledby="privacy-heading"
        className="scroll-mt-6"
      >
        <Card className="grid gap-6 p-6 md:grid-cols-[auto_minmax(0,1fr)] md:p-8">
          <span className="grid size-12 place-items-center rounded-full bg-sunken text-ink">
            <LockIcon className="size-6" />
          </span>
          <div className="space-y-3 text-sm leading-6 text-ink-2">
            <h2
              id="privacy-heading"
              className="font-display text-2xl font-medium text-ink"
            >
              Privacy and limits
            </h2>
            <p>
              Files are read in memory for one request and never written to
              disk, stored or logged; logs hold the request id, method, path and
              status only. There are no accounts and no database. Settings you
              enter, such as block details and column mappings, stay in this
              browser tab and are gone when you close it; save the block as a
              file if you want to reuse it.
            </p>
            <p>
              A file can be up to 5 MB and 5,000 guest rows. CSV files must be
              UTF-8; Excel files must be .xlsx. Use synthetic data when you
              report a problem, never a real rooming list.
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}
