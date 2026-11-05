import { describe, expect, it } from "vitest";
import { CanonicalFieldSchema } from "../model.js";
import { HEADER_ALIASES } from "./header-aliases.js";
import { normaliseHeader } from "./headers.js";

describe("HEADER_ALIASES", () => {
  it("has an entry for every canonical field", () => {
    expect(Object.keys(HEADER_ALIASES).sort()).toEqual(
      [...CanonicalFieldSchema.options].sort(),
    );
  });

  it("stores aliases already normalised and never maps one alias to two fields", () => {
    const seen = new Map<string, string>();
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      for (const alias of aliases) {
        expect(normaliseHeader(alias)).toBe(alias);
        expect(seen.get(alias) ?? field).toBe(field);
        seen.set(alias, field);
      }
    }
  });
});
