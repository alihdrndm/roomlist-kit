import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ExportOptionsError,
  ExportPreconditionError,
  exportRoomingList,
  type Issue,
  sortIssues,
  TARGET_IDS,
  UnknownTargetError,
} from "@alihdrndm/roomlist-core";
import { colorFor, formatIssues } from "../format.js";
import { CliError, EXIT, parseJson } from "../io.js";
import { type InputOptions, loadList } from "./validate.js";

export type ConvertCliOptions = InputOptions & {
  to: string;
  output?: string | undefined;
  options?: string | undefined;
  force?: boolean | undefined;
};

function writeIssues(issues: readonly Issue[]): void {
  process.stderr.write(`${formatIssues(issues, colorFor(process.stderr))}\n`);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function convertCommand(
  file: string,
  options: ConvertCliOptions,
): Promise<number> {
  if (!(TARGET_IDS as readonly string[]).includes(options.to)) {
    throw new CliError(
      EXIT.usage,
      `Unknown target "${options.to}". Valid targets: ${TARGET_IDS.join(", ")}.`,
    );
  }
  const exportOptions =
    options.options === undefined
      ? undefined
      : parseJson(options.options, "--options");

  const { list, issues, hasErrors } = await loadList(file, options);
  if (hasErrors) {
    writeIssues(issues);
    process.stderr.write("Nothing was written: fix the errors above first.\n");
    return EXIT.listInvalid;
  }

  let result: Awaited<ReturnType<typeof exportRoomingList>>;
  try {
    result = await exportRoomingList(list, options.to, exportOptions);
  } catch (error) {
    if (error instanceof ExportPreconditionError) {
      writeIssues(error.issues);
      process.stderr.write(
        "Nothing was written: fix the problems above first.\n",
      );
      return EXIT.listInvalid;
    }
    if (
      error instanceof ExportOptionsError ||
      error instanceof UnknownTargetError
    ) {
      throw new CliError(EXIT.usage, error.message);
    }
    throw error;
  }

  const outputPath = options.output ?? join(process.cwd(), result.fileName);
  try {
    // Flag "wx" fails if the file exists, which avoids a race between a check and the write.
    await writeFile(outputPath, result.bytes, {
      flag: options.force === true ? "w" : "wx",
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new CliError(
        EXIT.usage,
        `${outputPath} already exists; use --force to overwrite.`,
      );
    }
    throw new CliError(
      EXIT.usage,
      `Cannot write ${outputPath}: ${describe(error)}`,
    );
  }

  // `issues` already holds every parse and validation warning with its source row.
  // The export repeats the validation warnings with line numbers only, so take just
  // its own X-rule warnings (for example X101) from it.
  const exportWarnings = result.issues.filter((issue) =>
    issue.ruleId.startsWith("X"),
  );
  const warnings = sortIssues([...issues, ...exportWarnings]);
  if (warnings.length > 0) writeIssues(warnings);
  process.stdout.write(`Wrote ${outputPath} (${result.bytes.length} bytes)\n`);
  return EXIT.ok;
}
