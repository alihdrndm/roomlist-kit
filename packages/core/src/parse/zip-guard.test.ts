import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  checkZipSizes,
  MAX_UNPACKED_BYTES,
  MAX_ZIP_PARTS,
} from "./zip-guard.js";

/** A zip with only a central directory: entries of the given declared sizes, no file data. */
function fakeZip(
  sizes: number[],
  options: { zip64?: boolean } = {},
): Uint8Array {
  const name = new TextEncoder().encode("a.xml");
  const entryLength = 46 + name.length;
  const directory = new Uint8Array(sizes.length * entryLength);
  const view = new DataView(directory.buffer);
  sizes.forEach((size, index) => {
    const at = index * entryLength;
    view.setUint32(at, 0x02014b50, true);
    view.setUint32(at + 24, size, true);
    view.setUint16(at + 28, name.length, true);
    directory.set(name, at + 46);
  });
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(10, options.zip64 ? 0xffff : sizes.length, true);
  endView.setUint32(12, directory.length, true);
  endView.setUint32(16, 0, true);
  const zip = new Uint8Array(directory.length + end.length);
  zip.set(directory, 0);
  zip.set(end, directory.length);
  return zip;
}

describe("checkZipSizes", () => {
  it("accepts a real workbook", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Guests").addRow(["Last Name"]);
    expect(
      checkZipSizes(new Uint8Array(await workbook.xlsx.writeBuffer())),
    ).toEqual({ ok: true });
  });

  it("accepts a small archive and one exactly at the unpacked limit", () => {
    expect(checkZipSizes(fakeZip([1000, 2000]))).toEqual({ ok: true });
    expect(checkZipSizes(fakeZip([MAX_UNPACKED_BYTES]))).toEqual({ ok: true });
  });

  it("F003 reason: declared unpacked size over the limit (a zip bomb)", () => {
    const result = checkZipSizes(
      fakeZip([MAX_UNPACKED_BYTES / 2, MAX_UNPACKED_BYTES / 2 + 1]),
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain("100 MB");
  });

  it("rejects too many parts, a zip64 marker, and a zip64 size", () => {
    expect(
      checkZipSizes(fakeZip(new Array(MAX_ZIP_PARTS + 1).fill(1))).ok,
    ).toBe(false);
    expect(checkZipSizes(fakeZip([1], { zip64: true })).ok).toBe(false);
    expect(checkZipSizes(fakeZip([0xffffffff])).ok).toBe(false);
  });

  it("lets through bytes it cannot read, so the workbook reader reports them as corrupt", () => {
    expect(
      checkZipSizes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])),
    ).toEqual({ ok: true });
    expect(checkZipSizes(new Uint8Array())).toEqual({ ok: true });
    // A directory entry whose signature is wrong.
    const broken = fakeZip([1]);
    new DataView(broken.buffer).setUint32(0, 0, true);
    expect(checkZipSizes(broken)).toEqual({ ok: true });
  });
});
