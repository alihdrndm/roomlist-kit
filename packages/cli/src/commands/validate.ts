import {
  type DateOrder,
  type Issue,
  type ParseOptions,
  type ParseResult,
  parseRoomingList,
  type RoomingList,
  sortIssues,
  summarize,
  validateRoomingList,
} from "@alihdrndm/roomlist-core";
import { colorFor, formatIssues, formatSummary } from "../format.js";
import { EXIT, readBlockFile, readInputFile } from "../io.js";

export type InputOptions = {
  block?: string | undefined;
  dateOrder?: DateOrder | undefined;
  sheet?: string | undefined;
};

export type ValidateCliOptions = InputOptions & { json?: boolean | undefined };

export type LoadedList = {
  parsed: ParseResult;
  list: RoomingList;
  /** Parse issues and validation issues together, errors first. */
  issues: Issue[];
  hasErrors: boolean;
};

/** Reads and parses one file (optionally with a block), then merges parse and validation issues. */
export async function loadList(
  file: string,
  options: InputOptions,
): Promise<LoadedList> {
  const block =
    options.block === undefined
      ? undefined
      : await readBlockFile(options.block);
  const bytes = await readInputFile(file);
  const parseOptions: ParseOptions = {};
  if (options.dateOrder !== undefined)
    parseOptions.dateOrder = options.dateOrder;
  if (options.sheet !== undefined) parseOptions.sheetName = options.sheet;
  const parsed = await parseRoomingList(bytes, parseOptions);
  const list: RoomingList =
    block === undefined
      ? { entries: parsed.entries }
      : { block, entries: parsed.entries };
  // The parser reports cell problems and the validator reports rule problems; the planner needs both.
  const issues = sortIssues([
    ...parsed.issues,
    ...validateRoomingList(list, { entryRows: parsed.entryRows }),
  ]);
  return {
    parsed,
    list,
    issues,
    hasErrors: issues.some((issue) => issue.severity === "error"),
  };
}

export async function validateCommand(
  file: string,
  options: ValidateCliOptions,
): Promise<number> {
  const { parsed, list, issues, hasErrors } = await loadList(file, options);
  const summary = summarize(list);
  // The report is the product, so it goes to stdout even when the list is invalid.
  if (options.json === true) {
    const report = {
      ok: !hasErrors,
      format: parsed.format,
      rowCount: parsed.rowCount,
      columns: parsed.columns,
      entries: parsed.entries,
      issues,
      summary,
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const color = colorFor(process.stdout);
    process.stdout.write(
      `${formatIssues(issues, color)}\n\n${formatSummary(summary, color)}\n`,
    );
  }
  return hasErrors ? EXIT.listInvalid : EXIT.ok;
}
