import { readFile, stat } from "node:fs/promises";
import {
  type BlockContext,
  BlockContextSchema,
} from "@alihdrndm/roomlist-core";

/** Exit codes from the project spec ("CLI"). */
export const EXIT = {
  /** Success, and the list has no errors. */
  ok: 0,
  /** The list has validation errors, or an export precondition failed. */
  listInvalid: 1,
  /** Usage error, unreadable file, or a bad option value. */
  usage: 2,
} as const;

/** A problem the user can fix; carries the exit code the process should end with. */
export class CliError extends Error {
  readonly exitCode: number;
  constructor(exitCode: number, message: string) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

/** Same limit as the API's default MAX_UPLOAD_BYTES (5 MB), so both reject the same files. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Reads an input file, refusing anything over 5 MB before loading it into memory:
 * the size is checked with stat first, so a huge file is never read.
 */
export async function readInputFile(path: string): Promise<Uint8Array> {
  let size: number;
  try {
    const info = await stat(path);
    if (!info.isFile())
      throw new CliError(EXIT.usage, `${path} is not a file.`);
    size = info.size;
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(EXIT.usage, `Cannot read ${path}: ${describe(error)}`);
  }
  if (size > MAX_FILE_BYTES) {
    throw new CliError(
      EXIT.usage,
      `${path} is ${(size / 1024 / 1024).toFixed(1)} MB; the limit is 5 MB. Split the list into smaller files.`,
    );
  }
  try {
    return new Uint8Array(await readFile(path));
  } catch (error) {
    throw new CliError(EXIT.usage, `Cannot read ${path}: ${describe(error)}`);
  }
}

/** Reads and validates a --block JSON file against the core BlockContext schema. */
export async function readBlockFile(path: string): Promise<BlockContext> {
  const bytes = await readInputFile(path);
  const json = parseJson(new TextDecoder().decode(bytes), `--block ${path}`);
  const result = BlockContextSchema.safeParse(json);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    throw new CliError(
      EXIT.usage,
      `--block ${path} is not a valid block: ${problems.join("; ")}`,
    );
  }
  return result.data;
}

/** Parses JSON given on the command line (for example --options). */
export function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new CliError(
      EXIT.usage,
      `${label} is not valid JSON: ${describe(error)}`,
    );
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
