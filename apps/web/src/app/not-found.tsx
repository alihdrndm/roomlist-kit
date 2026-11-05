import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/surface";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <PageHeader eyebrow="404" title="No room by that number">
        <p>
          This page does not exist. It may have been moved, or the link has a
          typo.
        </p>
      </PageHeader>
      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/" className={buttonClass("primary")}>
          Validate a rooming list
          <ArrowRightIcon />
        </Link>
        <Link href="/guide" className={buttonClass("secondary")}>
          Read the guide
        </Link>
      </div>
    </div>
  );
}
