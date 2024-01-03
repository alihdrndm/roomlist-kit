import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type BlockForm,
  blockFormFrom,
  buildBlock,
  buildTargetOptions,
  EMPTY_BLOCK,
  fileNameFrom,
  formatBytes,
  optionFields,
  signed,
} from "@/lib/forms";

const tech26: unknown = JSON.parse(
  readFileSync(
    new URL("../../../../fixtures/blocks/tech26.json", import.meta.url),
    "utf8",
  ),
);

describe("buildBlock", () => {
  it("returns undefined for an empty form", () => {
    expect(buildBlock(EMPTY_BLOCK)).toBeUndefined();
  });

  it("omits blank fields", () => {
    expect(
      buildBlock({ ...EMPTY_BLOCK, blockCode: " TECH26 ", propertyCode: "  " }),
    ).toEqual({ blockCode: "TECH26" });
  });

  it("turns shoulderDays into a number and sends non-numbers as typed", () => {
    expect(buildBlock({ ...EMPTY_BLOCK, shoulderDays: "2" })).toEqual({
      shoulderDays: 2,
    });
    expect(buildBlock({ ...EMPTY_BLOCK, shoulderDays: "two" })).toEqual({
      shoulderDays: "two",
    });
  });

  it("splits room types on commas", () => {
    expect(buildBlock({ ...EMPTY_BLOCK, roomTypes: "KING, QQ" })).toEqual({
      roomTypes: ["KING", "QQ"],
    });
  });

  it("keeps maxOccupancy only when other fields exist", () => {
    const maxOccupancy = { KING: 3 };
    expect(buildBlock({ ...EMPTY_BLOCK, maxOccupancy })).toBeUndefined();
    expect(
      buildBlock({ ...EMPTY_BLOCK, blockCode: "X", maxOccupancy }),
    ).toEqual({ blockCode: "X", maxOccupancy });
  });
});

describe("blockFormFrom", () => {
  it("fills the form from the tech26 sample and round-trips through buildBlock", () => {
    const form: BlockForm = blockFormFrom(tech26);
    expect(form.blockCode).toBe("TECH26");
    expect(form.shoulderDays).toBe("1");
    expect(form.roomTypes).toBe("KING, QQ");
    expect(buildBlock(form)).toEqual(tech26);
  });

  it("gives an empty form for something that is not an object", () => {
    expect(blockFormFrom(null)).toEqual(EMPTY_BLOCK);
  });
});

describe("optionFields", () => {
  const schema = {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["a", "b"], default: "b" },
      flag: { type: "boolean", default: true },
      note: { type: "string" },
      code: { type: "string", default: "X" },
    },
    required: ["mode", "note", "code"],
  };

  it("maps enum, boolean and string to select, checkbox and text", () => {
    const fields = optionFields(schema);
    expect(fields.map((field) => [field.name, field.kind])).toEqual([
      ["mode", "select"],
      ["flag", "checkbox"],
      ["note", "text"],
      ["code", "text"],
    ]);
  });

  it("reads defaults and required (a default makes a field not required)", () => {
    const [mode, flag, note, code] = optionFields(schema);
    expect(mode).toMatchObject({
      choices: ["a", "b"],
      defaultValue: "b",
      required: false,
    });
    expect(flag).toMatchObject({ defaultValue: true, required: false });
    expect(note).toMatchObject({ defaultValue: "", required: true });
    expect(code).toMatchObject({ defaultValue: "X", required: false });
  });

  it("gives no fields for a schema without properties", () => {
    expect(optionFields({})).toEqual([]);
  });
});

describe("buildTargetOptions", () => {
  const fields = optionFields({
    properties: {
      mode: { enum: ["a", "b"] },
      flag: { type: "boolean" },
      note: { type: "string" },
    },
  });

  it("uses defaults, trims text and leaves empty text out", () => {
    expect(buildTargetOptions(fields, {})).toEqual({ mode: "a", flag: false });
    expect(
      buildTargetOptions(fields, { mode: "b", flag: true, note: "  hi " }),
    ).toEqual({
      mode: "b",
      flag: true,
      note: "hi",
    });
  });
});

describe("formatBytes", () => {
  it("picks B, KB or MB", () => {
    expect(formatBytes(812)).toBe("812 B");
    expect(formatBytes(14541)).toBe("14.2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

describe("signed", () => {
  it("always shows the sign of a change", () => {
    expect(signed(3)).toBe("+3");
    expect(signed(-2)).toBe("-2");
    expect(signed(0)).toBe("0");
  });
});

describe("fileNameFrom", () => {
  it("reads the file name from the header", () => {
    expect(fileNameFrom('attachment; filename="rooms.xml"', "x.bin")).toBe(
      "rooms.xml",
    );
  });

  it("falls back when there is no header or no file name", () => {
    expect(fileNameFrom(null, "x.bin")).toBe("x.bin");
    expect(fileNameFrom("attachment", "x.bin")).toBe("x.bin");
  });
});
