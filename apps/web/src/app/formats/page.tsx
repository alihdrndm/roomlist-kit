import type { Metadata } from "next";
import { CheckIcon, ExternalIcon, WarningIcon } from "@/components/icons";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { ProblemNotice } from "@/components/ui/problem-notice";
import { Card, PageHeader } from "@/components/ui/surface";
import { labelFor } from "@/lib/fields";
import { optionFields } from "@/lib/forms";
import { readProblem } from "@/lib/problem";
import { getFromApi } from "@/lib/proxy";
import type { TargetInfo, TargetsResponse } from "@/lib/types";

export const metadata: Metadata = { title: "Export formats" };
export const dynamic = "force-dynamic";

/** Who imports each target; the ids come from the API, the words are ours. */
const SYSTEM: Record<string, string> = {
  "opera5-xml": "Oracle OPERA 5 (on-premises)",
  "opera-cloud-xlsx": "Oracle OPERA Cloud",
  "maestro-csv": "Maestro PMS",
  "canonical-json": "Your own scripts and tools",
  "canonical-csv": "Spreadsheets and other tools",
};

export default async function FormatsPage() {
  const response = await getFromApi("/v1/formats");
  if (!response.ok) {
    const problem = await readProblem(response);
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Reference" title="Export formats" />
        <ProblemNotice problem={problem} />
      </div>
    );
  }
  const { targets } = (await response.json()) as TargetsResponse;

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Reference" title="Export formats">
        <p>
          What each import file contains, and which details were checked against
          the vendor&apos;s public documentation and which are assumed. Nothing
          here was tested on a live hotel system, so check the assumed details
          against your property&apos;s template before a real import.
        </p>
      </PageHeader>
      {targets.length === 0 ? (
        <EmptyState title="The API lists no export formats." />
      ) : (
        <>
          <nav aria-label="Formats on this page">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {targets.map((target) => {
                const assumed = target.provenance.filter(
                  (item) => item.status === "assumed",
                ).length;
                return (
                  <li key={target.id}>
                    <a
                      href={`#${target.id}`}
                      className="flex h-full flex-col rounded-lg border border-line bg-surface p-4 shadow-card transition-colors hover:border-ink-3"
                    >
                      <span className="text-xs text-ink-3">
                        {SYSTEM[target.id] ?? "Import file"}
                      </span>
                      <span className="mt-1 text-sm font-semibold text-ink">
                        {target.label}
                      </span>
                      <span className="mt-3 flex flex-wrap gap-1.5">
                        <Badge mono>.{target.fileExtension}</Badge>
                        {target.provenance.length === 0 ? (
                          <Badge>Own format</Badge>
                        ) : assumed > 0 ? (
                          <Badge tone="warning">{assumed} assumed</Badge>
                        ) : (
                          <Badge tone="success">Verified</Badge>
                        )}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="space-y-6">
            {targets.map((target) => (
              <TargetSection key={target.id} target={target} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** "A1: XML envelope (…)" → ["A1", "XML envelope (…)"]. */
function splitId(aspect: string): [string | undefined, string] {
  const match = /^(A\d+): (.*)$/.exec(aspect);
  return match ? [match[1], match[2] ?? aspect] : [undefined, aspect];
}

function TargetSection({ target }: { target: TargetInfo }) {
  const headingId = `format-${target.id}`;
  const fields = optionFields(target.optionsSchema);
  const verified = target.provenance.filter(
    (item) => item.status === "verified",
  );
  const assumed = target.provenance.filter((item) => item.status === "assumed");
  return (
    <Card
      as="section"
      labelledBy={headingId}
      className="scroll-mt-6 overflow-hidden"
    >
      <div
        id={target.id}
        className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-5 sm:px-6"
      >
        <div>
          <p className="text-xs text-ink-3">
            {SYSTEM[target.id] ?? "Import file"}
          </p>
          <h2
            id={headingId}
            className="mt-1 font-display text-2xl font-medium text-ink"
          >
            {target.label}
          </h2>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
          <Badge mono>.{target.fileExtension}</Badge>
          <span className="font-mono text-[11.5px] text-ink-3">
            {target.contentType}
          </span>
        </p>
      </div>
      <div className="grid gap-8 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <h3 className="text-[13px] font-semibold text-ink">Options</h3>
          {fields.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">No options.</p>
          ) : (
            <dl className="mt-2 divide-y divide-line rounded-md border border-line">
              {fields.map((field) => (
                <div key={field.name} className="px-3 py-2.5 text-[13px]">
                  <dt className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium text-ink">
                      {labelFor(field.name)}
                    </span>
                    <code className="font-mono text-[11.5px] text-ink-3">
                      {field.name}
                    </code>
                  </dt>
                  <dd className="mt-0.5 text-ink-2">
                    {field.kind === "select"
                      ? `One of ${field.choices.join(", ")}`
                      : field.kind === "checkbox"
                        ? "On or off"
                        : "Text"}
                    {" · default "}
                    {field.defaultValue === "" ? (
                      "none"
                    ) : (
                      <code className="font-mono text-[12px] text-ink">
                        {String(field.defaultValue)}
                      </code>
                    )}
                    {field.required ? " · required" : ""}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="space-y-6">
          {target.provenance.length === 0 ? (
            <div>
              <h3 className="text-[13px] font-semibold text-ink">
                What is verified
              </h3>
              <p className="mt-2 text-sm text-ink-2">
                Our own format; nothing to verify against.
              </p>
            </div>
          ) : (
            <>
              <ProvenanceList
                title="Verified from vendor documentation"
                items={verified}
                tone="verified"
              />
              <ProvenanceList
                title="Assumed, not verified"
                items={assumed}
                tone="assumed"
              />
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

/** One list of provenance items; each source shows as its site name, linking to the full address. */
function ProvenanceList({
  title,
  items,
  tone,
}: {
  title: string;
  items: TargetInfo["provenance"];
  tone: "verified" | "assumed";
}) {
  return (
    <div>
      <h3 className="text-[13px] font-semibold text-ink">
        {title} <span className="font-normal text-ink-3">· {items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">None.</p>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {items.map((item) => {
            const [id, aspect] = splitId(item.aspect);
            return (
              <li
                key={`${item.aspect}-${item.source}`}
                className="flex gap-2.5 text-[13px] leading-5"
              >
                {tone === "verified" ? (
                  <CheckIcon className="mt-0.5 size-4 text-success" />
                ) : (
                  <WarningIcon className="mt-0.5 size-4 text-warning" />
                )}
                <div className="min-w-0">
                  <p className="text-ink">
                    {id !== undefined && (
                      <Badge tone="warning" mono className="mr-1.5">
                        {id}
                      </Badge>
                    )}
                    {aspect}
                  </p>
                  <p className="mt-0.5 text-ink-2 [overflow-wrap:anywhere]">
                    {item.source.startsWith("http") ? (
                      <a
                        href={item.source}
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-accent underline underline-offset-2"
                        title={item.source}
                      >
                        Source:{" "}
                        {new URL(item.source).hostname.replace(/^www\./, "")}
                        <ExternalIcon className="size-3" />
                      </a>
                    ) : (
                      item.source
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
