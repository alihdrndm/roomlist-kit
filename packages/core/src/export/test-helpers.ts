import { readFileSync } from "node:fs";
import {
  type BlockContext,
  BlockContextSchema,
  type RoomingList,
} from "../model.js";
import { parseRoomingList } from "../parse/parse.js";
import { type IsoDate, parseIsoDate } from "../plain-date.js";

const fixtureUrl = (path: string) =>
  new URL(`../../../../fixtures/${path}`, import.meta.url);

export const readFixtureBytes = (path: string) =>
  new Uint8Array(readFileSync(fixtureUrl(path)));

export function tech26(): BlockContext {
  return BlockContextSchema.parse(
    JSON.parse(readFileSync(fixtureUrl("blocks/tech26.json"), "utf-8")),
  );
}

/** The WE1 list with the tech26 block, parsed from the real fixture file. */
export async function we1List(): Promise<RoomingList> {
  const parsed = await parseRoomingList(readFixtureBytes("input/we1.csv"));
  return { block: tech26(), entries: parsed.entries };
}

export function date(text: string): IsoDate {
  const parsed = parseIsoDate(text);
  if (parsed === undefined) throw new Error(`bad test date ${text}`);
  return parsed;
}
