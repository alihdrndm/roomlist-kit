import type { Metadata } from "next";
import { Compare } from "./compare";

export const metadata: Metadata = { title: "Compare – roomlist-kit" };

export default function ComparePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Compare two lists
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-700">
          Upload an earlier and a later version of the same rooming list to see
          who was added, who was removed and what changed.
        </p>
      </div>
      <Compare />
    </div>
  );
}
