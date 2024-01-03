import {
  type BlockContext,
  type DiffReport,
  diffRoomingLists,
  ExportOptionsError,
  ExportPreconditionError,
  exportRoomingList,
  type Issue,
  type ParseResult,
  parseRoomingList,
  type RoomingList,
  sortIssues,
  summarize,
  UnknownTargetError,
  type ValidateReport,
  validateRoomingList,
} from "@alihdrndm/roomlist-core";
import { Inject, Injectable } from "@nestjs/common";
import type { Config } from "./config.js";
import { CONFIG } from "./config.module.js";
import { ApiError } from "./errors.js";
import { type ApiParseOptions, validationError } from "./schemas.js";

export type LoadedList = {
  parsed: ParseResult;
  list: RoomingList;
  /** Parser issues and validation issues together, sorted. */
  issues: Issue[];
};

export type ConvertResult = {
  bytes: Uint8Array;
  fileName: string;
  contentType: string;
  warnings: number;
};

const hasErrors = (issues: readonly Issue[]) =>
  issues.some((issue) => issue.severity === "error");
const countWarnings = (issues: readonly Issue[]) =>
  issues.filter((issue) => issue.severity === "warning").length;

/** The rooming-list use cases: thin glue between HTTP and the core library. */
@Injectable()
export class RoomingListsService {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  /** Parse, then validate; the planner needs the cell problems and the rule problems together. */
  private async load(
    file: Uint8Array,
    block: BlockContext | undefined,
    options: ApiParseOptions | undefined,
  ): Promise<LoadedList> {
    const parsed = await parseRoomingList(file, {
      ...options,
      maxRows: this.config.MAX_ROWS,
    });
    const list: RoomingList =
      block === undefined
        ? { entries: parsed.entries }
        : { block, entries: parsed.entries };
    const issues = sortIssues([
      ...parsed.issues,
      ...validateRoomingList(list, { entryRows: parsed.entryRows }),
    ]);
    return { parsed, list, issues };
  }

  /** The report is the product, so a list with errors is still a normal result here. */
  async validate(
    file: Uint8Array,
    block: BlockContext | undefined,
    options: ApiParseOptions | undefined,
  ): Promise<ValidateReport> {
    const { parsed, list, issues } = await this.load(file, block, options);
    return {
      ok: !hasErrors(issues),
      format: parsed.format,
      rowCount: parsed.rowCount,
      columns: parsed.columns,
      entries: parsed.entries,
      issues,
      summary: summarize(list),
    };
  }

  async convert(
    file: Uint8Array,
    block: BlockContext | undefined,
    options: ApiParseOptions | undefined,
    target: string,
    targetOptions: unknown,
  ): Promise<ConvertResult> {
    const { list, issues } = await this.load(file, block, options);
    if (hasErrors(issues)) {
      const errors = issues.filter(
        (issue) => issue.severity === "error",
      ).length;
      throw new ApiError(
        "LIST_INVALID",
        `The rooming list has ${errors} error${errors === 1 ? "" : "s"}; fix them before converting.`,
        { extensions: { issues } },
      );
    }
    try {
      const result = await exportRoomingList(list, target, targetOptions);
      // The export repeats the validation warnings with line numbers only; count the
      // ones we already have, plus the export's own warnings (rule IDs starting with X).
      const exportWarnings = result.issues.filter((issue) =>
        issue.ruleId.startsWith("X"),
      ).length;
      return {
        bytes: result.bytes,
        fileName: result.fileName,
        contentType: result.contentType,
        warnings: countWarnings(issues) + exportWarnings,
      };
    } catch (error) {
      if (error instanceof ExportPreconditionError) {
        throw new ApiError(
          "EXPORT_PRECONDITION_FAILED",
          `${error.message} The list cannot be written in this format yet.`,
          { extensions: { issues: error.issues } },
        );
      }
      if (error instanceof ExportOptionsError) {
        throw validationError(error.issues, "targetOptions");
      }
      if (error instanceof UnknownTargetError) {
        throw new ApiError("VALIDATION_FAILED", error.message, {
          errors: [
            { path: "target", code: "invalid_value", message: error.message },
          ],
        });
      }
      throw error;
    }
  }

  async diff(
    before: Uint8Array,
    after: Uint8Array,
    options: ApiParseOptions | undefined,
  ): Promise<DiffReport> {
    const [first, second] = await Promise.all([
      this.load(before, undefined, options),
      this.load(after, undefined, options),
    ]);
    if (hasErrors(first.issues) || hasErrors(second.issues)) {
      const tagged = [
        ...first.issues.map((issue) => ({ ...issue, side: "before" as const })),
        ...second.issues.map((issue) => ({ ...issue, side: "after" as const })),
      ];
      throw new ApiError(
        "LIST_INVALID",
        "One or both rooming lists have errors; fix them before comparing.",
        {
          extensions: { issues: tagged },
        },
      );
    }
    return diffRoomingLists(first.list, second.list);
  }
}
