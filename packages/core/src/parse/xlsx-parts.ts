import { attr, decodeEntities, nextTag } from "./xlsx-xml.js";

export type WorkbookInfo = {
  /** Sheets in workbook order: the name a planner sees and the relationship pointing at its part. */
  sheets: { name: string; relationshipId: string }[];
  /** Workbooks from old Mac Excel count dates from 1904 instead of 1900. */
  date1904: boolean;
};

/** Reads xl/workbook.xml. */
export function readWorkbook(xml: string): WorkbookInfo {
  const sheets: WorkbookInfo["sheets"] = [];
  let date1904 = false;
  for (
    let tag = nextTag(xml, 0);
    tag !== undefined;
    tag = nextTag(xml, tag.end)
  ) {
    if (tag.closing) continue;
    if (tag.name === "workbookPr") {
      const value = attr(tag.attrs, "date1904");
      date1904 = value === "1" || value === "true";
    } else if (tag.name === "sheet") {
      const name = attr(tag.attrs, "name");
      const relationshipId =
        attr(tag.attrs, "r:id") ?? relationshipAttribute(tag.attrs);
      if (name !== undefined && relationshipId !== undefined)
        sheets.push({ name, relationshipId });
    }
  }
  return { sheets, date1904 };
}

/** Some writers use another prefix than "r" for the relationships namespace. */
function relationshipAttribute(attrs: string): string | undefined {
  const match = /\s([A-Za-z0-9_]+):id\s*=/.exec(attrs);
  return match?.[1] === undefined ? undefined : attr(attrs, `${match[1]}:id`);
}

/** Reads xl/_rels/workbook.xml.rels into relationship id → part path inside the zip. */
export function readRelationships(xml: string): Map<string, string> {
  const targets = new Map<string, string>();
  for (
    let tag = nextTag(xml, 0);
    tag !== undefined;
    tag = nextTag(xml, tag.end)
  ) {
    if (tag.closing || tag.name !== "Relationship") continue;
    const id = attr(tag.attrs, "Id");
    const target = attr(tag.attrs, "Target");
    if (id !== undefined && target !== undefined)
      targets.set(id, partPath(target));
  }
  return targets;
}

/** Targets are relative to xl/ ("worksheets/sheet1.xml") or absolute ("/xl/worksheets/sheet1.xml"). */
function partPath(target: string): string {
  return target.startsWith("/") ? target.slice(1) : `xl/${target}`;
}

/**
 * The shared-string table. Spreadsheets store each distinct text once and cells
 * point at it by number. Only where each string starts is remembered; a string
 * is decoded the first time a cell asks for it, so memory follows the strings the
 * rooming list actually uses, not the size of the table.
 */
export class SharedStrings {
  private readonly starts: number[] = [];
  private readonly ends: number[] = [];
  private readonly cache = new Map<number, string>();

  constructor(private readonly xml: string) {
    for (
      let tag = nextTag(xml, 0);
      tag !== undefined;
      tag = nextTag(xml, tag.end)
    ) {
      if (tag.name !== "si" || tag.closing) continue;
      this.starts.push(tag.end);
      if (tag.selfClosing) {
        this.ends.push(tag.end);
        continue;
      }
      const close = xml.indexOf(`</${tag.rawName}>`, tag.end);
      const end = close === -1 ? xml.length : close;
      this.ends.push(end);
    }
  }

  get count(): number {
    return this.starts.length;
  }

  /** The text of string number `index` (rich text runs joined), or undefined when it does not exist. */
  get(index: number): string | undefined {
    const cached = this.cache.get(index);
    if (cached !== undefined) return cached;
    const start = this.starts[index];
    const end = this.ends[index];
    if (start === undefined || end === undefined) return undefined;
    const text = collectText(this.xml, start, end);
    this.cache.set(index, text);
    return text;
  }
}

/**
 * Joins the <t> elements between `start` and `end`, skipping phonetic hints
 * (<rPh>, used for Japanese readings), which are not part of the visible text.
 */
export function collectText(xml: string, start: number, end: number): string {
  let text = "";
  let insidePhonetic = false;
  for (
    let tag = nextTag(xml, start);
    tag !== undefined && tag.start < end;
    tag = nextTag(xml, tag.end)
  ) {
    if (tag.name === "rPh") {
      insidePhonetic = !tag.closing && !tag.selfClosing;
      continue;
    }
    if (
      tag.name === "t" &&
      !tag.closing &&
      !tag.selfClosing &&
      !insidePhonetic
    ) {
      const close = xml.indexOf("<", tag.end);
      text += decodeEntities(
        xml.slice(tag.end, close === -1 ? end : Math.min(close, end)),
      );
    }
  }
  return text;
}

// Built-in number formats that exceljs treats as dates (ids 14–22 and 45–47; ids
// 27–36 and 50–58 have no default format code in exceljs, so they are numbers).
const BUILT_IN_DATE_FORMATS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47,
]);

/**
 * The same test exceljs uses: after removing [colour/condition] sections and
 * "quoted literals", a format containing y, m, d, h, M, s or b shows a date or time.
 */
export function isDateFormatCode(code: string): boolean {
  let plain = "";
  let skipUntil = "";
  for (const char of code) {
    if (skipUntil !== "") {
      if (char === skipUntil) skipUntil = "";
      continue;
    }
    if (char === "[") skipUntil = "]";
    else if (char === '"') skipUntil = '"';
    else plain += char;
  }
  return /[ymdhMsb]/.test(plain);
}

/** Which cell styles (by index) display numbers as dates. */
export class DateStyles {
  private readonly dateStyles = new Set<number>();

  constructor(xml: string | undefined) {
    if (xml === undefined) return;
    const customCodes = new Map<number, string>();
    let insideCellXfs = false;
    let styleIndex = 0;
    for (
      let tag = nextTag(xml, 0);
      tag !== undefined;
      tag = nextTag(xml, tag.end)
    ) {
      if (tag.name === "numFmt" && !tag.closing) {
        const id = Number(attr(tag.attrs, "numFmtId"));
        const code = attr(tag.attrs, "formatCode");
        if (Number.isInteger(id) && code !== undefined)
          customCodes.set(id, code);
      } else if (tag.name === "cellXfs") {
        insideCellXfs = !tag.closing && !tag.selfClosing;
      } else if (insideCellXfs && tag.name === "xf" && !tag.closing) {
        const id = Number(attr(tag.attrs, "numFmtId") ?? "0");
        // exceljs ignores numFmtId 0 ("General"); a custom code with the same id wins over the built-in one.
        const custom = customCodes.get(id);
        const isDate =
          id !== 0 &&
          (custom !== undefined
            ? isDateFormatCode(custom)
            : BUILT_IN_DATE_FORMATS.has(id));
        if (isDate) this.dateStyles.add(styleIndex);
        styleIndex++;
      }
    }
  }

  isDate(styleIndex: number): boolean {
    return this.dateStyles.has(styleIndex);
  }
}
