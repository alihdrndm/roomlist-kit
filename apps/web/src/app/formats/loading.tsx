import { Skeleton, Status } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/surface";

/** Shown while the /formats server component waits for the API. */
export default function FormatsLoading() {
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Reference" title="Export formats">
        <Status>Loading the formats…</Status>
      </PageHeader>
      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
