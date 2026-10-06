// An .xlsx file is a zip archive, and a zip can claim to unpack to far more data
// than it occupies (a "zip bomb"). Unpacking happens in memory, so the sizes the
// archive declares are checked first, before anything is decompressed. This reads
// only the zip directory at the end of the file; it uses no Node APIs.

/** Most unpacked data a rooming-list workbook may declare (a 5 MB file with thousands of rows unpacks to a few MB). */
export const MAX_UNPACKED_BYTES = 100 * 1024 * 1024;
/** Most parts (files inside the zip) a rooming-list workbook may have; a normal one has about a dozen. */
export const MAX_ZIP_PARTS = 500;

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
// The directory ends within 22 bytes plus a comment of at most 65,535 bytes.
const MAX_SEARCH_BYTES = 22 + 0xffff;

export type ZipCheck = { ok: true } | { ok: false; reason: string };

/**
 * Looks at the zip directory and refuses archives that declare too many parts or
 * too much unpacked data. A directory that cannot be read is let through: the
 * workbook reader will then fail on it and report the file as unreadable.
 */
export function checkZipSizes(bytes: Uint8Array): ZipCheck {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd === undefined) return { ok: true };

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  // 0xFFFF / 0xFFFFFFFF mean "see the zip64 record": far beyond anything legitimate here.
  if (entryCount === 0xffff || offset === 0xffffffff) {
    return { ok: false, reason: "the archive uses zip64 sizes" };
  }
  if (entryCount > MAX_ZIP_PARTS) {
    return {
      ok: false,
      reason: `the archive has ${entryCount} parts; the limit is ${MAX_ZIP_PARTS}`,
    };
  }

  let unpacked = 0;
  for (let index = 0; index < entryCount; index++) {
    if (
      offset + 46 > view.byteLength ||
      view.getUint32(offset, true) !== CENTRAL_DIRECTORY_ENTRY
    ) {
      return { ok: true };
    }
    const size = view.getUint32(offset + 24, true);
    if (size === 0xffffffff)
      return { ok: false, reason: "a part declares a zip64 size" };
    unpacked += size;
    if (unpacked > MAX_UNPACKED_BYTES) {
      return {
        ok: false,
        reason: `the archive declares more than ${MAX_UNPACKED_BYTES / 1024 / 1024} MB unpacked`,
      };
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return { ok: true };
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
