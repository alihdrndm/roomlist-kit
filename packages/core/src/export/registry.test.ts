import { describe, expect, it } from "vitest";
import { getTarget, isTargetId, listTargets } from "./registry.js";
import { TARGET_IDS, UnknownTargetError } from "./types.js";

describe("registry", () => {
  it("lists the five targets in a fixed order with file facts", () => {
    const targets = listTargets();
    expect(targets.map((target) => target.id)).toEqual([...TARGET_IDS]);
    expect(targets.map((target) => target.fileExtension)).toEqual([
      "xml",
      "xlsx",
      "csv",
      "json",
      "csv",
    ]);
    expect(
      targets.find((target) => target.id === "maestro-csv")?.contentType,
    ).toBe("text/csv; charset=utf-8");
  });

  it("gives every vendor target both verified and assumed provenance, each with a source", () => {
    for (const id of [
      "opera5-xml",
      "opera-cloud-xlsx",
      "maestro-csv",
    ] as const) {
      const provenance =
        listTargets().find((target) => target.id === id)?.provenance ?? [];
      expect(
        provenance.some((item) => item.status === "verified"),
        id,
      ).toBe(true);
      expect(
        provenance.some((item) => item.status === "assumed"),
        id,
      ).toBe(true);
      for (const item of provenance)
        expect(item.source.length, `${id}: ${item.aspect}`).toBeGreaterThan(10);
    }
  });

  it("names every assumption A1 to A8 exactly once across the targets", () => {
    const aspects = listTargets().flatMap((target) =>
      target.provenance.map((item) => item.aspect),
    );
    for (let n = 1; n <= 8; n++) {
      expect(
        aspects.filter((aspect) => aspect.startsWith(`A${n}:`)),
        `A${n}`,
      ).toHaveLength(1);
    }
  });

  it("canonical targets have no provenance entries", () => {
    for (const id of ["canonical-json", "canonical-csv"] as const) {
      expect(
        listTargets().find((target) => target.id === id)?.provenance,
      ).toEqual([]);
    }
  });

  it("publishes each target's options as JSON Schema with defaults and no unknown keys", () => {
    const maestro = listTargets().find(
      (target) => target.id === "maestro-csv",
    )?.optionsSchema;
    expect(maestro).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
    expect(JSON.stringify(maestro)).toContain("buildingCode");
    const opera5 = listTargets().find(
      (target) => target.id === "opera5-xml",
    )?.optionsSchema;
    expect(JSON.stringify(opera5)).toContain("RoomingListImport");
  });

  it("getTarget / isTargetId", () => {
    expect(getTarget("opera5-xml").id).toBe("opera5-xml");
    expect(isTargetId("opera5-xml")).toBe(true);
    expect(isTargetId("nope")).toBe(false);
    expect(() => getTarget("nope")).toThrow(UnknownTargetError);
  });
});

describe("registry verified facts", () => {
  it("lists the OPERA Cloud fact that the user can map headings by hand", () => {
    const provenance =
      listTargets().find((target) => target.id === "opera-cloud-xlsx")
        ?.provenance ?? [];
    expect(provenance).toContainEqual(
      expect.objectContaining({
        status: "verified",
        aspect: expect.stringContaining("maps columns by hand"),
      }),
    );
  });

  it("lists the Maestro fact about comma-only lines separately from the sharer-suffix fact", () => {
    const aspects = (
      listTargets().find((target) => target.id === "maestro-csv")?.provenance ??
      []
    ).map((item) => item.aspect);
    expect(aspects).toContain(
      "Lines consisting only of commas make the import fail",
    );
    expect(aspects.some((aspect) => aspect.includes("lower of the two"))).toBe(
      true,
    );
  });
});
