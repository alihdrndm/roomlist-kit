import { Status } from "@/components/ui";

/** Shown while the /formats server component waits for the API. */
export default function FormatsLoading() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Formats</h1>
      <Status>Loading the formats…</Status>
    </div>
  );
}
