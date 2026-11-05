// A small CSV writer for the reports the browser builds (issue list, changes). The
// files are meant to be opened in Excel, so two things matter beyond quoting:
// - a cell that starts with = + - @ (or a tab or carriage return) is prefixed with
//   an apostrophe, so a guest name such as "=HYPERLINK(...)" cannot run as a
//   formula (CSV injection, OWASP);
// - the file starts with a UTF-8 byte order mark, so Excel reads accents correctly.

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows to CSV text with CRLF line ends (RFC 4180), each row ending in one. */
export function toCsv(
  rows: readonly (readonly (string | number | undefined | null)[])[],
): string {
  return rows.map((row) => `${row.map(csvCell).join(",")}\r\n`).join("");
}

/** A CSV file the user can save: BOM + text, typed as text/csv. */
export function csvBlob(text: string): Blob {
  return new Blob(["﻿", text], { type: "text/csv;charset=utf-8" });
}
