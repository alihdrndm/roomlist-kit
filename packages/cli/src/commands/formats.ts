import { listTargets } from "@alihdrndm/roomlist-core";
import { colorFor, formatTargets } from "../format.js";
import { EXIT } from "../io.js";

export async function formatsCommand(options: {
  json?: boolean | undefined;
}): Promise<number> {
  const targets = listTargets();
  if (options.json === true) {
    process.stdout.write(`${JSON.stringify({ targets }, null, 2)}\n`);
  } else {
    process.stdout.write(
      `${formatTargets(targets, colorFor(process.stdout))}\n`,
    );
  }
  return EXIT.ok;
}
