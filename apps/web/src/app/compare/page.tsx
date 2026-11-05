import type { Metadata } from "next";
import { Compare } from "@/components/compare/compare";
import { PageHeader } from "@/components/ui/surface";

export const metadata: Metadata = { title: "Compare two lists" };

export default function ComparePage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Versions" title="Compare two lists">
        <p>
          The client sent a new version. Upload it with the one the hotel
          already has to see who was added, removed or changed, and where the
          room nights moved.
        </p>
      </PageHeader>
      <Compare />
    </div>
  );
}
