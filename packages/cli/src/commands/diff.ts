import { type DateOrder, diffRoomingLists } from "@alihdrndm/roomlist-core";
import { colorFor, formatDiff, formatIssues } from "../format.js";
import { EXIT } from "../io.js";
import { loadList } from "./validate.js";

export type DiffCliOptions = {
  dateOrder?: DateOrder | undefined;
  json?: boolean | undefined;
};

export async function diffCommand(
  beforeFile: string,
  afterFile: string,
  options: DiffCliOptions,
): Promise<number> {
  const inputOptions = { dateOrder: options.dateOrder };
  const before = await loadList(beforeFile, inputOptions);
  const after = await loadList(afterFile, inputOptions);

  // A diff of an invalid list would be misleading, so name the side that needs fixing instead.
  const stderr = colorFor(process.stderr);
  const sides = [
    { label: "before", file: beforeFile, loaded: before },
    { label: "after", file: afterFile, loaded: after },
  ];
  let failed = false;
  for (const { label, file, loaded } of sides) {
    if (!loaded.hasErrors) continue;
    failed = true;
    process.stderr.write(
      `${label}: ${file} has errors\n${formatIssues(loaded.issues, stderr)}\n`,
    );
  }
  if (failed) return EXIT.listInvalid;

  const report = diffRoomingLists(before.list, after.list);
  if (options.json === true) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatDiff(report, colorFor(process.stdout))}\n`);
  }
  return EXIT.ok;
}
