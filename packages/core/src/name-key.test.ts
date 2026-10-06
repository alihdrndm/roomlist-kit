import { describe, expect, it } from "vitest";
import { nameKey, normaliseName } from "./name-key.js";

describe("normaliseName", () => {
  it("removes accents, case, punctuation and extra spaces", () => {
    expect(normaliseName("  Müller-Lüdenscheidt ")).toBe("mullerludenscheidt");
    expect(normaliseName("O'Brien")).toBe("obrien");
    expect(normaliseName("van  der   Berg")).toBe("van der berg");
    expect(normaliseName("Zoë")).toBe("zoe");
  });

  it("keeps letters from non-Latin scripts and digits", () => {
    expect(normaliseName("田中 2")).toBe("田中 2");
  });

  it("treats a tab as punctuation, not a space", () => {
    // Only literal spaces survive; the spec keeps "letters, digits and spaces".
    expect(normaliseName("Ada\tGrace")).toBe("adagrace");
  });
});

describe("nameKey", () => {
  it("joins last and first name, tolerating a missing first name", () => {
    expect(nameKey({ lastName: "Okafor", firstName: "Ada" })).toBe(
      "okafor|ada",
    );
    expect(nameKey({ lastName: "Ökafor" })).toBe("okafor|");
    expect(nameKey({})).toBe("|");
  });
});
