#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Command, CommanderError, Option } from "commander";
import { type ConvertCliOptions, convertCommand } from "./commands/convert.js";
import { type DiffCliOptions, diffCommand } from "./commands/diff.js";
import { formatsCommand } from "./commands/formats.js";
import {
  type ValidateCliOptions,
  validateCommand,
} from "./commands/validate.js";
import { CliError, EXIT } from "./io.js";

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function dateOrderOption(): Option {
  return new Option(
    "--date-order <order>",
    "day/month order of ambiguous dates",
  ).choices(["MDY", "DMY"]);
}

/** Builds the program; `setExit` receives the exit code of the command that ran. */
function buildProgram(setExit: (code: number) => void): Command {
  const program = new Command();
  program
    .name("roomlist")
    .description("Validate, convert and diff hotel rooming lists")
    // Usage errors must end with code 2, not commander's default 1, so commander must not exit itself.
    .exitOverride()
    .configureOutput({
      writeOut: (text) => process.stdout.write(text),
      writeErr: (text) => process.stderr.write(text),
    });

  // Every action runs through here so that errors become messages and exit codes.
  const run = async (task: () => Promise<number>): Promise<void> => {
    try {
      setExit(await task());
    } catch (error) {
      if (error instanceof CliError) {
        process.stderr.write(`${error.message}\n`);
        setExit(error.exitCode);
      } else {
        process.stderr.write(`Unexpected error: ${message(error)}\n`);
        setExit(EXIT.usage);
      }
    }
  };

  program
    .command("validate")
    .description("Check a rooming list and print the issues and summary")
    .argument("<file>", "CSV or XLSX rooming list")
    .option("--block <json file>", "block context (JSON file)")
    .addOption(dateOrderOption())
    .option("--sheet <name>", "worksheet to read (XLSX)")
    .option("--json", "print the full report as JSON")
    .action((file: string, opts: ValidateCliOptions) =>
      run(() => validateCommand(file, opts)),
    );

  program
    .command("convert")
    .description("Convert a rooming list to a PMS import file")
    .argument("<file>", "CSV or XLSX rooming list")
    .requiredOption("--to <target>", "export target (see: roomlist formats)")
    .option(
      "-o, --output <out file>",
      "output path (default: the target's file name in the current directory)",
    )
    .option("--block <json file>", "block context (JSON file)")
    .addOption(dateOrderOption())
    .option("--sheet <name>", "worksheet to read (XLSX)")
    .option("--options <json string>", "target options as a JSON string")
    .option("--force", "overwrite an existing output file")
    .action((file: string, opts: ConvertCliOptions) =>
      run(() => convertCommand(file, opts)),
    );

  program
    .command("diff")
    .description("Compare two rooming lists")
    .argument("<before>", "earlier rooming list")
    .argument("<after>", "later rooming list")
    .addOption(dateOrderOption())
    .option("--json", "print the diff report as JSON")
    .action((before: string, after: string, opts: DiffCliOptions) =>
      run(() => diffCommand(before, after, opts)),
    );

  program
    .command("formats")
    .description("List export targets and what is verified about each")
    .option("--json", "print the targets as JSON")
    .action((opts: { json?: boolean }) => run(() => formatsCommand(opts)));

  return program;
}

/** Runs the CLI and returns the exit code. */
export async function main(argv: readonly string[]): Promise<number> {
  let exitCode: number = EXIT.ok;
  const program = buildProgram((code) => {
    exitCode = code;
  });
  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      // Help and version end with 0; everything else commander rejects is a usage error.
      return error.exitCode === 0 ? EXIT.ok : EXIT.usage;
    }
    process.stderr.write(`Unexpected error: ${message(error)}\n`);
    return EXIT.usage;
  }
  return exitCode;
}

/** True when this file is the process entry point (also through a symlinked bin). */
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  process.exitCode = await main(process.argv.slice(2));
}
