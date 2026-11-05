import { readFileSync } from "node:fs";
import {
  CanonicalFieldSchema,
  parseRoomingList,
  RULES,
} from "@alihdrndm/roomlist-core";
import { describe, expect, it } from "vitest";
import { CANONICAL_FIELDS, fieldLabel } from "./fields";
import { RULE_GUIDE, ruleCatalogue, ruleGuide } from "./rules";

describe("field labels", () => {
  it("label every canonical field core knows, and only those", () => {
    expect([...CANONICAL_FIELDS].sort()).toEqual(
      [...CanonicalFieldSchema.options].sort(),
    );
  });
  it("read camelCase names as words", () => {
    expect(fieldLabel("departureDate")).toBe("Departure");
    expect(fieldLabel("sharesWith")).toBe("Shares with");
    expect(fieldLabel("somethingNew")).toBe("Something new");
  });
});

describe("rule guide", () => {
  it("explains every rule in core's table, with core's code and severity", () => {
    expect(Object.keys(RULE_GUIDE).sort()).toEqual(Object.keys(RULES).sort());
    for (const rule of ruleCatalogue()) {
      expect(rule.guide.title, rule.id).not.toBe("");
      expect(rule.guide.help, rule.id).not.toBe("");
    }
    expect(ruleGuide("Z999")).toEqual({ title: "Z999", help: "" });
  });
});

const read = (path: string) => readFileSync(new URL(path, import.meta.url));

describe("public samples", () => {
  it("are the repo's fixtures, byte for byte", () => {
    for (const [sample, fixture] of [
      ["we1.csv", "input/we1.csv"],
      ["tech26.json", "blocks/tech26.json"],
      ["list-v1.csv", "input/list-v1.csv"],
      ["list-v2.csv", "input/list-v2.csv"],
    ]) {
      expect(
        read(`../../public/samples/${sample}`).equals(
          read(`../../../../fixtures/${fixture}`),
        ),
        sample,
      ).toBe(true);
    }
  });

  it("the template reads cleanly: every column recognised, no issues", async () => {
    const result = await parseRoomingList(
      new Uint8Array(read("../../public/samples/rooming-list-template.csv")),
      {},
    );
    expect(result.issues).toEqual([]);
    expect(result.columns.every((column) => column.field !== null)).toBe(true);
    expect(result.entries[2]?.sharesWithLine).toBe(2);
  });
});
