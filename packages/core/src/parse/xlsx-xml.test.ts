import { describe, expect, it } from "vitest";
import { attr, decodeEntities, nextTag, textAfter } from "./xlsx-xml.js";

describe("decodeEntities", () => {
  it("decodes the five named entities and decimal and hex references", () => {
    expect(decodeEntities("&lt;a&gt; &amp; &quot;b&quot; &apos;c&apos;")).toBe(
      `<a> & "b" 'c'`,
    );
    expect(decodeEntities("caf&#233; &#x1F600;")).toBe("café 😀");
  });

  it("leaves unknown, unterminated, overlong and out-of-range references as written", () => {
    expect(decodeEntities("&nbsp;")).toBe("&nbsp;");
    expect(decodeEntities("AT&T and more")).toBe("AT&T and more");
    expect(decodeEntities("&averyveryverylongname;")).toBe(
      "&averyveryverylongname;",
    );
    expect(decodeEntities("&#x110000;")).toBe("&#x110000;");
    expect(decodeEntities("&#xZZ;")).toBe("&#xZZ;");
  });

  it("returns text without '&' unchanged", () => {
    expect(decodeEntities("plain")).toBe("plain");
  });
});

describe("attr", () => {
  it("reads double- and single-quoted values, exact names only, decoded", () => {
    const attrs = ` r="B7" t='s' x:r="other" s = "3" title="A &amp; B"`;
    expect(attr(attrs, "r")).toBe("B7");
    expect(attr(attrs, "t")).toBe("s");
    expect(attr(attrs, "x:r")).toBe("other");
    expect(attr(attrs, "s")).toBe("3");
    expect(attr(attrs, "title")).toBe("A & B");
    expect(attr(attrs, "missing")).toBeUndefined();
  });

  it("gives up safely on malformed attribute text", () => {
    expect(attr(" r=B7", "r")).toBeUndefined();
    expect(attr(' r="unterminated', "r")).toBeUndefined();
    expect(attr(" noequals", "r")).toBeUndefined();
  });
});

describe("nextTag", () => {
  it("skips comments, processing instructions, doctype and CDATA markers", () => {
    const xml = `<?xml version="1.0"?><!DOCTYPE x><!-- c --><a b="1"/>`;
    expect(nextTag(xml, 0)).toMatchObject({
      name: "a",
      selfClosing: true,
      closing: false,
      attrs: ' b="1"',
    });
  });

  it("strips a namespace prefix from the name but keeps it in rawName", () => {
    expect(nextTag("<x:row r='1'>", 0)).toMatchObject({
      name: "row",
      rawName: "x:row",
      closing: false,
    });
    expect(nextTag("</x:row>", 0)).toMatchObject({
      name: "row",
      closing: true,
    });
  });

  it("returns undefined for unterminated markup instead of throwing", () => {
    expect(nextTag("<!-- never closed", 0)).toBeUndefined();
    expect(nextTag("<?pi never closed", 0)).toBeUndefined();
    expect(nextTag("<!DOCTYPE never closed", 0)).toBeUndefined();
    expect(nextTag("<a never closed", 0)).toBeUndefined();
    expect(nextTag("no tags at all", 0)).toBeUndefined();
  });

  it("textAfter reads up to the next tag, or the end, and is empty for empty elements", () => {
    const xml = "<v>12 &amp; 3</v><t/>tail";
    const v = nextTag(xml, 0);
    if (v === undefined) throw new Error("test setup");
    expect(textAfter(xml, v)).toBe("12 & 3");
    const t = nextTag(xml, v.end + 4);
    if (t === undefined) throw new Error("test setup");
    expect(textAfter(xml, t)).toBe("");
    expect(
      textAfter("<v>to the end", { ...v, end: 3, selfClosing: false }),
    ).toBe("to the end");
  });
});
