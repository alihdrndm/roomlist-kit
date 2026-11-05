import { readFileSync } from "node:fs";
import {
  type BlockContext,
  BlockContextSchema,
  type DiffReport,
  diffRoomingLists,
  parseRoomingList,
  type RoomingList,
  sortIssues,
  summarize,
  type ValidateReport,
  validateRoomingList,
} from "@alihdrndm/roomlist-core";

// Builds reports from the repo's fixtures with core itself, exactly as the API's
// service does, so web helpers are tested against real results.

const fixture = (path: string) =>
  new Uint8Array(
    readFileSync(new URL(`../../../../fixtures/${path}`, import.meta.url)),
  );

export function tech26(): BlockContext {
  return BlockContextSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../../fixtures/blocks/tech26.json", import.meta.url),
        "utf8",
      ),
    ),
  );
}

async function load(path: string, block?: BlockContext) {
  const parsed = await parseRoomingList(fixture(path), {});
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

export async function validateReport(
  path: string,
  block?: BlockContext,
): Promise<ValidateReport> {
  const { parsed, list, issues } = await load(path, block);
  return {
    ok: !issues.some((issue) => issue.severity === "error"),
    format: parsed.format,
    rowCount: parsed.rowCount,
    columns: parsed.columns,
    entries: parsed.entries,
    issues,
    summary: summarize(list),
  };
}

export async function diffReport(
  before: string,
  after: string,
): Promise<DiffReport> {
  const [a, b] = await Promise.all([load(before), load(after)]);
  return diffRoomingLists(a.list, b.list);
}
