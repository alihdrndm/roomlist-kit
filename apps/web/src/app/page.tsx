import { PageHeader } from "@/components/ui/surface";
import { Workbench } from "@/components/validate/workbench";

export default function Home() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Rooming list" title="Validate & convert">
        <p>
          Check a rooming list (CSV or Excel) against the room block, see
          exactly what to fix and how many rooms each night needs, then download
          the import file your hotel&apos;s system expects. Nothing you upload
          is stored.
        </p>
      </PageHeader>
      <Workbench />
    </div>
  );
}
