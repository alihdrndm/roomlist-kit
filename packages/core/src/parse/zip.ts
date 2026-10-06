import { Inflate } from "fflate";
import { YIELD_EVERY, yieldToEventLoop } from "./yield.js";

// An .xlsx file is a zip archive. This file reads the zip directory and unpacks
// single parts, with every size checked BEFORE and WHILE unpacking: a zip can claim
// small sizes and still expand to gigabytes (a "zip bomb"). It uses no Node APIs
// and writes nothing to disk; everything stays in memory and is bounded.

/** Most unpacked data a rooming-list workbook may declare in total. */
export const MAX_UNPACKED_BYTES = 100 * 1024 * 1024;
/** Most parts (files inside the zip) a rooming-list workbook may have; a normal one has about a dozen. */
export const MAX_ZIP_PARTS = 500;

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
// The directory ends within 22 bytes plus a comment of at most 65,535 bytes.
const MAX_SEARCH_BYTES = 22 + 0xffff;
// Compressed bytes fed to the inflater at a time. Even at the best possible
// compression ratio (about 1:1000) one step produces at most ~16 MB, so a forged
// part is caught after one step past its declared size, not after unpacking it all.
const INFLATE_STEP = 16 * 1024;

export type ZipEntry = {
  name: string;
  /** 0 = stored, 8 = deflate; anything else is not supported. */
  method: number;
  compressedSize: number;
  /** The unpacked size the archive declares. Unpacking stops as soon as it is exceeded. */
  size: number;
  localHeaderOffset: number;
};

export type ZipDirectory =
  | { kind: "ok"; entries: Map<string, ZipEntry> }
  | { kind: "too-large"; reason: string }
  | { kind: "unreadable" };

/**
 * Reads the zip directory and refuses archives that declare too many parts or too
 * much unpacked data. Nothing is decompressed here.
 */
export function readZipDirectory(bytes: Uint8Array): ZipDirectory {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd === undefined) return { kind: "unreadable" };

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  // 0xFFFF / 0xFFFFFFFF mean "see the zip64 record": far beyond anything legitimate here.
  if (entryCount === 0xffff || offset === 0xffffffff) {
    return { kind: "too-large", reason: "the archive uses zip64 sizes" };
  }
  if (entryCount > MAX_ZIP_PARTS) {
    return {
      kind: "too-large",
      reason: `the archive has ${entryCount} parts; the limit is ${MAX_ZIP_PARTS}`,
    };
  }

  const entries = new Map<string, ZipEntry>();
  let unpacked = 0;
  for (let index = 0; index < entryCount; index++) {
    if (
      offset + 46 > view.byteLength ||
      view.getUint32(offset, true) !== CENTRAL_DIRECTORY_ENTRY
    ) {
      return { kind: "unreadable" };
    }
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    if (size === 0xffffffff || compressedSize === 0xffffffff) {
      return { kind: "too-large", reason: "a part declares a zip64 size" };
    }
    unpacked += size;
    if (unpacked > MAX_UNPACKED_BYTES) {
      return {
        kind: "too-large",
        reason: `the archive declares more than ${MAX_UNPACKED_BYTES / 1024 / 1024} MB unpacked`,
      };
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if (offset + 46 + nameLength > view.byteLength)
      return { kind: "unreadable" };
    const name = new TextDecoder().decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );
    entries.set(name, {
      name,
      method: view.getUint16(offset + 10, true),
      compressedSize,
      size,
      localHeaderOffset: view.getUint32(offset + 42, true),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return { kind: "ok", entries };
}

export type Extracted =
  | { kind: "ok"; data: Uint8Array }
  | { kind: "too-large" }
  /** The part unpacks to more than the archive declares: a forged entry. */
  | { kind: "forged" }
  | { kind: "unreadable" };

/**
 * Unpacks one part, refusing it when it declares more than `limit` bytes and
 * stopping the moment the real output passes the declared size (a forged entry).
 */
export async function extractEntry(
  bytes: Uint8Array,
  entry: ZipEntry,
  limit: number,
): Promise<Extracted> {
  if (entry.size > limit) return { kind: "too-large" };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = entry.localHeaderOffset;
  if (
    header + 30 > view.byteLength ||
    view.getUint32(header, true) !== LOCAL_FILE_HEADER
  ) {
    return { kind: "unreadable" };
  }
  const start =
    header +
    30 +
    view.getUint16(header + 26, true) +
    view.getUint16(header + 28, true);
  const end = start + entry.compressedSize;
  if (end > bytes.length) return { kind: "unreadable" };
  const compressed = bytes.subarray(start, end);

  if (entry.method === 0) {
    return compressed.length === entry.size
      ? { kind: "ok", data: compressed }
      : { kind: "unreadable" };
  }
  if (entry.method !== 8) return { kind: "unreadable" };

  const chunks: Uint8Array[] = [];
  let total = 0;
  let overflow = false;
  const inflater = new Inflate();
  inflater.ondata = (chunk) => {
    total += chunk.length;
    if (total > entry.size) overflow = true;
    else chunks.push(chunk);
  };
  let nextYield = YIELD_EVERY;
  try {
    for (let at = 0; at < compressed.length && !overflow; at += INFLATE_STEP) {
      const last = at + INFLATE_STEP >= compressed.length;
      inflater.push(
        compressed.subarray(at, Math.min(at + INFLATE_STEP, compressed.length)),
        last,
      );
      // Measured in output: unpacking is the expensive part.
      if (total > nextYield) {
        nextYield = total + YIELD_EVERY;
        await yieldToEventLoop();
      }
    }
  } catch {
    return { kind: "unreadable" };
  }
  // More than declared: the directory lies about this part. Less: the data is cut short.
  if (overflow) return { kind: "forged" };
  if (total !== entry.size) return { kind: "unreadable" };

  const data = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) {
    data.set(chunk, position);
    position += chunk.length;
  }
  return { kind: "ok", data };
}

/** The directory's end record is the last 22-byte-plus block that starts with the signature. */
function findEndOfCentralDirectory(view: DataView): number | undefined {
  const lowest = Math.max(0, view.byteLength - MAX_SEARCH_BYTES);
  for (let position = view.byteLength - 22; position >= lowest; position--) {
    if (view.getUint32(position, true) === END_OF_CENTRAL_DIRECTORY)
      return position;
  }
  return undefined;
}
