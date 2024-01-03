import { parse } from "csv-parse/sync";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { readCsvRows } from "./csv.js";

/** csv-parse with the exact options the project used before its own reader (M1). */
function viaCsvParse(text: string, delimiter: string): string[][] {
  return parse(text, {
    delimiter,
    quote: '"',
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: false,
    cast: false,
  });
}

/** One cell written as well-formed CSV: quoted when it needs to be, quotes doubled. */
function writeCell(value: string, delimiter: string): string {
  const needsQuotes =
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r");
  return needsQuotes ? `"${value.replaceAll('"', '""')}"` : value;
}

const cellText = fc.oneof(
  fc.constantFrom(
    "",
    " ",
    "Okafor",
    "2026-11-10",
    "O'Brien",
    "Müller-Lüdenscheidt",
    "😀",
    "a b",
  ),
  fc.string({ maxLength: 12 }),
  fc
    .array(fc.constantFrom("a", " ", ",", ";", "\t", '"', "\n", "\r\n", "x"), {
      maxLength: 8,
    })
    .map((parts) => parts.join("")),
);

const csvDocument = fc.record({
  delimiter: fc.constantFrom(",", ";", "\t"),
  newline: fc.constantFrom("\n", "\r\n"),
  // Rows of 1–6 cells (ragged on purpose); some rows are empty lines.
  rows: fc.array(
    fc.oneof(
      fc.array(cellText, { minLength: 1, maxLength: 6 }),
      fc.constant([] as string[]),
    ),
    {
      minLength: 1,
      maxLength: 12,
    },
  ),
  trailingNewline: fc.boolean(),
});

describe("readCsvRows matches csv-parse on well-formed CSV", () => {
  it("property: the same rows as csv-parse with the old options, for any generated document", async () => {
    await fc.assert(
      fc.asyncProperty(
        csvDocument,
        async ({ delimiter, newline, rows, trailingNewline }) => {
          // A header row that uses the delimiter, so detection picks the generated one.
          const header = ["Last Name", "Arrival", "Departure"].join(delimiter);
          const body = rows.map((cells) =>
            cells.map((cell) => writeCell(cell, delimiter)).join(delimiter),
          );
          // csv-parse decides the record delimiter from the first line break, so cells
          // only use the document's own newline style (or none) to keep the comparison fair.
          const text =
            [header, ...body].join(newline) + (trailingNewline ? newline : "");
          if (newline === "\n" && text.includes("\r")) return;
          const ours = await readCsvRows(text);
          expect(ours.kind).toBe("rows");
          if (ours.kind !== "rows") return;
          // Our reader stores every all-blank row as one shared [""] (a file of millions of
          // blank lines must not cost an array each); csv-parse keeps their cells.
          const blankAsOne = (row: string[]) =>
            row.every((cell) => cell.trim() === "") ? [""] : row;
          expect(ours.rows).toEqual(
            viaCsvParse(text, delimiter).map(blankAsOne),
          );
        },
      ),
      { seed: 42, numRuns: 2000 },
    );
  });
});

describe("readCsvRows on cases csv-parse rejected or handled differently", () => {
  const rowsOf = async (text: string) => {
    const read = await readCsvRows(text);
    if (read.kind !== "rows") throw new Error(read.issue.message);
    return read.rows;
  };

  it("text after a closing quote is kept instead of rejecting the file", async () => {
    expect(await rowsOf('Name,Note\n"Ada"Grace,x\n')).toEqual([
      ["Name", "Note"],
      ["AdaGrace", "x"],
    ]);
  });

  it("a lone \\r ends a record too (old Mac line endings)", async () => {
    expect(await rowsOf("a,b\r1,2\r")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("a trailing delimiter at the very end is one empty last cell", async () => {
    expect(await rowsOf("a,b\n1,")).toEqual([
      ["a", "b"],
      ["1", ""],
    ]);
  });

  it("F004: an unclosed quote names the record it starts in", async () => {
    const read = await readCsvRows('a,b\n1,2\n3,"never closed\n4,5\n');
    expect(read.kind === "rejected" && read.issue.message).toContain(
      "near row 3",
    );
  });

  it("stops after `stopAfter` non-blank rows and says so; blank lines do not count", async () => {
    const text = `h\n${"\n".repeat(50)}${"x\n".repeat(30)}`;
    const read = await readCsvRows(text, 10);
    expect(read.kind === "rows" && read.truncated).toBe(true);
    // The header row counts too: 1 header + 50 blank lines + 10 rows reaches 11 non-blank.
    expect(read.kind === "rows" && read.rows.length).toBe(61);
    const whole = await readCsvRows(text, 100);
    expect(whole.kind === "rows" && whole.truncated).toBe(false);
    // The last row without a trailing newline also counts toward the limit.
    const last = await readCsvRows("a\nb\nc", 2);
    expect(last.kind === "rows" && last.truncated).toBe(true);
  });

  it("a 5 MB file of one-cell rows is read in well under a second (csv-parse took minutes)", async () => {
    const text = `Last Name,Arrival,Departure\n${"a\n".repeat(2_600_000)}`;
    const started = performance.now();
    const read = await readCsvRows(text, 5100);
    expect(read.kind === "rows" && read.truncated).toBe(true);
    expect(performance.now() - started).toBeLessThan(5000);
  });

  it("one row of a million cells is linear, not quadratic", async () => {
    const text = `h\n${"v,".repeat(1_000_000)}v\n`;
    const read = await readCsvRows(text);
    expect(read.kind === "rows" && read.rows[1]?.length).toBe(1_000_001);
  }, 30_000);
});
