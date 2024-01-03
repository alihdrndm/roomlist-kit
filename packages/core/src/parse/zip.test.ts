import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  extractEntry,
  MAX_UNPACKED_BYTES,
  MAX_ZIP_PARTS,
  readZipDirectory,
  type ZipEntry,
} from "./zip.js";

/** A zip with only a central directory: entries of the given declared sizes, no file data. */
function directoryOnly(
  sizes: number[],
  options: { zip64?: boolean } = {},
): Uint8Array {
  const name = strToU8("a.xml");
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
  const zip = new Uint8Array(directory.length + end.length);
  zip.set(directory, 0);
  zip.set(end, directory.length);
  return zip;
}

/** A real zip whose directory then claims a different unpacked size for its only part (a forgery). */
function forged(
  realBytes: Uint8Array,
  claimedSize: number,
): { zip: Uint8Array; entry: ZipEntry } {
  const zip = zipSync({
    "xl/worksheets/sheet1.xml": [realBytes, { level: 9 }],
  });
  const view = new DataView(zip.buffer);
  let eocd = zip.length - 22;
  while (view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  const central = view.getUint32(eocd + 16, true);
  view.setUint32(central + 24, claimedSize, true);
  view.setUint32(view.getUint32(central + 42, true) + 22, claimedSize, true);
  const directory = readZipDirectory(zip);
  if (directory.kind !== "ok") throw new Error("test setup");
  const entry = directory.entries.get("xl/worksheets/sheet1.xml");
  if (entry === undefined) throw new Error("test setup");
  return { zip, entry };
}

describe("readZipDirectory", () => {
  it("lists the parts of a real zip with their declared sizes", async () => {
    const zip = zipSync({
      "xl/workbook.xml": strToU8("<workbook/>"),
      "a/b.txt": [strToU8("hello"), { level: 0 }],
    });
    const directory = readZipDirectory(zip);
    expect(directory.kind).toBe("ok");
    if (directory.kind !== "ok") return;
    expect([...directory.entries.keys()].sort()).toEqual([
      "a/b.txt",
      "xl/workbook.xml",
    ]);
    expect(directory.entries.get("a/b.txt")).toMatchObject({
      size: 5,
      method: 0,
    });
  });

  it("accepts an archive exactly at the unpacked limit", async () => {
    expect(readZipDirectory(directoryOnly([MAX_UNPACKED_BYTES])).kind).toBe(
      "ok",
    );
  });

  it("F003 reason: declared unpacked size over the limit (a zip bomb)", async () => {
    const result = readZipDirectory(
      directoryOnly([MAX_UNPACKED_BYTES / 2, MAX_UNPACKED_BYTES / 2 + 1]),
    );
    expect(result.kind === "too-large" && result.reason).toContain("100 MB");
  });

  it("rejects too many parts, a zip64 marker, and a zip64 size", async () => {
    expect(
      readZipDirectory(directoryOnly(new Array(MAX_ZIP_PARTS + 1).fill(1)))
        .kind,
    ).toBe("too-large");
    expect(readZipDirectory(directoryOnly([1], { zip64: true })).kind).toBe(
      "too-large",
    );
    expect(readZipDirectory(directoryOnly([0xffffffff])).kind).toBe(
      "too-large",
    );
  });

  it("bytes without a readable directory are unreadable", async () => {
    expect(
      readZipDirectory(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])).kind,
    ).toBe("unreadable");
    expect(readZipDirectory(new Uint8Array()).kind).toBe("unreadable");
    const broken = directoryOnly([1]);
    new DataView(broken.buffer).setUint32(0, 0, true);
    expect(readZipDirectory(broken).kind).toBe("unreadable");
  });
});

describe("extractEntry", () => {
  it("unpacks deflated and stored parts exactly", async () => {
    const text = "x".repeat(100_000);
    const zip = zipSync({
      "d.xml": strToU8(text),
      "s.xml": [strToU8("stored"), { level: 0 }],
    });
    const directory = readZipDirectory(zip);
    if (directory.kind !== "ok") throw new Error("test setup");
    const deflated = await extractEntry(
      zip,
      directory.entries.get("d.xml") as ZipEntry,
      1_000_000,
    );
    expect(
      deflated.kind === "ok" && new TextDecoder().decode(deflated.data),
    ).toBe(text);
    const stored = await extractEntry(
      zip,
      directory.entries.get("s.xml") as ZipEntry,
      100,
    );
    expect(stored.kind === "ok" && new TextDecoder().decode(stored.data)).toBe(
      "stored",
    );
  });

  it("refuses a part that declares more than the limit, without unpacking it", async () => {
    const zip = zipSync({ "d.xml": strToU8("y".repeat(5000)) });
    const directory = readZipDirectory(zip);
    if (directory.kind !== "ok") throw new Error("test setup");
    expect(
      (
        await extractEntry(
          zip,
          directory.entries.get("d.xml") as ZipEntry,
          4999,
        )
      ).kind,
    ).toBe("too-large");
  });

  it("a part that unpacks to far more than it declares is stopped right after its declared size, quickly", async () => {
    // 200 MB of real content behind a claim of 1,000 bytes: the old approach decoded all of it.
    const { zip, entry } = forged(
      new Uint8Array(200 * 1024 * 1024).fill(97),
      1000,
    );
    const started = performance.now();
    const result = await extractEntry(zip, entry, 48 * 1024 * 1024);
    expect(result.kind).toBe("forged");
    expect(performance.now() - started).toBeLessThan(5000);
  }, 60_000);

  it("a part that unpacks to less than it declares, or garbage data, is unreadable", async () => {
    const shorter = forged(strToU8("z".repeat(10_000)), 20_000);
    expect(
      (await extractEntry(shorter.zip, shorter.entry, 1_000_000)).kind,
    ).toBe("unreadable");
    const garbage = forged(strToU8("q".repeat(10_000)), 10_000);
    garbage.zip.fill(
      0xff,
      garbage.entry.localHeaderOffset + 40,
      garbage.entry.localHeaderOffset + 60,
    );
    expect(
      (await extractEntry(garbage.zip, garbage.entry, 1_000_000)).kind,
    ).toBe("unreadable");
  });

  it("an entry whose local header is missing or points past the end is unreadable", async () => {
    const zip = zipSync({ "d.xml": strToU8("abc") });
    const directory = readZipDirectory(zip);
    if (directory.kind !== "ok") throw new Error("test setup");
    const entry = directory.entries.get("d.xml") as ZipEntry;
    expect(
      (await extractEntry(zip, { ...entry, localHeaderOffset: 5 }, 100)).kind,
    ).toBe("unreadable");
    expect(
      (await extractEntry(zip, { ...entry, compressedSize: 1_000_000 }, 100))
        .kind,
    ).toBe("unreadable");
    expect((await extractEntry(zip, { ...entry, method: 12 }, 100)).kind).toBe(
      "unreadable",
    );
  });
});
