import type { z } from "zod";
import type { BlockContext, Issue, RoomingEntry } from "../model.js";
import type { Summary } from "../summarize.js";

export const TARGET_IDS = [
  "opera5-xml",
  "opera-cloud-xlsx",
  "maestro-csv",
  "canonical-json",
  "canonical-csv",
] as const;
export type TargetId = (typeof TARGET_IDS)[number];

export type ExportResult = {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
  /** Warnings only: errors make the export throw instead. */
  issues: Issue[];
};

/** One fact about an export format and whether it was checked against the vendor's own documentation. */
export type Provenance = {
  aspect: string;
  status: "verified" | "assumed";
  source: string;
};

/** Entries already narrowed to the strict shape, in output order, plus the facts a target may need. */
export type ExportInput = {
  entries: RoomingEntry[];
  block: BlockContext | undefined;
  summary: Summary;
};

export type Target = {
  id: TargetId;
  label: string;
  fileExtension: string;
  fileName: string;
  contentType: string;
  optionsSchema: z.ZodType;
  provenance: Provenance[];
  /** X001 checks specific to this target, run before `build`. */
  preconditions(input: ExportInput, options: unknown): Issue[];
  build(
    input: ExportInput,
    options: unknown,
  ): Promise<{ bytes: Uint8Array; issues: Issue[] }>;
};

/** Thrown when the list has validation errors or a target precondition (X001) fails. */
export class ExportPreconditionError extends Error {
  readonly issues: Issue[];
  constructor(issues: Issue[]) {
    super(
      `Export refused: ${issues.length} problem${issues.length === 1 ? "" : "s"} to fix first.`,
    );
    this.name = "ExportPreconditionError";
    this.issues = issues;
  }
}

/** Thrown when `options` does not match the target's options schema. */
export class ExportOptionsError extends Error {
  readonly issues: z.core.$ZodIssue[];
  constructor(issues: z.core.$ZodIssue[]) {
    super(
      `Invalid export options: ${issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ")}`,
    );
    this.name = "ExportOptionsError";
    this.issues = issues;
  }
}

export class UnknownTargetError extends Error {
  readonly targetId: string;
  constructor(targetId: string) {
    super(
      `Unknown export target "${targetId}". Known targets: ${TARGET_IDS.join(", ")}.`,
    );
    this.name = "UnknownTargetError";
    this.targetId = targetId;
  }
}
