import type { Metadata } from "next";
import { EmptyState, ProblemNotice } from "@/components/ui";
import { optionFields } from "@/lib/forms";
import { readProblem } from "@/lib/problem";
import { getFromApi } from "@/lib/proxy";
import type { TargetInfo, TargetsResponse } from "@/lib/types";

export const metadata: Metadata = { title: "Formats – roomlist-kit" };
export const dynamic = "force-dynamic";

export default async function FormatsPage() {
  const response = await getFromApi("/v1/formats");
  if (!response.ok) {
    const problem = await readProblem(response);
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Formats</h1>
        <ProblemNotice problem={problem} />
      </div>
    );
  }
  const { targets } = (await response.json()) as TargetsResponse;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Formats</h1>
        <p className="mt-2 max-w-2xl text-zinc-700">
          What each export format contains, and which parts are checked against
          the vendor&apos;s documentation and which are assumed.
        </p>
      </div>
      {targets.length === 0 ? (
        <EmptyState>The API lists no export formats.</EmptyState>
      ) : (
        targets.map((target) => <TargetCard key={target.id} target={target} />)
      )}
    </div>
  );
}

function TargetCard({ target }: { target: TargetInfo }) {
  const headingId = `format-${target.id}`;
  const fields = optionFields(target.optionsSchema);
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-lg border border-zinc-300 bg-white p-4"
    >
      <h2 id={headingId} className="text-xl font-semibold">
        {target.label}
      </h2>
      <p className="mt-1 text-zinc-700">
        File type: <code>.{target.fileExtension}</code> ({target.contentType})
      </p>

      <h3 className="mt-4 text-sm font-semibold text-zinc-900">Options</h3>
      {fields.length === 0 ? (
        <p className="mt-1 text-zinc-700">No options.</p>
      ) : (
        <ul className="mt-1 list-disc pl-5 text-zinc-700">
          {fields.map((field) => (
            <li key={field.name}>
              <code>{field.name}</code>: {field.kind}, default{" "}
              {field.defaultValue === "" ? (
                "none"
              ) : (
                <code>{String(field.defaultValue)}</code>
              )}
              , {field.required ? "required" : "optional"}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-4 text-sm font-semibold text-zinc-900">
        What is verified
      </h3>
      {target.provenance.length === 0 ? (
        <p className="mt-1 text-zinc-700">
          Our own format; nothing to verify against.
        </p>
      ) : (
        <div className="mt-1 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Verified and assumed aspects of {target.label}
            </caption>
            <thead>
              <tr className="border-b border-zinc-300 text-zinc-900">
                <th scope="col" className="w-1/2 py-2 pr-4 font-semibold">
                  Verified
                </th>
                <th scope="col" className="w-1/2 py-2 font-semibold">
                  Assumed
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="align-top text-zinc-700">
                <td className="py-2 pr-4">
                  <ProvenanceList
                    items={target.provenance.filter(
                      (item) => item.status === "verified",
                    )}
                  />
                </td>
                <td className="py-2">
                  <ProvenanceList
                    items={target.provenance.filter(
                      (item) => item.status === "assumed",
                    )}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** One column of the provenance table: each aspect with its source (a link when it is a URL). */
function ProvenanceList({ items }: { items: TargetInfo["provenance"] }) {
  if (items.length === 0) return <p>None.</p>;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={`${item.aspect}-${item.source}`}>
          <span className="font-medium text-zinc-900">{item.aspect}</span>
          <br />
          <span className="break-words">
            Source:{" "}
            {item.source.startsWith("http") ? (
              <a
                href={item.source}
                className="text-blue-800 underline"
                rel="noreferrer"
              >
                {item.source}
              </a>
            ) : (
              item.source
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
