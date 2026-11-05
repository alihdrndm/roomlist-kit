"use client";

import Link from "next/link";
import { ResetIcon } from "@/components/icons";
import { Button, buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/surface";

/** Shown when a page throws while rendering. Nothing about the error is displayed: it could contain guest data. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <PageHeader eyebrow="Something went wrong" title="This page stopped">
        <p>
          The page hit an unexpected error. Your files were not stored, so
          nothing is lost on our side; try again, and if it keeps happening,
          report it with the reference below.
        </p>
      </PageHeader>
      <div className="mt-8 flex flex-wrap gap-2">
        <Button onClick={reset}>
          <ResetIcon />
          Try again
        </Button>
        <Link href="/" className={buttonClass("secondary")}>
          Back to Validate & convert
        </Link>
      </div>
      {error.digest !== undefined && (
        <p className="mt-6 font-mono text-xs text-ink-3">
          Reference {error.digest}
        </p>
      )}
    </div>
  );
}
