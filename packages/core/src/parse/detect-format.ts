import { makeIssue } from "../issues.js";
import type { Issue } from "../model.js";

export type DetectedFormat =
  | { kind: "xlsx" }
  | { kind: "csv"; text: string }
  | { kind: "rejected"; issue: Issue };

// Content decides the format, never the file name: planners rename files freely.
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // .xlsx is a zip archive
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0]; // legacy binary .xls

export function detectFormat(input: Uint8Array): DetectedFormat {
  if (startsWith(input, ZIP_MAGIC)) return { kind: "xlsx" };
  if (startsWith(input, OLE_MAGIC)) {
    return {
      kind: "rejected",
      issue: makeIssue(
        "F003",
        "This is a legacy .xls file. Save it as .xlsx or .csv and upload it again.",
      ),
    };
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(input);
  } catch {
    return {
      kind: "rejected",
      issue: makeIssue(
        "F004",
        "The file is not valid UTF-8 text. Save it as CSV UTF-8 and upload it again.",
      ),
    };
  }

  // TextDecoder strips one BOM by default (ignoreBOM: false); this removes any left over.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.trim() === "") {
    return {
      kind: "rejected",
      issue: makeIssue(
        "F001",
        "The file is empty. Upload a file with a header row and guests.",
      ),
    };
  }
  return { kind: "csv", text };
}

function startsWith(input: Uint8Array, magic: number[]): boolean {
  return magic.every((byte, index) => input[index] === byte);
}
