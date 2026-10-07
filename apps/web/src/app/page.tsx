import { ValidateConvert } from "./validate-convert";

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Validate &amp; convert
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-700">
          Upload a rooming list (CSV or Excel). See exactly what is wrong with
          it, then download the import file your hotel&apos;s system expects.
          Nothing you upload is stored.
        </p>
      </div>
      <ValidateConvert />
    </div>
  );
}
