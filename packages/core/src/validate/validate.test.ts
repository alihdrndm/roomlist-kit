import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BlockContextSchema } from "../model.js";
import { parseRoomingList } from "../parse/parse.js";
import { validateRoomingList } from "./validate.js";

const fixture = (path: string) =>
  new Uint8Array(
    readFileSync(new URL(`../../../../fixtures/${path}`, import.meta.url)),
  );
const tech26 = BlockContextSchema.parse(
  JSON.parse(new TextDecoder().decode(fixture("blocks/tech26.json"))),
);

describe("validateRoomingList", () => {
  it("WE1: zero errors and zero warnings with the tech26 block", async () => {
    const parsed = await parseRoomingList(fixture("input/we1.csv"));
    expect(parsed.issues).toEqual([]);
    expect(
      validateRoomingList(
        { block: tech26, entries: parsed.entries },
        { entryRows: parsed.entryRows },
      ),
    ).toEqual([]);
  });

  it("clean-40: zero issues with the tech26 block", async () => {
    const parsed = await parseRoomingList(fixture("input/clean-40.csv"));
    expect(
      validateRoomingList(
        { block: tech26, entries: parsed.entries },
        { entryRows: parsed.entryRows },
      ),
    ).toEqual([]);
  });

  it("skips block-dependent rules when there is no block", async () => {
    const parsed = await parseRoomingList(fixture("input/we1.csv"));
    const outOfBlock = parsed.entries.map((entry) => ({
      ...entry,
      roomType: "PENTHOUSE",
    }));
    expect(validateRoomingList({ entries: outOfBlock })).toEqual([]);
  });

  it("sorts errors first, then row, then rule ID", async () => {
    const text = [
      "Last Name,Arrival,Departure,Email,Room Type",
      "Okafor,2026-11-10,2026-11-13,bad,",
      ",2026-11-13,2026-11-10,,KING",
    ].join("\n");
    const parsed = await parseRoomingList(new TextEncoder().encode(text));
    const issues = validateRoomingList(
      { block: tech26, entries: parsed.entries },
      { entryRows: parsed.entryRows },
    );
    expect(issues.map((issue) => `${issue.ruleId}@${issue.row}`)).toEqual([
      "R008@2",
      "R001@3",
      "R003@3",
      "W204@2",
    ]);
  });
});
