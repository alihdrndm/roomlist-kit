import { describe, expect, it } from "vitest";
import { detectDelimiter, readCsvRows } from "./csv.js";

const rowsOf = (text: string) => {
  const read = readCsvRows(text);
  if (read.kind !== "rows") throw new Error(read.issue.message);
  return read.rows;
};

describe("detectDelimiter", () => {
  it("picks the delimiter that occurs most in the first non-empty line", () => {
    expect(detectDelimiter("a,b,c\n")).toBe(",");
    expect(detectDelimiter("\n\na;b;c\n1,2")).toBe(";");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
  });

  it("falls back to comma on a tie or when there is no delimiter", () => {
    expect(detectDelimiter("a;b,c")).toBe(",");
    expect(detectDelimiter("a;b\tc")).toBe(",");
    expect(detectDelimiter("title only")).toBe(",");
  });
});

describe("readCsvRows", () => {
  it("keeps quoted delimiters, quotes and line breaks inside one cell", () => {
    const rows = rowsOf('Name,Notes\n"Okafor, Ada","said ""hi""\nthen left"\n');
    expect(rows).toEqual([
      ["Name", "Notes"],
      ["Okafor, Ada", 'said "hi"\nthen left'],
    ]);
  });

  it("keeps empty lines so row numbers match the file, and allows ragged rows", () => {
    const rows = rowsOf("a;b;c\n\n1;2\n1;2;3;4\n");
    expect(rows).toHaveLength(4);
    expect(rows[2]).toEqual(["1", "2"]);
    expect(rows[3]).toHaveLength(4);
  });

  it("does no type casting", () => {
    expect(rowsOf("007,1.50")).toEqual([["007", "1.50"]]);
  });
});

describe("readCsvRows quoting", () => {
  it("keeps a stray quote inside an unquoted cell as text", () => {
    expect(rowsOf('Last Name\nO"Brien\n')).toEqual([
      ["Last Name"],
      ['O"Brien'],
    ]);
  });

  it("F004: a quote that is never closed rejects the file", () => {
    const read = readCsvRows(
      'Last Name,Notes\nOkafor,"never closed\nLindqvist,x\n',
    );
    expect(read.kind).toBe("rejected");
    expect(read.kind === "rejected" && read.issue).toMatchObject({
      ruleId: "F004",
      code: "FILE_ENCODING",
    });
    expect(read.kind === "rejected" && read.issue.message).toContain(
      "never closed",
    );
  });
});
