import { describe, expect, it } from "vitest";
import {
  BlockContextSchema,
  CanonicalFieldSchema,
  IsoDateSchema,
  ParsedEntrySchema,
  RoomingEntrySchema,
} from "./model.js";

describe("IsoDateSchema", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(IsoDateSchema.safeParse("2026-11-10").success).toBe(true);
    expect(IsoDateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(IsoDateSchema.safeParse("11/10/2026").success).toBe(false);
  });
});

describe("BlockContextSchema", () => {
  it("parses the WE1 block and defaults shoulderDays to 0", () => {
    const block = BlockContextSchema.parse({
      startDate: "2026-11-10",
      endDate: "2026-11-14",
    });
    expect(block.shoulderDays).toBe(0);
  });

  it("requires startDate when endDate is given", () => {
    const result = BlockContextSchema.safeParse({ endDate: "2026-11-14" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["startDate"]);
  });

  it("requires endDate after startDate", () => {
    const result = BlockContextSchema.safeParse({
      startDate: "2026-11-14",
      endDate: "2026-11-14",
    });
    expect(result.error?.issues[0]?.path).toEqual(["endDate"]);
  });

  it("rejects unknown keys and out-of-range values", () => {
    expect(BlockContextSchema.safeParse({ hotel: "x" }).success).toBe(false);
    expect(BlockContextSchema.safeParse({ shoulderDays: 8 }).success).toBe(
      false,
    );
    expect(
      BlockContextSchema.safeParse({ maxOccupancy: { KING: 11 } }).success,
    ).toBe(false);
  });
});

describe("entry schemas", () => {
  const minimal = {
    line: 1,
    lastName: "Okafor",
    arrivalDate: "2026-11-10",
    departureDate: "2026-11-13",
  };
  const counts = { rooms: 1, adults: 1, children: 0, infants: 0 };

  it("RoomingEntry requires lastName and both dates", () => {
    expect(
      RoomingEntrySchema.safeParse({ ...minimal, ...counts }).success,
    ).toBe(true);
    expect(RoomingEntrySchema.safeParse({ line: 1, ...counts }).success).toBe(
      false,
    );
  });

  it("ParsedEntry allows lastName and both dates to be missing", () => {
    expect(ParsedEntrySchema.safeParse({ line: 1, ...counts }).success).toBe(
      true,
    );
  });

  it("CanonicalField covers every entry field plus fullName", () => {
    expect(CanonicalFieldSchema.options).toContain("fullName");
    expect(CanonicalFieldSchema.options).toContain("travelAgentLocator");
    expect(CanonicalFieldSchema.options).toHaveLength(23);
  });
});
